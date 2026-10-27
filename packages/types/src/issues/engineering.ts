/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TEngineeringAuthor = {
  login: string;
  prs_opened: number;
  prs_merged: number;
  reviews: number;
  commits: number;
  linked_commits: number;
  additions: number;
  deletions: number;
  median_merge_hours: number | null;
};

export type TEngineeringMetrics = {
  days: number;
  repos: string[];
  configured: boolean;
  totals: {
    prs_opened: number;
    prs_merged: number;
    reviews: number;
    commits: number;
    linked_commits: number;
    median_merge_hours: number | null;
  };
  authors: TEngineeringAuthor[];
  repo_breakdown: { repo: string; prs_opened: number; prs_merged: number; commits: number }[];
  weekly: { week_start: string; commits: number; prs_merged: number }[];
};
