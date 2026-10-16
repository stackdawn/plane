# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import CustomProperty, CustomPropertyOption, IssueType

OPTION_TYPES = (CustomProperty.PropertyType.SELECT, CustomProperty.PropertyType.MULTI_SELECT)


class CustomPropertyOptionSerializer(BaseSerializer):
    id = serializers.UUIDField(required=False)

    class Meta:
        model = CustomPropertyOption
        fields = ["id", "name", "color", "sort_order", "is_active"]
        read_only_fields = ["sort_order"]


class CustomPropertySerializer(BaseSerializer):
    options = CustomPropertyOptionSerializer(many=True, required=False)
    issue_type = serializers.PrimaryKeyRelatedField(queryset=IssueType.objects.all(), required=False, allow_null=True)

    class Meta:
        model = CustomProperty
        fields = [
            "id",
            "issue_type",
            "name",
            "description",
            "property_type",
            "is_multi",
            "is_required",
            "is_active",
            "sort_order",
            "options",
        ]
        read_only_fields = ["id", "sort_order"]

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required")
        return value

    def validate(self, attrs):
        project_id = self.context["project_id"]
        issue_type = attrs.get("issue_type", getattr(self.instance, "issue_type", None))
        name = attrs.get("name", getattr(self.instance, "name", None))

        if (
            issue_type
            and not issue_type.project_issue_types.filter(project_id=project_id, deleted_at__isnull=True).exists()
        ):
            raise serializers.ValidationError({"issue_type": "Work item type does not belong to this project"})

        siblings = CustomProperty.objects.filter(project_id=project_id, issue_type=issue_type, name__iexact=name)
        if self.instance:
            siblings = siblings.exclude(pk=self.instance.pk)
        if siblings.exists():
            raise serializers.ValidationError({"name": "A property with this name already exists"})

        if self.instance is None:
            property_type = attrs.get("property_type", CustomProperty.PropertyType.TEXT)
            if property_type in OPTION_TYPES and not attrs.get("options"):
                raise serializers.ValidationError({"options": "Add at least one option"})
        elif "property_type" in attrs and attrs["property_type"] != self.instance.property_type:
            raise serializers.ValidationError({"property_type": "The property type cannot be changed"})
        return attrs

    def _save_options(self, custom_property, options):
        existing = {str(option.id): option for option in custom_property.options.all()}
        kept = set()
        for index, data in enumerate(options):
            option = existing.get(str(data.get("id"))) if data.get("id") else None
            if option:
                option.name = data["name"]
                option.color = data.get("color", option.color)
                option.is_active = data.get("is_active", True)
                option.sort_order = (index + 1) * 10000
                option.save()
            else:
                option = CustomPropertyOption.objects.create(
                    custom_property=custom_property,
                    name=data["name"],
                    color=data.get("color", ""),
                    sort_order=(index + 1) * 10000,
                )
            kept.add(str(option.id))
        for option_id, option in existing.items():
            if option_id not in kept:
                option.delete()

    def create(self, validated_data):
        options = validated_data.pop("options", [])
        custom_property = super().create(validated_data)
        if custom_property.property_type in OPTION_TYPES:
            self._save_options(custom_property, options)
        return custom_property

    def update(self, instance, validated_data):
        options = validated_data.pop("options", None)
        custom_property = super().update(instance, validated_data)
        if options is not None and custom_property.property_type in OPTION_TYPES:
            self._save_options(custom_property, options)
        return custom_property
