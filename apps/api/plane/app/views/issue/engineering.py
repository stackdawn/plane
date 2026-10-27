# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Engineering activity (pull requests, reviews, commits) for a project, from reported GitHub data."""

# Python imports
import math
from datetime import timedelta
from statistics import median

# Django imports
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .. import BaseAPIView
from plane.app.permissions import ROLE, ProjectBasePermission, allow_permission
from plane.db.models import GithubCommit, GithubPullRequest, GithubRepositoryLink, GithubReview, Project
from plane.utils.github_sync import MERGE_PREFIXES

ALLOWED_WINDOWS = (7, 30, 90)
MAX_REPOS = 50


def _normalise_repo(value):
    value = (value or "").strip().lower().removeprefix("https://github.com/").strip("/")
    return value if value.count("/") == 1 and " " not in value else None


class GithubRepositoriesEndpoint(BaseAPIView):
    """Which GitHub repositories count towards this project's engineering metrics."""

    permission_classes = [ProjectBasePermission]

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        repos = list(GithubRepositoryLink.objects.filter(project_id=project_id).values_list("repo", flat=True))
        return Response({"repos": repos})

    @allow_permission([ROLE.ADMIN])
    def put(self, request, slug, project_id):
        raw = request.data.get("repos")
        if not isinstance(raw, list) or len(raw) > MAX_REPOS:
            return Response({"error": f"repos must be a list of up to {MAX_REPOS}"}, status=status.HTTP_400_BAD_REQUEST)
        repos = []
        for item in raw:
            repo = _normalise_repo(item)
            if repo is None:
                return Response({"error": f"{item!r} is not owner/name"}, status=status.HTTP_400_BAD_REQUEST)
            if repo not in repos:
                repos.append(repo)
        project = Project.objects.get(pk=project_id, workspace__slug=slug)
        with transaction.atomic():
            GithubRepositoryLink.objects.filter(project=project).exclude(repo__in=repos).delete()
            for repo in repos:
                GithubRepositoryLink.objects.get_or_create(project=project, repo=repo)
        return Response({"repos": repos})


class EngineeringMetricsEndpoint(BaseAPIView):
    permission_classes = [ProjectBasePermission]

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        try:
            days = int(request.query_params.get("days", 30))
        except ValueError:
            days = 30
        if days not in ALLOWED_WINDOWS:
            days = 30
        since = timezone.now() - timedelta(days=days)

        repos = list(GithubRepositoryLink.objects.filter(project_id=project_id).values_list("repo", flat=True))
        scope = Q(repo__in=repos) | Q(project_id=project_id)
        workspace_scope = Q(workspace__slug=slug)

        prs = GithubPullRequest.objects.filter(workspace_scope).filter(scope)
        commits = GithubCommit.objects.filter(workspace_scope).filter(scope, committed_at__gte=since)
        for prefix in MERGE_PREFIXES:
            commits = commits.exclude(message__startswith=prefix)

        people = {}

        def person(login):
            key = login or "unknown"
            return people.setdefault(
                key,
                {
                    "login": key,
                    "prs_opened": 0,
                    "prs_merged": 0,
                    "reviews": 0,
                    "commits": 0,
                    "linked_commits": 0,
                    "additions": 0,
                    "deletions": 0,
                    "merge_hours": [],
                },
            )

        repo_totals = {}

        def repo_row(name):
            return repo_totals.setdefault(name, {"repo": name, "prs_opened": 0, "prs_merged": 0, "commits": 0})

        for pr in prs.filter(Q(created_on__gte=since) | Q(merged_at__gte=since)):
            row, repo = person(pr.author_login), repo_row(pr.repo)
            if pr.created_on >= since:
                row["prs_opened"] += 1
                repo["prs_opened"] += 1
            if pr.merged_at and pr.merged_at >= since:
                row["prs_merged"] += 1
                repo["prs_merged"] += 1
                row["additions"] += pr.additions
                row["deletions"] += pr.deletions
                row["merge_hours"].append(max((pr.merged_at - pr.created_on).total_seconds(), 0) / 3600)

        for review in GithubReview.objects.filter(pull_request__in=prs, submitted_at__gte=since).select_related(
            "pull_request"
        ):
            if review.reviewer_login and review.reviewer_login != review.pull_request.author_login:
                person(review.reviewer_login)["reviews"] += 1

        bucket_count = math.ceil(days / 7)
        weekly_commits, weekly_merged = [0] * bucket_count, [0] * bucket_count

        def bucket(moment):
            return min(int((moment - since).total_seconds() // (7 * 86400)), bucket_count - 1)

        for commit in commits:
            row = person(commit.author_login or commit.author_name)
            row["commits"] += 1
            row["linked_commits"] += 1 if commit.issue_id else 0
            repo_row(commit.repo)["commits"] += 1
            weekly_commits[bucket(commit.committed_at)] += 1
        for merged_at in prs.filter(merged_at__gte=since).values_list("merged_at", flat=True):
            weekly_merged[bucket(merged_at)] += 1

        authors = []
        for row in people.values():
            hours = row.pop("merge_hours")
            row["median_merge_hours"] = round(median(hours), 1) if hours else None
            authors.append(row)
        authors.sort(key=lambda r: (-r["prs_merged"], -r["commits"], r["login"]))

        total_commits = sum(r["commits"] for r in authors)
        all_hours = [
            max((m - c).total_seconds(), 0) / 3600
            for c, m in prs.filter(merged_at__gte=since, merged_at__isnull=False).values_list("created_on", "merged_at")
        ]
        return Response(
            {
                "days": days,
                "repos": repos,
                "configured": bool(repos) or prs.exists() or commits.exists(),
                "totals": {
                    "prs_opened": sum(r["prs_opened"] for r in authors),
                    "prs_merged": sum(r["prs_merged"] for r in authors),
                    "reviews": sum(r["reviews"] for r in authors),
                    "commits": total_commits,
                    "linked_commits": sum(r["linked_commits"] for r in authors),
                    "median_merge_hours": round(median(all_hours), 1) if all_hours else None,
                },
                "authors": authors,
                "repo_breakdown": sorted(repo_totals.values(), key=lambda r: -r["commits"] - r["prs_merged"]),
                "weekly": [
                    {
                        "week_start": (since + timedelta(days=7 * i)).date().isoformat(),
                        "commits": weekly_commits[i],
                        "prs_merged": weekly_merged[i],
                    }
                    for i in range(bucket_count)
                ],
            }
        )
