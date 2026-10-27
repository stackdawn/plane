/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// components
import { PageHead } from "@/components/core/page-title";
import { DORA_WINDOWS, formatHours } from "@/components/dora/dora-shared";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
import { engineeringService } from "@/services/issue/engineering.service";
import type { Route } from "./+types/page";

const BAR_HEIGHT = 80;
const CELL = "px-3 py-2 text-right text-body-xs-regular text-secondary";

function ProjectEngineeringPage({ params }: Route.ComponentProps) {
  const { workspaceSlug, projectId } = params;
  const [days, setDays] = useState<number>(30);
  const [repoText, setRepoText] = useState<string | null>(null);
  const { getProjectById } = useProject();
  const { allowPermissions } = useUserPermissions();
  const isAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.PROJECT);
  const project = getProjectById(projectId);
  const { data, error, mutate } = useSWR(
    `ENGINEERING_${workspaceSlug}_${projectId}_${days}`,
    () => engineeringService.getMetrics(workspaceSlug, projectId, days),
    { revalidateOnFocus: false }
  );
  const maxWeek = Math.max(1, ...(data?.weekly.flatMap((week) => [week.commits, week.prs_merged]) ?? [1]));

  const saveRepos = async () => {
    const repos = (repoText ?? "")
      .split(/[\n,]/)
      .map((repo) => repo.trim())
      .filter(Boolean);
    try {
      await engineeringService.setRepos(workspaceSlug, projectId, repos);
      setRepoText(null);
      await mutate();
    } catch (saveError) {
      const message = Object.values((saveError ?? {}) as Record<string, string>)[0];
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: message ?? "Could not save the repositories." });
    }
  };

  const totals = data?.totals;
  const tiles = totals
    ? [
        { title: "Pull requests opened", value: totals.prs_opened },
        { title: "Pull requests merged", value: totals.prs_merged },
        { title: "Reviews given", value: totals.reviews },
        { title: "Commits", value: totals.commits, detail: `${totals.linked_commits} linked to a work item` },
        { title: "Median time to merge", value: formatHours(totals.median_merge_hours) },
      ]
    : [];

  return (
    <>
      <PageHead title={project?.name ? `${project.name} - Engineering` : undefined} />
      <div className="mx-auto w-full max-w-6xl py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-h5-semibold text-primary">Engineering activity</h1>
            <p className="text-caption-md-regular text-tertiary">
              Pull requests, reviews and commits from this project&apos;s GitHub repositories. Reported by a GitHub
              workflow, so only repositories that send events appear.
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
            No GitHub activity yet. Add the repositories below, then run the Plane sync workflow in them.
          </div>
        )}

        {data && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
              {tiles.map((tile) => (
                <div key={tile.title} className="rounded-lg border border-subtle bg-layer-2 p-4">
                  <div className="text-caption-md-regular text-tertiary">{tile.title}</div>
                  <div className="mt-1 text-h4-semibold text-primary">{tile.value}</div>
                  {tile.detail && <div className="text-caption-sm-regular text-tertiary">{tile.detail}</div>}
                </div>
              ))}
            </div>

            <div className="mt-4 overflow-x-auto rounded-lg border border-subtle bg-layer-2">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-subtle text-caption-sm-regular text-tertiary">
                    <th className="px-3 py-2">Person (GitHub)</th>
                    {["PRs opened", "PRs merged", "Reviews", "Commits", "Linked", "Median merge", "Lines +/-"].map((h) => (
                      <th key={h} className="px-3 py-2 text-right">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.authors.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-3 py-4 text-caption-md-regular text-tertiary">
                        Nothing in the last {data.days} days.
                      </td>
                    </tr>
                  )}
                  {data.authors.map((author) => (
                    <tr key={author.login} className="border-b border-subtle last:border-0">
                      <td className="px-3 py-2 text-body-xs-medium text-primary">{author.login}</td>
                      <td className={CELL}>{author.prs_opened}</td>
                      <td className={CELL}>{author.prs_merged}</td>
                      <td className={CELL}>{author.reviews}</td>
                      <td className={CELL}>{author.commits}</td>
                      <td className={CELL}>
                        {author.commits ? `${Math.round((author.linked_commits / author.commits) * 100)}%` : "-"}
                      </td>
                      <td className={CELL}>{formatHours(author.median_merge_hours)}</td>
                      <td className={CELL}>
                        +{author.additions} / -{author.deletions}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="rounded-lg border border-subtle bg-layer-2 p-4">
                <div className="text-body-sm-medium text-primary">Per week: commits and merged PRs</div>
                <div className="mt-3 flex items-end gap-2" style={{ height: BAR_HEIGHT + 24 }}>
                  {data.weekly.map((week) => (
                    <div key={week.week_start} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <div className="flex w-full items-end justify-center gap-0.5">
                        <div
                          className="w-3 rounded-sm bg-accent-primary"
                          style={{ height: Math.max(2, Math.round((week.commits / maxWeek) * BAR_HEIGHT)) }}
                          title={`${week.commits} commits`}
                        />
                        <div
                          className="w-3 rounded-sm"
                          style={{
                            backgroundColor: "#30A46C",
                            height: Math.max(2, Math.round((week.prs_merged / maxWeek) * BAR_HEIGHT)),
                          }}
                          title={`${week.prs_merged} PRs merged`}
                        />
                      </div>
                      <span className="text-caption-sm-regular text-tertiary">{week.week_start.slice(5)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-4 text-caption-sm-regular text-tertiary">
                  <span>Blue: commits</span>
                  <span>Green: PRs merged</span>
                </div>
              </div>

              <div className="rounded-lg border border-subtle bg-layer-2 p-4">
                <div className="text-body-sm-medium text-primary">By repository</div>
                <ul className="mt-2 space-y-1 text-body-xs-regular text-secondary">
                  {data.repo_breakdown.length === 0 && <li className="text-tertiary">No activity yet.</li>}
                  {data.repo_breakdown.map((repo) => (
                    <li key={repo.repo} className="flex justify-between">
                      <span className="text-primary">{repo.repo}</span>
                      <span>
                        {repo.commits} commits, {repo.prs_opened} opened, {repo.prs_merged} merged
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-subtle p-4">
              <div className="text-body-sm-medium text-primary">Repositories counted for this project</div>
              <p className="mt-1 text-caption-md-regular text-tertiary">
                Activity in these repositories counts here. Anything that names one of this project&apos;s work items
                (for example DEPRE-123 in a commit message, PR title or branch) also counts, whichever repository it is
                in. Merge commits are not counted.
              </p>
              {isAdmin ? (
                <div className="mt-2 flex flex-col gap-2">
                  <textarea
                    rows={3}
                    value={repoText ?? data.repos.join("\n")}
                    onChange={(event) => setRepoText(event.target.value)}
                    placeholder="stackdawn/presync, one per line"
                    className="rounded-md border border-subtle bg-transparent px-3 py-2 text-body-sm-regular text-primary"
                  />
                  <div>
                    <button
                      type="button"
                      disabled={repoText === null}
                      onClick={saveRepos}
                      className="rounded-md bg-accent-primary px-3 py-1.5 text-body-sm-medium text-on-color disabled:opacity-50"
                    >
                      Save repositories
                    </button>
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-body-xs-regular text-secondary">{data.repos.join(", ") || "None set."}</p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default observer(ProjectEngineeringPage);
