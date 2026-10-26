/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
// hooks
import { useProject } from "@/hooks/store/use-project";
// local imports
import { BandBadge, DORA_WINDOWS, buildTiles, useDoraMetrics } from "./dora-shared";

const STORAGE_KEY = "plane_dora_strip";
const read = (): { collapsed: boolean; days: number } => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
    return { collapsed: !!parsed.collapsed, days: DORA_WINDOWS.includes(parsed.days) ? parsed.days : 30 };
  } catch {
    return { collapsed: false, days: 30 };
  }
};

/** Four compact DORA tiles above the board, collapsible, with a link to the detail page. */
export const DoraStrip = observer(function DoraStrip(props: { workspaceSlug: string; projectId: string }) {
  const { workspaceSlug, projectId } = props;
  const { getProjectById } = useProject();
  const [prefs, setPrefs] = useState(read);
  const isEnabled = !!getProjectById(projectId)?.is_issue_type_enabled;
  const { data } = useDoraMetrics(workspaceSlug, isEnabled ? projectId : undefined, prefs.days);

  const update = (next: { collapsed: boolean; days: number }) => {
    setPrefs(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage unavailable: preference just is not remembered
    }
  };

  if (!isEnabled) return null;

  return (
    <div className="border-b border-subtle bg-surface-1 px-page-x py-2">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="text-caption-md-medium text-secondary"
          onClick={() => update({ ...prefs, collapsed: !prefs.collapsed })}
          aria-expanded={!prefs.collapsed}
        >
          {prefs.collapsed ? "▸" : "▾"} DORA metrics
        </button>
        <div className="flex items-center gap-3">
          <select
            aria-label="DORA window"
            value={prefs.days}
            onChange={(event) => update({ ...prefs, days: Number(event.target.value) })}
            className="rounded-md border border-subtle bg-transparent px-1.5 py-0.5 text-caption-sm-regular text-secondary"
          >
            {DORA_WINDOWS.map((days) => (
              <option key={days} value={days}>
                Last {days} days
              </option>
            ))}
          </select>
          <Link
            href={`/${workspaceSlug}/projects/${projectId}/dora`}
            className="text-caption-md-medium text-accent-primary"
          >
            Details
          </Link>
        </div>
      </div>
      {!prefs.collapsed && (
        <div className="mt-2 grid grid-cols-2 gap-2 lg:grid-cols-4">
          {!data && <div className="col-span-full text-caption-md-regular text-tertiary">Loading...</div>}
          {data && !data.configured && (
            <div className="col-span-full text-caption-md-regular text-tertiary">
              Add a state named &quot;{data.deployment_state}&quot; to this project to track deployments.
            </div>
          )}
          {data &&
            data.configured &&
            buildTiles(data).map((tile) => (
              <div key={tile.key} title={tile.help} className="rounded-md border border-subtle bg-layer-2 px-3 py-2">
                <div className="flex items-center justify-between text-caption-sm-regular text-tertiary">
                  <span>{tile.title}</span>
                  <BandBadge band={tile.band} />
                </div>
                <div className="text-body-md-medium text-primary">{tile.value}</div>
                <div className="truncate text-caption-sm-regular text-tertiary">{tile.detail}</div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
});
