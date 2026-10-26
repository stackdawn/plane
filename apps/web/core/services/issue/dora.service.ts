/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TDoraMetrics } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class DoraService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getMetrics(workspaceSlug: string, projectId: string, days: number): Promise<TDoraMetrics> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/dora-metrics/`, { params: { days } })
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

export const doraService = new DoraService();
