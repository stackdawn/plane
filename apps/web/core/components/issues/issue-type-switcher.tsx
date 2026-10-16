/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// store hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectIssueTypes } from "@/hooks/use-project-issue-types";
// components
import { IssueIdentifier } from "@/components/issues/issue-detail/issue-identifier";
import { IssueTypeDropdown } from "@/components/issues/issue-type-dropdown";

export type TIssueTypeSwitcherProps = {
  issueId: string;
  disabled: boolean;
};

export const IssueTypeSwitcher = observer(function IssueTypeSwitcher(props: TIssueTypeSwitcherProps) {
  const { issueId, disabled } = props;
  const { workspaceSlug } = useParams();
  // store hooks
  const {
    issue: { getIssueById },
    updateIssue,
  } = useIssueDetail();
  const { getProjectById } = useProject();
  // derived values
  const issue = getIssueById(issueId);
  const isEnabled = !!getProjectById(issue?.project_id)?.is_issue_type_enabled;
  const { issueTypes, defaultIssueType } = useProjectIssueTypes(
    workspaceSlug?.toString(),
    issue?.project_id,
    isEnabled
  );

  if (!issue || !issue.project_id) return <></>;

  const handleChange = (issueTypeId: string) =>
    updateIssue(workspaceSlug?.toString() ?? "", issue.project_id!, issueId, { type_id: issueTypeId }).catch(() =>
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not change the work item type." })
    );

  return (
    <div className="flex items-center gap-2">
      {isEnabled && issueTypes.length > 0 && (
        <IssueTypeDropdown
          issueTypes={issueTypes}
          value={issue.type_id ?? defaultIssueType?.id}
          onChange={handleChange}
          disabled={disabled}
        />
      )}
      <IssueIdentifier
        issueId={issueId}
        projectId={issue.project_id}
        size="md"
        enableClickToCopyIdentifier
        hideTypeIcon={isEnabled && issueTypes.length > 0}
      />
    </div>
  );
});
