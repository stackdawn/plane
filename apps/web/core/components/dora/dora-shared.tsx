/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
import type { TDoraBand, TDoraMetrics } from "@plane/types";
import { doraService } from "@/services/issue/dora.service";

export const DORA_WINDOWS = [7, 30, 90] as const;

export const useDoraMetrics = (workspaceSlug: string | undefined, projectId: string | undefined, days: number) =>
  useSWR<TDoraMetrics>(
    workspaceSlug && projectId ? `DORA_${workspaceSlug}_${projectId}_${days}` : null,
    () => doraService.getMetrics(workspaceSlug as string, projectId as string, days),
    { revalidateOnFocus: false, dedupingInterval: 60_000 }
  );

const BAND_STYLE: Record<TDoraBand, { label: string; color: string }> = {
  elite: { label: "Elite", color: "#30A46C" },
  high: { label: "High", color: "#3E63DD" },
  medium: { label: "Medium", color: "#F76B15" },
  low: { label: "Low", color: "#E5484D" },
};

export function BandBadge({ band }: { band: TDoraBand | null }) {
  if (!band) return <span className="text-caption-sm-regular text-tertiary">no data</span>;
  const { label, color } = BAND_STYLE[band];
  return (
    <span
      className="rounded-sm px-1.5 py-0.5 text-caption-sm-medium"
      style={{ backgroundColor: `${color}22`, color }}
      title="DORA performance band, using these proxies"
    >
      {label}
    </span>
  );
}

export const formatHours = (hours: number | null): string => {
  if (hours === null) return "-";
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round((hours / 24) * 10) / 10} d`;
};

export const formatPerWeek = (perWeek: number | null): string => (perWeek === null ? "-" : `${perWeek} / week`);

export const formatPercent = (rate: number | null): string => (rate === null ? "-" : `${Math.round(rate * 100)}%`);

export type TTile = {
  key: string;
  title: string;
  value: string;
  detail: string;
  band: TDoraBand | null;
  help: string;
};

/** The four DORA tiles as display data, shared by the board strip and the detail page. */
export const buildTiles = (data: TDoraMetrics): TTile[] => [
  {
    key: "frequency",
    title: "Deployment frequency",
    value: formatPerWeek(data.deployment_frequency.per_week),
    detail: `${data.deployment_frequency.count} entered ${data.deployment_state}`,
    band: data.deployment_frequency.band,
    help: `Work items that entered "${data.deployment_state}" in the last ${data.days} days, per week.`,
  },
  {
    key: "lead",
    title: "Lead time for changes",
    value: formatHours(data.lead_time.median_hours),
    detail: `median of ${data.lead_time.sample} items`,
    band: data.lead_time.band,
    help: `Median time from a work item first moving to a started state (or being created) until it entered "${data.deployment_state}".`,
  },
  {
    key: "failure",
    title: "Change failure rate",
    value: formatPercent(data.change_failure_rate.rate),
    detail: `${data.change_failure_rate.bugs} ${data.failure_type}s raised / ${data.change_failure_rate.deployments} deployed`,
    band: data.change_failure_rate.band,
    help: `${data.failure_type} work items raised in the window divided by deployments in the window, capped at 100%.`,
  },
  {
    key: "restore",
    title: "Time to restore",
    value: formatHours(data.time_to_restore.median_hours),
    detail: `median of ${data.time_to_restore.sample} fixed ${data.failure_type}s`,
    band: data.time_to_restore.band,
    help: `Median time from a ${data.failure_type} being created until it was completed, for ${data.failure_type}s completed in the window.`,
  },
];
