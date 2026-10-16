# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
from decimal import Decimal, InvalidOperation

# Django imports
from django.db import transaction
from django.db.models import Q

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseAPIView, BaseViewSet
from plane.app.permissions import ROLE, ProjectBasePermission, allow_permission
from plane.app.serializers import CustomPropertySerializer
from plane.db.models import (
    CustomProperty,
    CustomPropertyOption,
    CustomPropertyValue,
    Issue,
    Project,
    ProjectMember,
)

PropertyType = CustomProperty.PropertyType
MAX_TEXT_LENGTH = 5000


class CustomPropertyViewSet(BaseViewSet):
    """Project-scoped custom property definitions."""

    serializer_class = CustomPropertySerializer
    model = CustomProperty
    permission_classes = [ProjectBasePermission]

    def get_queryset(self):
        queryset = CustomProperty.objects.filter(
            workspace__slug=self.kwargs.get("slug"), project_id=self.kwargs.get("project_id")
        ).prefetch_related("options")
        issue_type_id = self.request.query_params.get("issue_type")
        if issue_type_id:
            queryset = queryset.filter(Q(issue_type_id=issue_type_id) | Q(issue_type__isnull=True))
        return queryset

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id):
        return Response(CustomPropertySerializer(self.get_queryset(), many=True).data)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = CustomPropertySerializer(data=request.data, context={"project_id": project_id})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            custom_property = serializer.save(project=project, workspace_id=project.workspace_id)
        return Response(CustomPropertySerializer(custom_property).data, status=status.HTTP_201_CREATED)

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        custom_property = self.get_queryset().get(pk=pk)
        serializer = CustomPropertySerializer(
            custom_property, data=request.data, partial=True, context={"project_id": project_id}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            serializer.save()
        return Response(CustomPropertySerializer(self.get_queryset().get(pk=pk)).data)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, pk):
        custom_property = self.get_queryset().get(pk=pk)
        with transaction.atomic():
            CustomPropertyValue.objects.filter(custom_property=custom_property).delete()
            custom_property.options.all().delete()
            custom_property.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _read_values(issue, properties):
    """{property_id: value}. Single values are scalars, multi values are lists, empty is None."""
    rows = {}
    for row in CustomPropertyValue.objects.filter(issue=issue):
        rows.setdefault(row.custom_property_id, []).append(row)
    result = {}
    for prop in properties:
        stored = rows.get(prop.id, [])
        if prop.property_type == PropertyType.TEXT:
            result[str(prop.id)] = stored[0].value_text if stored else None
        elif prop.property_type == PropertyType.NUMBER:
            result[str(prop.id)] = (
                float(stored[0].value_number) if stored and stored[0].value_number is not None else None
            )
        elif prop.property_type == PropertyType.PERSON:
            ids = [str(r.value_user_id) for r in stored if r.value_user_id]
            result[str(prop.id)] = ids if prop.is_multi else (ids[0] if ids else None)
        elif prop.property_type == PropertyType.SELECT:
            ids = [str(r.value_option_id) for r in stored if r.value_option_id]
            result[str(prop.id)] = ids[0] if ids else None
        else:
            result[str(prop.id)] = [str(r.value_option_id) for r in stored if r.value_option_id]
    return result


class IssueCustomPropertyValueEndpoint(BaseAPIView):
    """Read and write the custom property values of one work item."""

    permission_classes = [ProjectBasePermission]

    def _applicable(self, issue):
        return list(
            CustomProperty.objects.filter(project_id=issue.project_id, is_active=True)
            .filter(Q(issue_type__isnull=True) | Q(issue_type_id=issue.type_id))
            .prefetch_related("options")
        )

    def _payload(self, issue):
        properties = self._applicable(issue)
        return {
            "properties": CustomPropertySerializer(properties, many=True).data,
            "values": _read_values(issue, properties),
        }

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id, issue_id):
        issue = Issue.objects.get(pk=issue_id, project_id=project_id, workspace__slug=slug)
        return Response(self._payload(issue))

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id, issue_id):
        issue = Issue.objects.get(pk=issue_id, project_id=project_id, workspace__slug=slug)
        incoming = request.data.get("values")
        if not isinstance(incoming, dict):
            return Response({"error": "values must be an object"}, status=status.HTTP_400_BAD_REQUEST)

        properties = {str(p.id): p for p in self._applicable(issue)}
        writes = []
        errors = {}
        for property_id, raw in incoming.items():
            prop = properties.get(str(property_id))
            if prop is None:
                errors[property_id] = "Unknown property for this work item"
                continue
            try:
                writes.append((prop, self._rows(prop, raw, project_id)))
            except ValueError as error:
                errors[property_id] = str(error)
        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            for prop, rows in writes:
                CustomPropertyValue.objects.filter(issue=issue, custom_property=prop).delete()
                CustomPropertyValue.objects.bulk_create(
                    [
                        CustomPropertyValue(
                            issue=issue,
                            custom_property=prop,
                            project_id=issue.project_id,
                            workspace_id=issue.workspace_id,
                            **row,
                        )
                        for row in rows
                    ]
                )
        return Response(self._payload(issue))

    @staticmethod
    def _rows(prop, raw, project_id):
        """Validate `raw` for `prop` and return the kwargs of the rows to store (empty list clears)."""
        if raw in (None, "", []):
            return []
        if prop.property_type == PropertyType.TEXT:
            text = str(raw)
            if len(text) > MAX_TEXT_LENGTH:
                raise ValueError(f"Text is limited to {MAX_TEXT_LENGTH} characters")
            return [{"value_text": text}]
        if prop.property_type == PropertyType.NUMBER:
            try:
                number = Decimal(str(raw))
            except InvalidOperation:
                raise ValueError("Enter a valid number")
            if not number.is_finite() or abs(number) >= Decimal(10) ** 18:
                raise ValueError("Enter a valid number")
            return [{"value_number": number}]
        values = raw if isinstance(raw, list) else [raw]
        if prop.property_type == PropertyType.PERSON:
            if len(values) > 1 and not prop.is_multi:
                raise ValueError("Only one person is allowed")
            valid = set(
                str(member_id)
                for member_id in ProjectMember.objects.filter(
                    project_id=project_id, is_active=True, role__gte=15, member_id__in=values
                ).values_list("member_id", flat=True)
            )
            if any(str(v) not in valid for v in values):
                raise ValueError("Pick people who are members of this project")
            return [{"value_user_id": v} for v in dict.fromkeys(values)]
        if prop.property_type == PropertyType.SELECT and len(values) > 1:
            raise ValueError("Only one option is allowed")
        valid = set(
            str(option_id)
            for option_id in CustomPropertyOption.objects.filter(
                custom_property=prop, is_active=True, id__in=values
            ).values_list("id", flat=True)
        )
        if any(str(v) not in valid for v in values):
            raise ValueError("Pick one of the listed options")
        return [{"value_option_id": v} for v in dict.fromkeys(values)]
