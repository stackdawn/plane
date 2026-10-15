/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// plane imports
import type { TIssueIdentifierProps } from "@plane/types";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { useProjectIssueTypes } from "@/hooks/use-project-issue-types";
import { IdentifierText } from "@/components/issues/issue-detail/identifier-text";

export const IssueIdentifier = observer(function IssueIdentifier(props: TIssueIdentifierProps) {
  const { projectId, variant, size, displayProperties, enableClickToCopyIdentifier = false } = props;
  // store hooks
  const { getProjectIdentifierById, getProjectById } = useProject();
  const { workspaceSlug } = useParams();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  // Determine if the component is using store data or not
  const isUsingStoreData = "issueId" in props;
  // derived values
  const issue = isUsingStoreData ? getIssueById(props.issueId) : null;
  const projectIdentifier = isUsingStoreData ? getProjectIdentifierById(projectId) : props.projectIdentifier;
  const issueSequenceId = isUsingStoreData ? issue?.sequence_id : props.issueSequenceId;
  const shouldRenderIssueID = displayProperties ? displayProperties.key : true;
  // work item type badge (only for projects with types enabled, and never for the default type)
  const isIssueTypeEnabled = isUsingStoreData && !!getProjectById(projectId)?.is_issue_type_enabled;
  const { issueTypes } = useProjectIssueTypes(workspaceSlug?.toString(), projectId, isIssueTypeEnabled);
  const issueType = issue?.type_id ? issueTypes.find((type) => type.id === issue.type_id) : undefined;

  if (!shouldRenderIssueID) return null;

  return (
    <div className="flex shrink-0 items-center space-x-2">
      <IdentifierText
        identifier={`${projectIdentifier}-${issueSequenceId}`}
        enableClickToCopyIdentifier={enableClickToCopyIdentifier}
        variant={variant}
        size={size}
      />
      {issueType && !issueType.is_default && (
        <span className="rounded-sm bg-layer-1 px-1.5 py-0.5 text-caption-sm-medium text-secondary">
          {issueType.name}
        </span>
      )}
    </div>
  );
});
