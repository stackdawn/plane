# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Shared ingest for GitHub pull requests, reviews and commits (events endpoint and backfill import)."""

# Python imports
import re

# Django imports
from django.utils.dateparse import parse_datetime

# Module imports
from plane.db.models import (
    GithubCommit,
    GithubPullRequest,
    GithubReview,
    Issue,
    Project,
)

KEY_RE = re.compile(r"\b([A-Za-z][A-Za-z0-9]{1,9})-(\d+)\b")
MERGE_PREFIXES = ("Merge pull request", "Merge branch", "Merge remote-tracking")


def resolve_work_item(workspace_id, *texts):
    """First work item named by a key like DEPRE-123 in the given texts, as (issue, project) or (None, None)."""
    identifiers = {}
    for text in texts:
        for ident, number in KEY_RE.findall(text or ""):
            ident = ident.upper()
            if ident not in identifiers:
                identifiers[ident] = Project.objects.filter(workspace_id=workspace_id, identifier=ident).first()
            project = identifiers[ident]
            if project is None:
                continue
            issue = Issue.objects.filter(project=project, sequence_id=int(number)).first()
            if issue:
                return issue, project
    return None, None


def _dt(value):
    if not value:
        return None
    return parse_datetime(value) if isinstance(value, str) else value


def upsert_pull_request(workspace_id, repo, data):
    """Create or update one pull request from a normalised dict; returns the model."""
    repo = repo.lower()
    issue, project = resolve_work_item(workspace_id, data.get("title"), data.get("head_ref"), data.get("body"))
    merged_at = _dt(data.get("merged_at"))
    state = "merged" if merged_at else ("closed" if data.get("closed_at") or data.get("state") == "closed" else "open")
    pr, _ = GithubPullRequest.objects.update_or_create(
        repo=repo,
        number=int(data["number"]),
        defaults={
            "workspace_id": workspace_id,
            "title": (data.get("title") or "")[:500],
            "author_login": (data.get("author") or "")[:100],
            "state": state,
            "is_draft": bool(data.get("draft")),
            "html_url": (data.get("html_url") or "")[:500],
            "head_ref": (data.get("head_ref") or "")[:300],
            "created_on": _dt(data.get("created_at")),
            "merged_at": merged_at,
            "closed_at": _dt(data.get("closed_at")),
            "additions": int(data.get("additions") or 0),
            "deletions": int(data.get("deletions") or 0),
            "changed_files": int(data.get("changed_files") or 0),
            "issue": issue,
            "project": project,
        },
    )
    return pr


def upsert_reviews(pull_request, reviews):
    count = 0
    for review in reviews or []:
        GithubReview.objects.update_or_create(
            review_id=int(review["id"]),
            defaults={
                "pull_request": pull_request,
                "reviewer_login": (review.get("reviewer") or "")[:100],
                "state": (review.get("state") or "").lower()[:30],
                "submitted_at": _dt(review.get("submitted_at")),
            },
        )
        count += 1
    return count


def upsert_commits(workspace_id, repo, commits):
    repo = repo.lower()
    count = 0
    for commit in commits or []:
        message = (commit.get("message") or "").split("\n", 1)[0]
        issue, project = resolve_work_item(workspace_id, commit.get("message"))
        GithubCommit.objects.update_or_create(
            repo=repo,
            sha=commit["sha"][:64],
            defaults={
                "workspace_id": workspace_id,
                "author_login": (commit.get("author_login") or "")[:100],
                "author_name": (commit.get("author_name") or "")[:200],
                "committed_at": _dt(commit.get("timestamp")),
                "message": message[:500],
                "issue": issue,
                "project": project,
            },
        )
        count += 1
    return count
