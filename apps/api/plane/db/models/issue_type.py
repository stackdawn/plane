# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Django imports
from django.db import models, transaction
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
DEFAULT_ISSUE_TYPE_LOGO = {"glyph": "check", "color": "#3E63DD"}

# Created with every project's default type, so a new project starts with a useful set. Admins can
# rename, recolour or delete any of them (except the default) and add their own.
STANDARD_ISSUE_TYPES = [
    {"name": "Bug", "description": "Something is broken", "glyph": "bug", "color": "#E5484D"},
    {"name": "Documentation", "description": "Write or update documents", "glyph": "file", "color": "#8E4EC6"},
    {"name": "Feature", "description": "New capability", "glyph": "layers", "color": "#30A46C"},
    {"name": "KT or Setup", "description": "Knowledge transfer or setup", "glyph": "circle", "color": "#30A46C"},
    {"name": "Spike", "description": "Time-boxed research", "glyph": "zap", "color": "#F76B15"},
]


def ensure_default_issue_type(project, created_by=None):
    """Return the project's default work item type, creating it (and the standard set) on first use.

    Types are stored workspace-wide in `issue_types` but this implementation
    keeps one set per project: every type is linked to exactly one project
    through `project_issue_types`.
    """
    link = ProjectIssueType.objects.filter(project=project, is_default=True).select_related("issue_type").first()
    if link:
        return link.issue_type

    with transaction.atomic():
        issue_type = IssueType.objects.create(
            workspace_id=project.workspace_id,
            name=DEFAULT_ISSUE_TYPE_NAME,
            description="Default work item type",
            logo_props=dict(DEFAULT_ISSUE_TYPE_LOGO),
            is_default=True,
        )
        ProjectIssueType.objects.create(
            project=project,
            workspace_id=project.workspace_id,
            issue_type=issue_type,
            is_default=True,
        )
        existing = {
            name.lower()
            for name in IssueType.objects.filter(
                project_issue_types__project=project, project_issue_types__deleted_at__isnull=True
            ).values_list("name", flat=True)
        }
        for spec in STANDARD_ISSUE_TYPES:
            if spec["name"].lower() in existing:
                continue
            extra = IssueType.objects.create(
                workspace_id=project.workspace_id,
                name=spec["name"],
                description=spec["description"],
                logo_props={"glyph": spec["glyph"], "color": spec["color"]},
            )
            ProjectIssueType.objects.create(project=project, workspace_id=project.workspace_id, issue_type=extra)
    return issue_type
