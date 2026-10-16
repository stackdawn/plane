/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observable, runInAction } from "mobx";
import type { TIssueType } from "@plane/types";
import { issueTypeService } from "@/services/issue/issue_type.service";

/**
 * Observable per-project cache of work item types for code outside React hooks (group-by column builders).
 * Observer components that read it re-render when a project's types arrive.
 */
const typesByProject = observable.map<string, TIssueType[]>();
const inFlight = new Set<string>();

export const getCachedIssueTypes = (workspaceSlug: string | undefined, projectId: string): TIssueType[] | undefined => {
  const cached = typesByProject.get(projectId);
  if (cached === undefined && workspaceSlug && !inFlight.has(projectId)) {
    inFlight.add(projectId);
    issueTypeService
      .list(workspaceSlug, projectId)
      .then((types) => runInAction(() => typesByProject.set(projectId, types)))
      .catch(() => runInAction(() => typesByProject.set(projectId, [])))
      .finally(() => inFlight.delete(projectId));
  }
  return cached;
};

export const setCachedIssueTypes = (projectId: string, types: TIssueType[]) =>
  runInAction(() => typesByProject.set(projectId, types));
