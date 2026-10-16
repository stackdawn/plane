/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// components
import { IssueTypeDropdown } from "@/components/issues/issue-type-dropdown";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectIssueTypes } from "@/hooks/use-project-issue-types";
import { getQuickAddTypeId, setQuickAddTypeId } from "@/store/quick-add-type";

/** Small type picker for the quick-add row. Renders nothing unless the project has types enabled. */
export const QuickAddTypePicker = observer(function QuickAddTypePicker({ projectId }: { projectId: string }) {
  const { workspaceSlug } = useParams();
  const { getProjectById } = useProject();
  const isEnabled = !!getProjectById(projectId)?.is_issue_type_enabled;
  const { issueTypes, defaultIssueType } = useProjectIssueTypes(workspaceSlug?.toString(), projectId, isEnabled);
  if (!isEnabled || issueTypes.length === 0) return null;
  return (
    <IssueTypeDropdown
      issueTypes={issueTypes}
      value={getQuickAddTypeId(projectId) ?? defaultIssueType?.id}
      onChange={(typeId) => setQuickAddTypeId(projectId, typeId)}
      showLabel={false}
    />
  );
});
