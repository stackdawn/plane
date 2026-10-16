/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { API_BASE_URL } from "@plane/constants";
import type {
  TCustomProperty,
  TCustomPropertyPayload,
  TCustomPropertyValue,
  TIssueCustomProperties,
} from "@plane/types";
// services
import { APIService } from "@/services/api.service";

export class CustomPropertyService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  private base(workspaceSlug: string, projectId: string) {
    return `/api/workspaces/${workspaceSlug}/projects/${projectId}/custom-properties/`;
  }

  async list(workspaceSlug: string, projectId: string): Promise<TCustomProperty[]> {
    return this.get(this.base(workspaceSlug, projectId))
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async create(workspaceSlug: string, projectId: string, data: TCustomPropertyPayload): Promise<TCustomProperty> {
    return this.post(this.base(workspaceSlug, projectId), data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async update(
    workspaceSlug: string,
    projectId: string,
    propertyId: string,
    data: TCustomPropertyPayload
  ): Promise<TCustomProperty> {
    return this.patch(`${this.base(workspaceSlug, projectId)}${propertyId}/`, data)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async remove(workspaceSlug: string, projectId: string, propertyId: string): Promise<void> {
    return this.delete(`${this.base(workspaceSlug, projectId)}${propertyId}/`)
      .then(() => undefined)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async getValues(workspaceSlug: string, projectId: string, issueId: string): Promise<TIssueCustomProperties> {
    return this.get(`/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/custom-property-values/`)
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }

  async setValues(
    workspaceSlug: string,
    projectId: string,
    issueId: string,
    values: Record<string, TCustomPropertyValue>
  ): Promise<TIssueCustomProperties> {
    return this.patch(
      `/api/workspaces/${workspaceSlug}/projects/${projectId}/issues/${issueId}/custom-property-values/`,
      { values }
    )
      .then((response) => response?.data)
      .catch((error) => {
        throw error?.response?.data;
      });
  }
}

export const customPropertyService = new CustomPropertyService();
