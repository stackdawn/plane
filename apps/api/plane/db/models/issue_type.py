# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models
from django.db.models import Q

# Module imports
from .project import ProjectBaseModel
from .base import BaseModel


class IssueType(BaseModel):
    workspace = models.ForeignKey("db.Workspace", related_name="issue_types", on_delete=models.CASCADE)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    logo_props = models.JSONField(default=dict)
    is_epic = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    level = models.FloatField(default=0)
    external_source = models.CharField(max_length=255, null=True, blank=True)
    external_id = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        verbose_name = "Issue Type"
        verbose_name_plural = "Issue Types"
        db_table = "issue_types"

    def __str__(self):
        return self.name


class ProjectIssueType(ProjectBaseModel):
    issue_type = models.ForeignKey("db.IssueType", related_name="project_issue_types", on_delete=models.CASCADE)
    level = models.PositiveIntegerField(default=0)
    is_default = models.BooleanField(default=False)

    class Meta:
        unique_together = ["project", "issue_type", "deleted_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["project", "issue_type"],
                condition=Q(deleted_at__isnull=True),
                name="project_issue_type_unique_project_issue_type_when_deleted_at_null",
            )
        ]
        verbose_name = "Project Issue Type"
        verbose_name_plural = "Project Issue Types"
        db_table = "project_issue_types"
        ordering = ("project", "issue_type")

    def __str__(self):
        return f"{self.project} - {self.issue_type}"


DEFAULT_ISSUE_TYPE_NAME = "Task"


def ensure_default_issue_type(project, created_by=None):
    """Return the project's default work item type, creating it on first use.

    Types are stored workspace-wide in `issue_types` but this implementation
    keeps one set per project: every type is linked to exactly one project
    through `project_issue_types`.
    """
    link = ProjectIssueType.objects.filter(project=project, is_default=True).select_related("issue_type").first()
    if link:
        return link.issue_type

    issue_type = IssueType.objects.create(
        workspace_id=project.workspace_id,
        name=DEFAULT_ISSUE_TYPE_NAME,
        description="Default work item type",
        is_default=True,
    )
    ProjectIssueType.objects.create(
        project=project,
        workspace_id=project.workspace_id,
        issue_type=issue_type,
        is_default=True,
    )
    return issue_type
