# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for GitHub event ingest and the project engineering metrics (fork feature)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import GithubCommit, GithubPullRequest, Issue, Project, ProjectMember, State


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Presales", identifier="DEPRE", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def work_item(db, workspace, project):
    state = State.objects.create(name="Todo", project=project, workspace=workspace, group="unstarted")
    return Issue.objects.create(name="Deck agent", project=project, workspace=workspace, state=state)


def _iso(days_ago, hours=0):
    return (timezone.now() - timedelta(days=days_ago, hours=hours)).isoformat()


def _events(slug):
    return f"/api/v1/workspaces/{slug}/github-events/"


def _metrics(slug, project_id, days=30):
    return f"/api/workspaces/{slug}/projects/{project_id}/engineering-metrics/?days={days}"


def _pr_event(number, author, created, merged=None, title="x", additions=10):
    pr = {
        "number": number,
        "title": title,
        "author": author,
        "html_url": f"https://github.com/stackdawn/presync/pull/{number}",
        "head_ref": f"feat/{number}",
        "created_at": created,
        "additions": additions,
        "deletions": 2,
        "changed_files": 1,
    }
    if merged:
        pr["merged_at"] = merged
    return {"kind": "pull_request", "repo": "stackdawn/presync", "pull_request": pr}


@pytest.mark.contract
class TestGithubEvents:
    @pytest.mark.django_db
    def test_pull_request_is_upserted_and_linked_to_the_work_item(self, api_key_client, workspace, project, work_item):
        number = work_item.sequence_id
        body = _pr_event(7, "rithwik", _iso(3), title=f"DEPRE-{number}: outline review")
        first = api_key_client.post(_events(workspace.slug), body, format="json")
        assert first.status_code == status.HTTP_200_OK
        assert first.json()["linked_work_item"] is True

        # same PR again, now merged: updates in place
        body["pull_request"]["merged_at"] = _iso(1)
        api_key_client.post(_events(workspace.slug), body, format="json")
        assert GithubPullRequest.objects.count() == 1
        pr = GithubPullRequest.objects.get()
        assert (pr.state, pr.issue_id, pr.project_id) == ("merged", work_item.id, project.id)

    @pytest.mark.django_db
    def test_push_stores_commits_once_and_links_by_key(self, api_key_client, workspace, project, work_item):
        commit = {
            "sha": "a" * 40,
            "author_login": "srikanth-doddi",
            "author_name": "Sri",
            "message": f"feat: thing (DEPRE-{work_item.sequence_id})\n\nbody",
            "timestamp": _iso(1),
        }
        event = {"kind": "push", "repo": "stackdawn/presync", "commits": [commit]}
        assert api_key_client.post(_events(workspace.slug), event, format="json").json()["commits"] == 1
        api_key_client.post(_events(workspace.slug), event, format="json")
        stored = GithubCommit.objects.get()
        assert stored.issue_id == work_item.id
        assert stored.message.startswith("feat: thing")

    @pytest.mark.django_db
    def test_bad_requests_are_rejected(self, api_key_client, workspace):
        assert (
            api_key_client.post(_events(workspace.slug), {"kind": "nope", "repo": "a/b"}, format="json").status_code
            == 400
        )
        assert (
            api_key_client.post(_events(workspace.slug), {"kind": "push", "repo": "noslash"}, format="json").status_code
            == 400
        )
        assert (
            api_key_client.post(
                _events(workspace.slug), {"kind": "push", "repo": "a/b", "commits": [{"sha": "x"}]}, format="json"
            ).status_code
            == 400
        )

    @pytest.mark.django_db
    def test_non_member_cannot_post(self, api_key_client, workspace):
        from plane.db.models import WorkspaceMember

        WorkspaceMember.objects.filter(workspace=workspace).update(is_active=False)
        response = api_key_client.post(
            _events(workspace.slug), {"kind": "push", "repo": "a/b", "commits": []}, format="json"
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.contract
class TestEngineeringMetrics:
    @pytest.mark.django_db
    def test_repos_can_be_set_and_validated(self, session_client, workspace, project):
        url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/github-repos/"
        ok = session_client.put(
            url, {"repos": ["StackDawn/Presync", "https://github.com/stackdawn/skill-hub"]}, format="json"
        )
        assert ok.status_code == status.HTTP_200_OK
        assert session_client.get(url).json()["repos"] == ["stackdawn/presync", "stackdawn/skill-hub"]
        assert session_client.put(url, {"repos": ["not a repo"]}, format="json").status_code == 400
        # replacing removes the repos that are gone
        session_client.put(url, {"repos": ["stackdawn/presync"]}, format="json")
        assert session_client.get(url).json()["repos"] == ["stackdawn/presync"]

    @pytest.mark.django_db
    def test_metrics_per_author_and_totals(self, api_key_client, session_client, workspace, project):
        session_client.put(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/github-repos/",
            {"repos": ["stackdawn/presync"]},
            format="json",
        )
        # rithwik: 2 PRs opened, 1 merged after 10 h; shivudu: 1 PR opened and still open; one PR outside the window
        api_key_client.post(
            _events(workspace.slug), _pr_event(1, "rithwik", _iso(5, 10), merged=_iso(5)), format="json"
        )
        api_key_client.post(_events(workspace.slug), _pr_event(2, "rithwik", _iso(4)), format="json")
        api_key_client.post(_events(workspace.slug), _pr_event(3, "shivudu", _iso(3)), format="json")
        api_key_client.post(_events(workspace.slug), _pr_event(4, "rithwik", _iso(60)), format="json")
        # a review by shivudu on PR 1 (and a self-review that must not count)
        review_event = _pr_event(1, "rithwik", _iso(5, 10), merged=_iso(5))
        review_event["kind"] = "review"
        review_event["reviews"] = [
            {"id": 11, "reviewer": "shivudu", "state": "APPROVED", "submitted_at": _iso(5, 1)},
            {"id": 12, "reviewer": "rithwik", "state": "COMMENTED", "submitted_at": _iso(5, 2)},
        ]
        api_key_client.post(_events(workspace.slug), review_event, format="json")
        commits = [
            {"sha": f"{i:040d}", "author_login": "srikanth-doddi", "message": "work", "timestamp": _iso(2)}
            for i in range(3)
        ] + [
            {
                "sha": "f" * 40,
                "author_login": "srikanth-doddi",
                "message": "Merge pull request #1 from x",
                "timestamp": _iso(2),
            }
        ]
        api_key_client.post(
            _events(workspace.slug), {"kind": "push", "repo": "stackdawn/presync", "commits": commits}, format="json"
        )
        # activity in an unrelated repo is ignored
        api_key_client.post(
            _events(workspace.slug),
            {
                "kind": "push",
                "repo": "stackdawn/other",
                "commits": [{"sha": "e" * 40, "author_login": "x", "message": "m", "timestamp": _iso(1)}],
            },
            format="json",
        )

        body = session_client.get(_metrics(workspace.slug, project.id)).json()
        assert body["configured"] is True
        by_login = {a["login"]: a for a in body["authors"]}
        assert by_login["rithwik"]["prs_opened"] == 2  # PR 4 is outside the window
        assert by_login["rithwik"]["prs_merged"] == 1
        assert by_login["rithwik"]["median_merge_hours"] == pytest.approx(10, abs=0.1)
        assert by_login["rithwik"]["additions"] == 10
        assert by_login["shivudu"]["prs_opened"] == 1
        assert by_login["shivudu"]["reviews"] == 1  # the author's own review is not counted
        assert by_login["rithwik"]["reviews"] == 0
        assert by_login["srikanth-doddi"]["commits"] == 3  # merge commit excluded
        assert "x" not in by_login
        totals = body["totals"]
        assert (totals["prs_opened"], totals["prs_merged"], totals["reviews"], totals["commits"]) == (3, 1, 1, 3)
        assert body["authors"][0]["login"] == "rithwik"  # most merged PRs first
        assert sum(w["commits"] for w in body["weekly"]) == 3

    @pytest.mark.django_db
    def test_linked_activity_counts_without_a_repo_mapping(
        self, api_key_client, session_client, workspace, project, work_item
    ):
        api_key_client.post(
            _events(workspace.slug),
            {
                "kind": "push",
                "repo": "stackdawn/anything",
                "commits": [
                    {
                        "sha": "b" * 40,
                        "author_login": "sri",
                        "message": f"DEPRE-{work_item.sequence_id} fix",
                        "timestamp": _iso(1),
                    }
                ],
            },
            format="json",
        )
        body = session_client.get(_metrics(workspace.slug, project.id)).json()
        assert body["totals"]["commits"] == 1
        assert body["totals"]["linked_commits"] == 1
