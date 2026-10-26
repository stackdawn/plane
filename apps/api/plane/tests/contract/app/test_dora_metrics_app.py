# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for the project DORA metrics endpoint (fork feature)."""

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import (
    Issue,
    IssueActivity,
    IssueType,
    Project,
    ProjectIssueType,
    ProjectMember,
    State,
)


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Dora", identifier="DOR", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20, is_active=True)
    return project


def _url(slug, project_id, days=30):
    return f"/api/workspaces/{slug}/projects/{project_id}/dora-metrics/?days={days}"


def _state(project, workspace, name, group):
    return State.objects.create(name=name, project=project, workspace=workspace, group=group)


def _move(issue, state, when):
    activity = IssueActivity.objects.create(
        issue=issue,
        project=issue.project,
        workspace=issue.workspace,
        field="state",
        verb="updated",
        new_value=state.name,
        new_identifier=state.id,
    )
    IssueActivity.objects.filter(pk=activity.pk).update(created_at=when)


@pytest.mark.contract
class TestDoraMetrics:
    @pytest.mark.django_db
    def test_not_configured_without_an_in_deployment_state(self, session_client, workspace, project):
        _state(project, workspace, "Todo", "unstarted")
        body = session_client.get(_url(workspace.slug, project.id)).json()
        assert body["configured"] is False
        assert body["deployment_frequency"]["count"] == 0
        assert body["deployment_frequency"]["per_week"] is None
        assert body["lead_time"]["median_hours"] is None

    @pytest.mark.django_db
    def test_metrics_from_deployments_and_bugs(self, session_client, workspace, project):
        now = timezone.now()
        todo = _state(project, workspace, "Todo", "unstarted")
        progress = _state(project, workspace, "In Progress", "started")
        deploying = _state(project, workspace, "In Deployment", "started")
        done = _state(project, workspace, "Done", "completed")

        # two work items: started 3 days / 2 days ago, deployed 1 day ago -> lead 48h and 24h (median 36h)
        for name, started_days in (("a", 3), ("b", 2)):
            issue = Issue.objects.create(name=name, project=project, workspace=workspace, state=todo)
            Issue.objects.filter(pk=issue.pk).update(created_at=now - timedelta(days=5))
            _move(issue, progress, now - timedelta(days=started_days))
            _move(issue, deploying, now - timedelta(days=1))
        # moving into In Deployment twice still counts once
        again = Issue.objects.filter(name="a").first()
        _move(again, deploying, now - timedelta(hours=2))

        bug_type = IssueType.objects.create(workspace=workspace, name="Bug")
        ProjectIssueType.objects.create(project=project, issue_type=bug_type)
        bug = Issue.objects.create(name="bug", project=project, workspace=workspace, state=todo, type=bug_type)
        Issue.objects.filter(pk=bug.pk).update(
            created_at=now - timedelta(hours=10), completed_at=now - timedelta(hours=8)
        )
        assert done  # completed state exists for realism

        body = session_client.get(_url(workspace.slug, project.id)).json()
        assert body["configured"] is True

        frequency = body["deployment_frequency"]
        assert frequency["count"] == 2
        assert frequency["per_week"] == pytest.approx(2 / (30 / 7), abs=0.01)
        assert sum(week["count"] for week in frequency["weekly"]) == 2

        assert body["lead_time"]["sample"] == 2
        assert body["lead_time"]["median_hours"] == pytest.approx(36, abs=0.2)
        assert body["lead_time"]["band"] == "high"

        failure = body["change_failure_rate"]
        assert (failure["bugs"], failure["deployments"]) == (1, 2)
        assert failure["rate"] == pytest.approx(0.5)
        assert failure["band"] == "low"

        restore = body["time_to_restore"]
        assert restore["sample"] == 1
        assert restore["median_hours"] == pytest.approx(2, abs=0.1)
        assert restore["band"] == "high"

    @pytest.mark.django_db
    def test_activity_outside_the_window_is_ignored_and_bad_window_defaults(self, session_client, workspace, project):
        now = timezone.now()
        todo = _state(project, workspace, "Todo", "unstarted")
        deploying = _state(project, workspace, "In Deployment", "started")
        issue = Issue.objects.create(name="old", project=project, workspace=workspace, state=todo)
        _move(issue, deploying, now - timedelta(days=45))

        assert (
            session_client.get(_url(workspace.slug, project.id, days=30)).json()["deployment_frequency"]["count"] == 0
        )
        assert (
            session_client.get(_url(workspace.slug, project.id, days=90)).json()["deployment_frequency"]["count"] == 1
        )
        # an unsupported window falls back to 30 days
        assert session_client.get(_url(workspace.slug, project.id, days=5)).json()["days"] == 30
