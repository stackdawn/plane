/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// components
import { PageHead } from "@/components/core/page-title";
import { BandBadge, DORA_WINDOWS, buildTiles, useDoraMetrics } from "@/components/dora/dora-shared";
// hooks
import { useProject } from "@/hooks/store/use-project";
import type { Route } from "./+types/page";

const BAR_HEIGHT = 96;

function ProjectDoraPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const [days, setDays] = useState<number>(30);
  const { getProjectById } = useProject();
  const project = getProjectById(projectId);
  const { data, error } = useDoraMetrics(workspaceSlug, projectId, days);
  const maxWeekly = Math.max(1, ...(data?.deployment_frequency.weekly.map((week) => week.count) ?? [1]));

  return (
    <>
      <PageHead title={project?.name ? `${project.name} - DORA metrics` : undefined} />
      <div className="mx-auto w-full max-w-5xl py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h5-semibold text-primary">DORA metrics</h1>
            <p className="text-caption-md-regular text-tertiary">
              Estimated from work item history in this project, not from CI/CD or incident tools.
            </p>
          </div>
          <div className="flex gap-1" role="group" aria-label="Time window">
            {DORA_WINDOWS.map((window) => (
              <button
                key={window}
                type="button"
                onClick={() => setDays(window)}
                aria-pressed={days === window}
                className={`rounded-md border px-3 py-1 text-caption-md-medium ${
                  days === window ? "border-accent-strong bg-layer-1 text-primary" : "border-subtle text-secondary"
                }`}
              >
                {window} days
              </button>
            ))}
          </div>
        </div>

        {error && <p className="mt-4 text-body-sm-regular text-danger-primary">Could not load the metrics.</p>}
        {!data && !error && <p className="mt-4 text-body-sm-regular text-tertiary">Loading...</p>}
        {data && !data.configured && (
          <div className="mt-4 rounded-lg border border-subtle p-4 text-body-sm-regular text-secondary">
            This project has no state named &quot;{data.deployment_state}&quot;, so deployments cannot be counted. Add
            one under Project settings, States, and move work items into it as they ship.
          </div>
        )}

        {data && data.configured && (
          <>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {buildTiles(data).map((tile) => (
                <div key={tile.key} className="rounded-lg border border-subtle bg-layer-2 p-4">
                  <div className="flex items-center justify-between text-caption-md-regular text-tertiary">
                    <span>{tile.title}</span>
                    <BandBadge band={tile.band} />
                  </div>
                  <div className="mt-1 text-h4-semibold text-primary">{tile.value}</div>
                  <div className="text-caption-sm-regular text-tertiary">{tile.detail}</div>
                  <p className="mt-2 text-caption-sm-regular text-secondary">{tile.help}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-lg border border-subtle bg-layer-2 p-4">
              <div className="text-body-sm-medium text-primary">Deployments per week</div>
              <div className="mt-3 flex items-end gap-2" style={{ height: BAR_HEIGHT + 20 }}>
                {data.deployment_frequency.weekly.map((week) => (
                  <div key={week.week_start} className="flex flex-1 flex-col items-center justify-end gap-1">
                    <span className="text-caption-sm-regular text-secondary">{week.count}</span>
                    <div
                      className="w-full max-w-10 rounded-sm bg-accent-primary"
                      style={{ height: Math.max(2, Math.round((week.count / maxWeekly) * BAR_HEIGHT)) }}
                      title={`Week of ${week.week_start}: ${week.count}`}
                    />
                    <span className="text-caption-sm-regular text-tertiary">{week.week_start.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-subtle p-4 text-caption-md-regular text-secondary">
              <div className="text-body-sm-medium text-primary">How to read this</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>
                  A deployment is a work item entering &quot;{data.deployment_state}&quot;; a failure is a work item of
                  type &quot;{data.failure_type}&quot;. Change both by renaming the state or the type.
                </li>
                <li>
                  Bands follow the DORA 2023 clusters. Frequency: weekly or better is High, daily is Elite. Lead time:
                  under a day Elite, under a week High, under a month Medium. Failure rate: up to 5% Elite, 10% High,
                  15% Medium. Time to restore: under an hour Elite, under a day High, under a week Medium.
                </li>
                <li>
                  Treat the numbers as a trend for this board, not as a benchmark against other teams: they depend on
                  how consistently work items are moved and typed.
                </li>
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default observer(ProjectDoraPage);
