/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useParams } from "next/navigation";
import type { TIssue, TIssueType, TIssueTypeCardStyle } from "@plane/types";
import { getIssueTypeVisual } from "@/components/issues/issue-type-icon";
import { useProject } from "@/hooks/store/use-project";
import { useProjectIssueTypes } from "@/hooks/use-project-issue-types";

type TResult = { style: TIssueTypeCardStyle | null; color: string; issueType: TIssueType | undefined };

/** How a work item's type is shown on its board card: null when the project has types disabled. */
export const useIssueTypeCardStyle = (issue: Pick<TIssue, "project_id" | "type_id"> | undefined): TResult => {
  const { workspaceSlug } = useParams();
  const { getProjectById } = useProject();
  const project = getProjectById(issue?.project_id);
  const isEnabled = !!project?.is_issue_type_enabled;
  const { getIssueTypeById } = useProjectIssueTypes(workspaceSlug?.toString(), issue?.project_id, isEnabled);
  const issueType = isEnabled ? getIssueTypeById(issue?.type_id) : undefined;
  if (!isEnabled || !issueType) return { style: null, color: "", issueType: undefined };
  return {
    style: project?.issue_type_card_style ?? "footer",
    color: getIssueTypeVisual(issueType).color,
    issueType,
  };
};
