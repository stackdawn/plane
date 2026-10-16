/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { SlidersHorizontal } from "lucide-react";
// plane imports
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TCustomProperty, TCustomPropertyValue } from "@plane/types";
// components
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { customPropertyService } from "@/services/issue/custom_property.service";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

const FIELD_CLASS =
  "w-full rounded-md border border-subtle bg-transparent px-2 py-1 text-body-xs-regular text-primary disabled:opacity-60";

type TEditorProps = {
  property: TCustomProperty;
  value: TCustomPropertyValue | undefined;
  disabled: boolean;
  memberOptions: { id: string; name: string }[];
  onChange: (value: TCustomPropertyValue) => void;
};

function PropertyEditor({ property, value, disabled, memberOptions, onChange }: TEditorProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const asList = Array.isArray(value) ? value : value ? [String(value)] : [];

  if (property.property_type === "text" || property.property_type === "number") {
    const isNumber = property.property_type === "number";
    return (
      <input
        type={isNumber ? "number" : "text"}
        step="any"
        disabled={disabled}
        className={FIELD_CLASS}
        value={draft ?? (value === null || value === undefined ? "" : String(value))}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft === null) return;
          const next = draft.trim();
          setDraft(null);
          if (next !== (value === null || value === undefined ? "" : String(value)))
            onChange(next === "" ? null : next);
        }}
      />
    );
  }

  const options =
    property.property_type === "person"
      ? memberOptions
      : property.options.filter((option) => option.is_active).map((option) => ({ id: option.id, name: option.name }));
  const isMulti =
    property.property_type === "multi_select" || (property.property_type === "person" && property.is_multi);

  if (!isMulti) {
    return (
      <select
        disabled={disabled}
        className={FIELD_CLASS}
        value={asList[0] ?? ""}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">None</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      {options.map((option) => (
        <label key={option.id} className="flex items-center gap-2 text-body-xs-regular text-primary">
          <input
            type="checkbox"
            disabled={disabled}
            checked={asList.includes(option.id)}
            onChange={(event) =>
              onChange(event.target.checked ? [...asList, option.id] : asList.filter((id) => id !== option.id))
            }
          />
          {option.name}
        </label>
      ))}
    </div>
  );
}

/** Custom property rows for the work item sidebar and peek view. Renders nothing when there are none. */
export const IssueCustomProperties = observer(function IssueCustomProperties(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled } = props;
  const { getProjectById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const {
    project: { projectMemberIds },
    getUserDetails,
  } = useMember();
  const isEnabled = !!getProjectById(projectId)?.is_issue_type_enabled;
  const typeId = getIssueById(issueId)?.type_id ?? "default";
  const { data, mutate } = useSWR(
    isEnabled ? `ISSUE_CUSTOM_PROPERTIES_${issueId}_${typeId}` : null,
    () => customPropertyService.getValues(workspaceSlug, projectId, issueId),
    { revalidateOnFocus: false }
  );

  if (!isEnabled || !data || data.properties.length === 0) return null;

  const memberOptions = (projectMemberIds ?? []).map((memberId) => ({
    id: memberId,
    name: getUserDetails(memberId)?.display_name ?? memberId,
  }));

  const handleChange = async (property: TCustomProperty, value: TCustomPropertyValue) => {
    try {
      await mutate(customPropertyService.setValues(workspaceSlug, projectId, issueId, { [property.id]: value }), {
        revalidate: false,
      });
    } catch (error) {
      const message = Object.values((error ?? {}) as Record<string, string>)[0];
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: message ?? "Could not save the property." });
    }
  };

  return (
    <>
      {data.properties.map((property) => (
        <SidebarPropertyListItem key={property.id} icon={SlidersHorizontal} label={property.name}>
          <PropertyEditor
            property={property}
            value={data.values[property.id]}
            disabled={disabled}
            memberOptions={memberOptions}
            onChange={(value) => handleChange(property, value)}
          />
        </SidebarPropertyListItem>
      ))}
    </>
  );
});
