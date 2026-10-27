# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Third Party imports
from rest_framework import status
from rest_framework.response import Response

# Module imports
from .base import BaseAPIView
from plane.db.models import Workspace, WorkspaceMember
from plane.utils.github_sync import upsert_commits, upsert_pull_request, upsert_reviews

MAX_COMMITS_PER_EVENT = 500


class GithubEventsAPIEndpoint(BaseAPIView):
    """Receives GitHub activity from a GitHub Actions workflow (X-API-Key of a workspace member).

    The workflow sends a normalised payload, not the raw GitHub event:
      {"kind": "pull_request", "repo": "owner/name", "pull_request": {...}, "reviews": [...]}
      {"kind": "review", "repo": "owner/name", "pull_request": {...}, "reviews": [...]}
      {"kind": "push", "repo": "owner/name", "commits": [{"sha", "author_login", "author_name", ...}]}
    """

    def post(self, request, slug):
        workspace = Workspace.objects.filter(slug=slug).first()
        if (
            workspace is None
            or not WorkspaceMember.objects.filter(
                workspace=workspace, member=request.user, is_active=True, role__gte=15
            ).exists()
        ):
            return Response({"error": "Not a member of this workspace"}, status=status.HTTP_403_FORBIDDEN)

        kind = request.data.get("kind")
        repo = (request.data.get("repo") or "").strip()
        if "/" not in repo:
            return Response({"error": "repo must be owner/name"}, status=status.HTTP_400_BAD_REQUEST)

        if kind in ("pull_request", "review"):
            data = request.data.get("pull_request") or {}
            if not data.get("number") or not data.get("created_at"):
                return Response(
                    {"error": "pull_request needs number and created_at"}, status=status.HTTP_400_BAD_REQUEST
                )
            pull_request = upsert_pull_request(workspace.id, repo, data)
            reviews = upsert_reviews(pull_request, request.data.get("reviews"))
            return Response(
                {
                    "kind": kind,
                    "pull_request": pull_request.number,
                    "linked_work_item": bool(pull_request.issue_id),
                    "reviews": reviews,
                }
            )

        if kind == "push":
            commits = request.data.get("commits") or []
            if len(commits) > MAX_COMMITS_PER_EVENT:
                return Response({"error": "Too many commits in one event"}, status=status.HTTP_400_BAD_REQUEST)
            if any(not c.get("sha") or not c.get("timestamp") for c in commits):
                return Response({"error": "Each commit needs sha and timestamp"}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"kind": kind, "commits": upsert_commits(workspace.id, repo, commits)})

        return Response({"error": "kind must be pull_request, review or push"}, status=status.HTTP_400_BAD_REQUEST)
