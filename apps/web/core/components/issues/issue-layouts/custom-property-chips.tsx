/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { customPropertyService } from "@/services/issue/custom_property.service";

export const PROJECT_CUSTOM_VALUES_KEY = (workspaceSlug: string, projectId: string) =>
  `PROJECT_CUSTOM_VALUES_${workspaceSlug}_${projectId}`;

const MAX_CHIPS = 3;

/** Compact "Name: value" chips of a work item's custom properties, for board cards. */
export const CustomPropertyChips = observer(function CustomPropertyChips(props: {
  projectId: string;
  issueId: string;
}) {
  const { projectId, issueId } = props;
  const { workspaceSlug } = useParams();
  const { getProjectById } = useProject();
  const { getUserDetails } = useMember();
  const isEnabled = !!getProjectById(projectId)?.is_issue_type_enabled;
  const { data } = useSWR(
    isEnabled && workspaceSlug ? PROJECT_CUSTOM_VALUES_KEY(workspaceSlug.toString(), projectId) : null,
    () => customPropertyService.getProjectValues(workspaceSlug as string, projectId),
    { revalidateOnFocus: false }
  );
  const itemValues = data?.values[issueId];
  if (!data || !itemValues) return null;

  const chips = data.properties
    .map((property) => {
      const raw = itemValues[property.id];
      if (raw === null || raw === undefined || raw === "" || (Array.isArray(raw) && raw.length === 0)) return null;
      const list = Array.isArray(raw) ? raw : [raw];
      const labels = list.map((value) => {
        if (property.property_type === "person") return getUserDetails(String(value))?.display_name ?? "";
        if (property.property_type === "select" || property.property_type === "multi_select")
          return property.options.find((option) => option.id === value)?.name ?? "";
        return String(value);
      });
      return { id: property.id, name: property.name, text: labels.filter(Boolean).join(", ") };
    })
    .filter((chip): chip is { id: string; name: string; text: string } => !!chip && !!chip.text);
  if (chips.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {chips.slice(0, MAX_CHIPS).map((chip) => (
        <span
          key={chip.id}
          title={`${chip.name}: ${chip.text}`}
          className="max-w-full truncate rounded-sm bg-layer-1 px-1.5 py-0.5 text-caption-sm-regular text-secondary"
        >
          <span className="text-tertiary">{chip.name}:</span> {chip.text}
        </span>
      ))}
    </div>
  );
});
