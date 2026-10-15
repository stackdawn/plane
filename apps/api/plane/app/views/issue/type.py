# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import transaction

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseViewSet
from plane.app.serializers import IssueTypeSerializer
from plane.app.permissions import allow_permission, ProjectBasePermission, ROLE
from plane.db.models import Issue, IssueType, Project, ProjectIssueType


class IssueTypeViewSet(BaseViewSet):
    """Project-scoped work item types (list / create / update / delete)."""

    serializer_class = IssueTypeSerializer
    model = IssueType
    permission_classes = [ProjectBasePermission]

    def get_queryset(self):
        return (
            IssueType.objects.filter(
                workspace__slug=self.kwargs.get("slug"),
                project_issue_types__project_id=self.kwargs.get("project_id"),
                project_issue_types__deleted_at__isnull=True,
            )
            .distinct()
            .order_by("-is_default", "level", "name")
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def list(self, request, slug, project_id):
        serializer = IssueTypeSerializer(self.get_queryset(), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def retrieve(self, request, slug, project_id, pk):
        issue_type = self.get_queryset().get(pk=pk)
        return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def create(self, request, slug, project_id):
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        serializer = IssueTypeSerializer(data=request.data, context={"project_id": project_id})
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            issue_type = serializer.save(workspace_id=project.workspace_id)
            ProjectIssueType.objects.create(project=project, issue_type=issue_type)
        return Response(IssueTypeSerializer(issue_type).data, status=status.HTTP_201_CREATED)

    @allow_permission([ROLE.ADMIN])
    def partial_update(self, request, slug, project_id, pk):
        issue_type = self.get_queryset().get(pk=pk)
        serializer = IssueTypeSerializer(
            issue_type, data=request.data, partial=True, context={"project_id": project_id}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN])
    def destroy(self, request, slug, project_id, pk):
        issue_type = self.get_queryset().get(pk=pk)
        if issue_type.is_default:
            return Response(
                {"error": "The default work item type cannot be deleted"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            # Items fall back to the default type (null is treated as default by the UI)
            Issue.objects.filter(project_id=project_id, type=issue_type).update(type=None)
            ProjectIssueType.objects.filter(project_id=project_id, issue_type=issue_type).delete()
            issue_type.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
