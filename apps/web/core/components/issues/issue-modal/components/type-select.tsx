/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
// plane imports
import type { TIssue } from "@plane/types";
// hooks
import { useProject } from "@/hooks/store/use-project";
import { useProjectIssueTypes } from "@/hooks/use-project-issue-types";

type Props = {
  control: Control<TIssue>;
  workspaceSlug: string | undefined;
  projectId: string | null | undefined;
  disabled?: boolean;
};

/** Work item type picker. Renders nothing unless the project has types enabled. */
export const IssueTypeSelect = observer(function IssueTypeSelect(props: Props) {
  const { control, workspaceSlug, projectId, disabled = false } = props;
  const { getProjectById } = useProject();
  const isEnabled = !!getProjectById(projectId)?.is_issue_type_enabled;
  const { issueTypes, defaultIssueType } = useProjectIssueTypes(workspaceSlug, projectId, isEnabled);

  if (!isEnabled || issueTypes.length === 0) return null;

  return (
    <Controller
      control={control}
      name="type_id"
      render={({ field: { value, onChange } }) => (
        <select
          aria-label="Work item type"
          disabled={disabled}
          value={value ?? defaultIssueType?.id ?? ""}
          onChange={(event) => onChange(event.target.value || null)}
          className="rounded-md border border-subtle bg-transparent px-2 py-1 text-caption-md-medium text-secondary"
        >
          {issueTypes.map((issueType) => (
            <option key={issueType.id} value={issueType.id}>
              {issueType.name}
            </option>
          ))}
        </select>
      )}
    />
  );
});
