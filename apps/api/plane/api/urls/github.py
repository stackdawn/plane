# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.api.views.github_events import GithubEventsAPIEndpoint

urlpatterns = [
    path(
        "workspaces/<str:slug>/github-events/",
        GithubEventsAPIEndpoint.as_view(http_method_names=["post"]),
        name="github-events",
    ),
]
