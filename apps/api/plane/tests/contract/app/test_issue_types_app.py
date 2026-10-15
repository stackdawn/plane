# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for project-scoped work item types (fork feature)."""

import pytest
from rest_framework import status

from plane.db.models import Issue, IssueType, Project, ProjectMember, State, ensure_default_issue_type


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Types", identifier="TYP", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20, is_active=True)
    return project


def _url(slug, project_id, pk=None):
    base = f"/api/workspaces/{slug}/projects/{project_id}/issue-types/"
    return f"{base}{pk}/" if pk else base


@pytest.mark.contract
class TestIssueTypes:
    @pytest.mark.django_db
    def test_create_list_and_default(self, session_client, workspace, project):
        ensure_default_issue_type(project)
        created = session_client.post(_url(workspace.slug, project.id), {"name": "Bug"}, format="json")
        assert created.status_code == status.HTTP_201_CREATED

        listed = session_client.get(_url(workspace.slug, project.id))
        assert listed.status_code == status.HTTP_200_OK
        names = [item["name"] for item in listed.json()]
        assert names == ["Task", "Bug"]  # default first

    @pytest.mark.django_db
    def test_duplicate_name_rejected_case_insensitively(self, session_client, workspace, project):
        session_client.post(_url(workspace.slug, project.id), {"name": "Bug"}, format="json")
        again = session_client.post(_url(workspace.slug, project.id), {"name": "bug"}, format="json")
        assert again.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_default_type_cannot_be_deleted(self, session_client, workspace, project):
        default = ensure_default_issue_type(project)
        response = session_client.delete(_url(workspace.slug, project.id, default.id))
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_delete_resets_items_to_no_type(self, session_client, workspace, project, create_user):
        created = session_client.post(_url(workspace.slug, project.id), {"name": "Bug"}, format="json").json()
        state = State.objects.create(name="Todo", project=project, workspace=workspace, group="unstarted")
        issue = Issue.objects.create(name="x", project=project, workspace=workspace, state=state, type_id=created["id"])

        response = session_client.delete(_url(workspace.slug, project.id, created["id"]))

        assert response.status_code == status.HTTP_204_NO_CONTENT
        issue.refresh_from_db()
        assert issue.type_id is None

    @pytest.mark.django_db
    def test_enabling_feature_creates_default_type(self, session_client, workspace, project):
        response = session_client.patch(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/",
            {"is_issue_type_enabled": True},
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        assert IssueType.objects.filter(project_issue_types__project=project, is_default=True).count() == 1
