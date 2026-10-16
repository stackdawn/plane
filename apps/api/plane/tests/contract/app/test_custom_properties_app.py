# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Contract tests for project custom properties and their per-work-item values (fork feature)."""

import json

import pytest
from rest_framework import status

from plane.db.models import Issue, IssueType, Project, ProjectIssueType, ProjectMember, State, User


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="Props", identifier="PRP", workspace=workspace)
    ProjectMember.objects.create(workspace=workspace, project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def issue(db, workspace, project):
    state = State.objects.create(name="Todo", project=project, workspace=workspace, group="unstarted")
    return Issue.objects.create(name="x", project=project, workspace=workspace, state=state)


def _props(slug, project_id, pk=None):
    base = f"/api/workspaces/{slug}/projects/{project_id}/custom-properties/"
    return f"{base}{pk}/" if pk else base


def _values(slug, project_id, issue_id):
    return f"/api/workspaces/{slug}/projects/{project_id}/issues/{issue_id}/custom-property-values/"


def _create(client, workspace, project, **body):
    return client.post(_props(workspace.slug, project.id), body, format="json")


@pytest.mark.contract
class TestCustomProperties:
    @pytest.mark.django_db
    @pytest.mark.parametrize("property_type", ["text", "number", "person"])
    def test_create_simple_types(self, session_client, workspace, project, property_type):
        response = _create(session_client, workspace, project, name="QA Assistant", property_type=property_type)
        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["property_type"] == property_type

    @pytest.mark.django_db
    def test_select_requires_options(self, session_client, workspace, project):
        response = _create(session_client, workspace, project, name="Area", property_type="select")
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_duplicate_name_rejected(self, session_client, workspace, project):
        _create(session_client, workspace, project, name="Env", property_type="text")
        again = _create(session_client, workspace, project, name="env", property_type="text")
        assert again.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_type_cannot_change_and_options_are_replaced(self, session_client, workspace, project):
        created = _create(
            session_client,
            workspace,
            project,
            name="Area",
            property_type="select",
            options=[{"name": "UI"}, {"name": "API"}],
        ).json()
        assert [o["name"] for o in created["options"]] == ["UI", "API"]

        locked = session_client.patch(
            _props(workspace.slug, project.id, created["id"]), {"property_type": "text"}, format="json"
        )
        assert locked.status_code == status.HTTP_400_BAD_REQUEST

        keep = created["options"][0]
        updated = session_client.patch(
            _props(workspace.slug, project.id, created["id"]),
            {"options": [{"id": keep["id"], "name": "Frontend"}, {"name": "Data"}]},
            format="json",
        ).json()
        assert [o["name"] for o in updated["options"]] == ["Frontend", "Data"]
        assert updated["options"][0]["id"] == keep["id"]


@pytest.mark.contract
class TestCustomPropertyValues:
    @pytest.mark.django_db
    def test_set_and_read_all_property_kinds(self, session_client, workspace, project, issue, create_user):
        text = _create(session_client, workspace, project, name="QA Assistant", property_type="text").json()
        number = _create(session_client, workspace, project, name="Points", property_type="number").json()
        person = _create(session_client, workspace, project, name="Owner", property_type="person").json()
        select = _create(
            session_client, workspace, project, name="Area", property_type="select", options=[{"name": "UI"}]
        ).json()
        multi = _create(
            session_client,
            workspace,
            project,
            name="Browsers",
            property_type="multi_select",
            options=[{"name": "Chrome"}, {"name": "Safari"}],
        ).json()

        response = session_client.patch(
            _values(workspace.slug, project.id, issue.id),
            {
                "values": {
                    text["id"]: "Priya",
                    number["id"]: "3.5",
                    person["id"]: str(create_user.id),
                    select["id"]: select["options"][0]["id"],
                    multi["id"]: [o["id"] for o in multi["options"]],
                }
            },
            format="json",
        )
        assert response.status_code == status.HTTP_200_OK
        values = response.json()["values"]
        assert values[text["id"]] == "Priya"
        assert values[number["id"]] == 3.5
        assert values[person["id"]] == str(create_user.id)
        assert values[select["id"]] == select["options"][0]["id"]
        assert sorted(values[multi["id"]]) == sorted(o["id"] for o in multi["options"])

        reread = session_client.get(_values(workspace.slug, project.id, issue.id)).json()
        assert reread["values"] == values

        cleared = session_client.patch(
            _values(workspace.slug, project.id, issue.id), {"values": {text["id"]: None}}, format="json"
        ).json()
        assert cleared["values"][text["id"]] is None

    @pytest.mark.django_db
    def test_project_wide_values_for_cards(self, session_client, workspace, project, issue):
        text = _create(session_client, workspace, project, name="QA Assistant", property_type="text").json()
        session_client.patch(
            _values(workspace.slug, project.id, issue.id), {"values": {text["id"]: "Priya"}}, format="json"
        )

        response = session_client.get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/custom-property-values/")

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        assert [p["name"] for p in body["properties"]] == ["QA Assistant"]
        assert body["values"][str(issue.id)] == {text["id"]: "Priya"}

    @pytest.mark.django_db
    def test_invalid_values_are_rejected(self, session_client, workspace, project, issue):
        number = _create(session_client, workspace, project, name="Points", property_type="number").json()
        person = _create(session_client, workspace, project, name="Owner", property_type="person").json()
        select = _create(
            session_client, workspace, project, name="Area", property_type="select", options=[{"name": "UI"}]
        ).json()
        stranger = User.objects.create(email="outsider@plane.so", username="outsider")
        other = _create(
            session_client, workspace, project, name="Other", property_type="select", options=[{"name": "Z"}]
        ).json()

        for prop_id, bad in [
            (number["id"], "abc"),
            (person["id"], str(stranger.id)),
            (select["id"], other["options"][0]["id"]),
        ]:
            response = session_client.patch(
                _values(workspace.slug, project.id, issue.id), {"values": {prop_id: bad}}, format="json"
            )
            assert response.status_code == status.HTTP_400_BAD_REQUEST, (prop_id, bad)

    @pytest.mark.django_db
    def test_property_scoped_to_a_type_only_applies_to_that_type(self, session_client, workspace, project, issue):
        bug = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-types/", {"name": "Bug"}, format="json"
        ).json()
        scoped = _create(
            session_client, workspace, project, name="Repro steps", property_type="text", issue_type=bug["id"]
        ).json()

        untyped = session_client.get(_values(workspace.slug, project.id, issue.id)).json()
        assert scoped["id"] not in untyped["values"]

        issue.type_id = bug["id"]
        issue.save()
        typed = session_client.get(_values(workspace.slug, project.id, issue.id)).json()
        assert scoped["id"] in typed["values"]

    @pytest.mark.django_db
    def test_issue_type_from_another_project_rejected_for_property(
        self, session_client, workspace, project, create_user
    ):
        other = Project.objects.create(name="Other", identifier="OTX", workspace=workspace)
        foreign = IssueType.objects.create(workspace=workspace, name="Bug")
        ProjectIssueType.objects.create(project=other, issue_type=foreign)
        response = _create(
            session_client, workspace, project, name="X", property_type="text", issue_type=str(foreign.id)
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    @pytest.mark.django_db
    def test_delete_property_removes_values(self, session_client, workspace, project, issue):
        text = _create(session_client, workspace, project, name="Note", property_type="text").json()
        session_client.patch(
            _values(workspace.slug, project.id, issue.id), {"values": {text["id"]: "hi"}}, format="json"
        )
        deleted = session_client.delete(_props(workspace.slug, project.id, text["id"]))
        assert deleted.status_code == status.HTTP_204_NO_CONTENT
        assert text["id"] not in session_client.get(_values(workspace.slug, project.id, issue.id)).json()["values"]


@pytest.mark.contract
class TestGroupAndFilterByType:
    @pytest.mark.django_db
    @pytest.mark.parametrize("style", ["legacy", "rich"])
    def test_filter_by_type(self, session_client, workspace, project, issue, style):
        bug = session_client.post(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/issue-types/", {"name": "Bug"}, format="json"
        ).json()
        typed = Issue.objects.create(
            name="typed", project=project, workspace=workspace, state=issue.state, type_id=bug["id"]
        )
        params = {"per_page": 50}
        if style == "legacy":
            params["issue_type"] = bug["id"]
        else:
            params["filters"] = json.dumps({"type_id__in": [bug["id"]]})

        response = session_client.get(f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/", params)

        assert response.status_code == status.HTTP_200_OK
        body = response.json()
        rows = body.get("results", body)
        ids = {str(r["id"]) for r in rows if isinstance(r, dict)}
        assert str(typed.id) in ids and str(issue.id) not in ids

    @pytest.mark.django_db
    def test_group_by_type_id_is_accepted(self, session_client, workspace, project, issue):
        response = session_client.get(
            f"/api/workspaces/{workspace.slug}/projects/{project.id}/issues/",
            {"group_by": "type_id", "per_page": 50},
        )
        assert response.status_code == status.HTTP_200_OK
