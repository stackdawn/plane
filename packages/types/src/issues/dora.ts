/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TDoraBand = "elite" | "high" | "medium" | "low";

export type TDoraMetrics = {
  days: number;
  /** false when the project has no state named after `deployment_state` */
  configured: boolean;
  deployment_state: string;
  failure_type: string;
  deployment_frequency: {
    count: number;
    per_week: number | null;
    weekly: { week_start: string; count: number }[];
    band: TDoraBand | null;
  };
  lead_time: { median_hours: number | null; sample: number; band: TDoraBand | null };
  change_failure_rate: { bugs: number; deployments: number; rate: number | null; band: TDoraBand | null };
  time_to_restore: { median_hours: number | null; sample: number; band: TDoraBand | null };
};
