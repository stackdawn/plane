# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""DORA metrics for a project, derived from work item history.

These are proxies: Plane has no deploy or incident events, so
- a *deployment* is a work item entering the state named "In Deployment",
- a *failure* is a work item of type "Bug",
- lead time runs from the first move into a "started" state (or creation) to deployment,
- time to restore runs from a Bug's creation to its completion.
"""

# Python imports
import math
from datetime import timedelta
from statistics import median

# Django imports
from django.utils import timezone

# Third Party imports
from rest_framework.response import Response

# Module imports
from .. import BaseAPIView
from plane.app.permissions import ROLE, ProjectBasePermission, allow_permission
from plane.db.models import Issue, IssueActivity, State

DEPLOY_STATE_NAME = "In Deployment"
FAILURE_TYPE_NAME = "Bug"
ALLOWED_WINDOWS = (7, 30, 90)

# Bands follow the DORA 2023 "State of DevOps" clusters, applied to our proxies.
BANDS = ("elite", "high", "medium", "low")


def _band_frequency(per_week):
    if per_week is None:
        return None
    if per_week >= 7:
        return "elite"  # about daily or more
    if per_week >= 1:
        return "high"  # at least weekly
    if per_week >= 0.25:
        return "medium"  # at least monthly
    return "low"


def _band_lead_time(hours):
    if hours is None:
        return None
    if hours < 24:
        return "elite"
    if hours < 24 * 7:
        return "high"
    if hours < 24 * 30:
        return "medium"
    return "low"


def _band_failure_rate(rate):
    if rate is None:
        return None
    if rate <= 0.05:
        return "elite"
    if rate <= 0.10:
        return "high"
    if rate <= 0.15:
        return "medium"
    return "low"


def _band_restore(hours):
    if hours is None:
        return None
    if hours < 1:
        return "elite"
    if hours < 24:
        return "high"
    if hours < 24 * 7:
        return "medium"
    return "low"


def _hours(delta):
    return max(delta.total_seconds(), 0) / 3600


class DoraMetricsEndpoint(BaseAPIView):
    permission_classes = [ProjectBasePermission]

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST])
    def get(self, request, slug, project_id):
        try:
            days = int(request.query_params.get("days", 30))
        except ValueError:
            days = 30
        if days not in ALLOWED_WINDOWS:
            days = 30
        now = timezone.now()
        since = now - timedelta(days=days)

        deploy_state_ids = list(
            State.objects.filter(project_id=project_id, name__iexact=DEPLOY_STATE_NAME).values_list("id", flat=True)
        )
        started_state_ids = list(
            State.objects.filter(project_id=project_id, group="started").values_list("id", flat=True)
        )

        # first entry into "In Deployment" per work item inside the window
        first_deploy = {}
        if deploy_state_ids:
            rows = IssueActivity.objects.filter(
                project_id=project_id,
                field="state",
                new_identifier__in=deploy_state_ids,
                created_at__gte=since,
                issue__isnull=False,
                issue__deleted_at__isnull=True,
            ).order_by("created_at")
            for row in rows:
                first_deploy.setdefault(row.issue_id, row.created_at)

        # lead time: first "started" move before the deployment, else creation
        lead_hours = []
        if first_deploy:
            created = dict(Issue.objects.filter(pk__in=first_deploy.keys()).values_list("id", "created_at"))
            started = {}
            for row in IssueActivity.objects.filter(
                project_id=project_id,
                field="state",
                new_identifier__in=started_state_ids,
                issue_id__in=first_deploy.keys(),
            ).order_by("created_at"):
                started.setdefault(row.issue_id, row.created_at)
            for issue_id, deployed_at in first_deploy.items():
                begin = started.get(issue_id)
                if begin is None or begin > deployed_at:
                    begin = created.get(issue_id)
                if begin:
                    lead_hours.append(_hours(deployed_at - begin))

        deployments = len(first_deploy)
        weeks = max(days / 7, 1)
        per_week = round(deployments / weeks, 2) if deploy_state_ids else None

        bucket_count = math.ceil(days / 7)
        buckets = [0] * bucket_count
        for deployed_at in first_deploy.values():
            index = min(int((deployed_at - since).total_seconds() // (7 * 86400)), bucket_count - 1)
            buckets[index] += 1
        weekly = [
            {"week_start": (since + timedelta(days=7 * i)).date().isoformat(), "count": count}
            for i, count in enumerate(buckets)
        ]

        bugs = Issue.objects.filter(project_id=project_id, type__name__iexact=FAILURE_TYPE_NAME)
        bugs_raised = bugs.filter(created_at__gte=since).count()
        failure_rate = None
        if deployments:
            failure_rate = round(min(bugs_raised / deployments, 1.0), 4)

        restore_hours = [
            _hours(completed - created)
            for created, completed in bugs.filter(completed_at__gte=since, completed_at__isnull=False).values_list(
                "created_at", "completed_at"
            )
        ]

        lead_median = round(median(lead_hours), 1) if lead_hours else None
        restore_median = round(median(restore_hours), 1) if restore_hours else None
        return Response(
            {
                "days": days,
                "configured": bool(deploy_state_ids),
                "deployment_state": DEPLOY_STATE_NAME,
                "failure_type": FAILURE_TYPE_NAME,
                "deployment_frequency": {
                    "count": deployments,
                    "per_week": per_week,
                    "weekly": weekly,
                    "band": _band_frequency(per_week),
                },
                "lead_time": {
                    "median_hours": lead_median,
                    "sample": len(lead_hours),
                    "band": _band_lead_time(lead_median),
                },
                "change_failure_rate": {
                    "bugs": bugs_raised,
                    "deployments": deployments,
                    "rate": failure_rate,
                    "band": _band_failure_rate(failure_rate),
                },
                "time_to_restore": {
                    "median_hours": restore_median,
                    "sample": len(restore_hours),
                    "band": _band_restore(restore_median),
                },
            }
        )
