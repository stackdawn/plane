/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import type { Control } from "react-hook-form";
import { useWatch } from "react-hook-form";
// plane imports
import type { TIssue } from "@plane/types";
// components
import { PropertyEditor } from "@/components/issues/issue-detail/custom-properties";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { customPropertyService } from "@/services/issue/custom_property.service";
import { clearPendingCustomValues, getPendingCustomValue, setPendingCustomValue } from "@/store/pending-custom-values";

type Props = {
  control: Control<TIssue>;
  workspaceSlug: string | undefined;
  projectId: string | null | undefined;
};

/** Custom property fields for the create-work-item modal (values are saved after the item is created). */
export const IssueModalCustomProperties = observer(function IssueModalCustomProperties(props: Props) {
  const { control, workspaceSlug, projectId } = props;
  const { getProjectById } = useProject();
  const {
    project: { projectMemberIds },
    getUserDetails,
  } = useMember();
  const typeId = useWatch({ control, name: "type_id" });
  const isEnabled = !!getProjectById(projectId)?.is_issue_type_enabled;
  const { data: properties = [] } = useSWR(
    isEnabled && workspaceSlug && projectId ? `PROJECT_CUSTOM_PROPERTIES_${workspaceSlug}_${projectId}` : null,
    () => customPropertyService.list(workspaceSlug as string, projectId as string),
    { revalidateOnFocus: false }
  );

  // a fresh modal starts with no pending values
  useEffect(() => {
    clearPendingCustomValues();
    return () => clearPendingCustomValues();
  }, [projectId]);

  const applicable = properties.filter(
    (property) => property.is_active && (!property.issue_type || property.issue_type === typeId)
  );
  if (!isEnabled || applicable.length === 0) return null;

  const memberOptions = (projectMemberIds ?? []).map((memberId) => ({
    id: memberId,
    name: getUserDetails(memberId)?.display_name ?? memberId,
  }));

  return (
    <div className="grid grid-cols-1 gap-2 border-t border-subtle pt-3 sm:grid-cols-2">
      {applicable.map((property) => (
        <label key={property.id} className="flex flex-col gap-1 text-caption-md-medium text-secondary">
          {property.name}
          <PropertyEditor
            property={property}
            value={getPendingCustomValue(property.id)}
            disabled={false}
            memberOptions={memberOptions}
            onChange={(value) => setPendingCustomValue(property.id, value)}
          />
        </label>
      ))}
    </div>
  );
});
