/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type { TIssueType, TIssueTypePayload } from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class IssueTypeService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private base(workspaceSlug: string, projectId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/issue-types/`;
  }

  async list(workspaceSlug: string, projectId: string): Promise<TIssueType[]> {
    return this.get(this.base(workspaceSlug, projectId))
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, data: TIssueTypePayload): Promise<TIssueType> {
    return this.post(this.base(workspaceSlug, projectId), data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    issueTypeId: string,
    data: TIssueTypePayload
  ): Promise<TIssueType> {
    return this.patch(`${this.base(workspaceSlug, projectId)}${issueTypeId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async remove(workspaceSlug: string, projectId: string, issueTypeId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}${issueTypeId}/`)
      .then(() => undefined)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

export const issueTypeService = new IssueTypeService();
