# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.conf import settings
from django.db import models

# Module imports
from .base import BaseModel
from .project import ProjectBaseModel


class CustomProperty(ProjectBaseModel):
    """A user-defined field on work items of a project, optionally limited to one work item type."""

    class PropertyType(models.TextChoices):
        TEXT = "text", "Text"
        NUMBER = "number", "Number"
        PERSON = "person", "Person"
        SELECT = "select", "Select"
        MULTI_SELECT = "multi_select", "Multi select"

    issue_type = models.ForeignKey(
        "db.IssueType",
        on_delete=models.CASCADE,
        related_name="custom_properties",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    property_type = models.CharField(max_length=20, choices=PropertyType.choices, default=PropertyType.TEXT)
    is_multi = models.BooleanField(default=False)  # multiple people; select/multi-select are fixed by type
    is_required = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    sort_order = models.FloatField(default=65535)

    class Meta:
        verbose_name = "Custom Property"
        verbose_name_plural = "Custom Properties"
        db_table = "custom_properties"
        ordering = ("sort_order", "created_at")

    def __str__(self):
        return f"{self.project} - {self.name}"


class CustomPropertyOption(BaseModel):
    custom_property = models.ForeignKey(CustomProperty, on_delete=models.CASCADE, related_name="options")
    name = models.CharField(max_length=255)
    color = models.CharField(max_length=20, blank=True, default="")
    sort_order = models.FloatField(default=65535)
    is_active = models.BooleanField(default=True)

    class Meta:
        verbose_name = "Custom Property Option"
        verbose_name_plural = "Custom Property Options"
        db_table = "custom_property_options"
        ordering = ("sort_order", "created_at")

    def __str__(self):
        return self.name


class CustomPropertyValue(ProjectBaseModel):
    """One stored value. Multi-select and multi-person properties use one row per chosen value."""

    issue = models.ForeignKey("db.Issue", on_delete=models.CASCADE, related_name="custom_property_values")
    custom_property = models.ForeignKey(CustomProperty, on_delete=models.CASCADE, related_name="values")
    value_text = models.TextField(blank=True, default="")
    value_number = models.DecimalField(max_digits=24, decimal_places=6, null=True, blank=True)
    value_option = models.ForeignKey(
        CustomPropertyOption, on_delete=models.CASCADE, null=True, blank=True, related_name="values"
    )
    value_user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="+"
    )

    class Meta:
        verbose_name = "Custom Property Value"
        verbose_name_plural = "Custom Property Values"
        db_table = "custom_property_values"
        indexes = [models.Index(fields=["issue", "custom_property"], name="cpv_issue_property_idx")]
        ordering = ("created_at",)

    def __str__(self):
        return f"{self.issue_id} - {self.custom_property_id}"
