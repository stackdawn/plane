# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import re

# Third party imports
from rest_framework import serializers

# Module imports
from .base import BaseSerializer
from plane.db.models import IssueType


ISSUE_TYPE_GLYPHS = frozenset(
    {
        "bug", "plus", "check", "file", "zap", "bookmark", "flag", "help", "alert", "rocket", "star",
        "lightbulb", "wrench", "lock", "message", "shield", "layers", "flask", "branch", "clock", "circle",
    }
)  # fmt: skip
MAX_LOGO_IMAGE_LENGTH = 60_000  # data URI characters (~45 KB of image)
_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$")


class IssueTypeSerializer(BaseSerializer):
    class Meta:
        model = IssueType
        fields = [
            "id",
            "name",
            "description",
            "logo_props",
            "is_epic",
            "is_default",
            "is_active",
            "level",
            "workspace",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "is_default", "created_at", "updated_at"]

    def validate_logo_props(self, value):
        """logo_props holds only {color, glyph, image}; image is a small data URI (no external URLs)."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("logo_props must be an object")
        clean = {}
        if value.get("color"):
            if not _COLOR_RE.match(str(value["color"])):
                raise serializers.ValidationError("color must be a #RRGGBB hex value")
            clean["color"] = value["color"]
        if value.get("glyph"):
            if value["glyph"] not in ISSUE_TYPE_GLYPHS:
                raise serializers.ValidationError("Unknown icon")
            clean["glyph"] = value["glyph"]
        if value.get("image"):
            image = str(value["image"])
            if len(image) > MAX_LOGO_IMAGE_LENGTH or not _IMAGE_RE.match(image):
                raise serializers.ValidationError("image must be a small PNG, JPEG or WebP")
            clean["image"] = image
        return clean

    def validate_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Name is required")
        project_id = self.context.get("project_id")
        siblings = IssueType.objects.filter(
            project_issue_types__project_id=project_id,
            project_issue_types__deleted_at__isnull=True,
            name__iexact=value,
        )
        if self.instance:
            siblings = siblings.exclude(pk=self.instance.pk)
        if siblings.exists():
            raise serializers.ValidationError("A work item type with this name already exists in the project")
        return value
