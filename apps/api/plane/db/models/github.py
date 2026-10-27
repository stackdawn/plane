# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""GitHub activity reported by a GitHub Actions workflow or imported with `gh`.

Plane Community Edition has no GitHub integration. These tables hold just enough pull request,
review and commit data to answer "who opened, merged and pushed what" per project, and to tie
that activity to work items through keys such as DEPRE-123.
"""

# Python imports
import uuid

# Django imports
from django.db import models


class GithubRepositoryLink(models.Model):
    """A repository whose activity counts towards a project's engineering metrics."""

    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    project = models.ForeignKey("db.Project", on_delete=models.CASCADE, related_name="github_repositories")
    repo = models.CharField(max_length=200)  # "owner/name", lower case
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "github_repository_links"
        unique_together = [("project", "repo")]
        ordering = ("repo",)


class GithubPullRequest(models.Model):
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="github_pull_requests")
    repo = models.CharField(max_length=200)
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=500)
    author_login = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=10, default="open")  # open | merged | closed
    is_draft = models.BooleanField(default=False)
    html_url = models.URLField(max_length=500, blank=True, default="")
    head_ref = models.CharField(max_length=300, blank=True, default="")
    created_on = models.DateTimeField()
    merged_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    additions = models.PositiveIntegerField(default=0)
    deletions = models.PositiveIntegerField(default=0)
    changed_files = models.PositiveIntegerField(default=0)
    issue = models.ForeignKey("db.Issue", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    project = models.ForeignKey("db.Project", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "github_pull_requests"
        unique_together = [("repo", "number")]
        indexes = [models.Index(fields=["workspace", "created_on"], name="ghpr_ws_created_idx")]


class GithubReview(models.Model):
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    pull_request = models.ForeignKey(GithubPullRequest, on_delete=models.CASCADE, related_name="reviews")
    review_id = models.BigIntegerField(unique=True)
    reviewer_login = models.CharField(max_length=100, blank=True, default="")
    state = models.CharField(max_length=30, blank=True, default="")
    submitted_at = models.DateTimeField()

    class Meta:
        db_table = "github_reviews"


class GithubCommit(models.Model):
    id = models.UUIDField(default=uuid.uuid4, primary_key=True, editable=False)
    workspace = models.ForeignKey("db.Workspace", on_delete=models.CASCADE, related_name="github_commits")
    repo = models.CharField(max_length=200)
    sha = models.CharField(max_length=64)
    author_login = models.CharField(max_length=100, blank=True, default="")
    author_name = models.CharField(max_length=200, blank=True, default="")
    committed_at = models.DateTimeField()
    message = models.CharField(max_length=500, blank=True, default="")
    issue = models.ForeignKey("db.Issue", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")
    project = models.ForeignKey("db.Project", on_delete=models.SET_NULL, null=True, blank=True, related_name="+")

    class Meta:
        db_table = "github_commits"
        unique_together = [("repo", "sha")]
        indexes = [models.Index(fields=["workspace", "committed_at"], name="ghcommit_ws_time_idx")]
