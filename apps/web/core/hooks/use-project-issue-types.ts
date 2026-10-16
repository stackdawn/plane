/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import useSWR from "swr";
// plane imports
import type { TIssueType } from "@plane/types";
// services
import { setCachedIssueTypes } from "@/store/issue-type-cache";
import { issueTypeService } from "@/services/issue/issue_type.service";

export const PROJECT_ISSUE_TYPES_KEY = (workspaceSlug: string, projectId: string) =>
  `PROJECT_ISSUE_TYPES_${workspaceSlug}_${projectId}`;

/** Work item types of a project. Only fetches when the project has the feature enabled. */
export const useProjectIssueTypes = (
  workspaceSlug: string | undefined,
  projectId: string | undefined | null,
  isEnabled: boolean | undefined
) => {
  const shouldFetch = Boolean(workspaceSlug && projectId && isEnabled);
  const { data, mutate, isLoading } = useSWR<TIssueType[]>(
    shouldFetch ? PROJECT_ISSUE_TYPES_KEY(workspaceSlug as string, projectId as string) : null,
    () =>
      issueTypeService.list(workspaceSlug as string, projectId as string).then((types) => {
        setCachedIssueTypes(projectId as string, types);
        return types;
      }),
    { revalidateOnFocus: false }
  );
  const issueTypes = data ?? [];
  const defaultIssueType = issueTypes.find((type) => type.is_default);
  const getIssueTypeById = (id: string | null | undefined) =>
    (id ? issueTypes.find((type) => type.id === id) : undefined) ?? defaultIssueType;
  return { issueTypes, defaultIssueType, getIssueTypeById, mutate, isLoading };
};
