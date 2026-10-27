/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TEngineeringMetrics } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class EngineeringService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getMetrics(workspaceSlug: string, projectId: string, days: number): Promise<TEngineeringMetrics> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/engineering-metrics/`, { params: { days } })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getRepos(workspaceSlug: string, projectId: string): Promise<string[]> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/github-repos/`)
      .then((response) => response?.data?.repos ?? [])
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async setRepos(workspaceSlug: string, projectId: string, repos: string[]): Promise<string[]> {
    return this.put(`/api/workspaces/${workspaceSlug}/projects/${projectId}/github-repos/`, { repos })
      .then((response) => response?.data?.repos ?? [])
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

export const engineeringService = new EngineeringService();
