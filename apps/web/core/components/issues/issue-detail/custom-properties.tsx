/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR, { useSWRConfig } from "swr";
import { SlidersHorizontal } from "lucide-react";
// plane imports
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TCustomProperty, TCustomPropertyValue } from "@plane/types";
// components
import { CustomSearchSelect } from "@plane/ui";
import { MemberDropdown } from "@/components/dropdowns/member/dropdown";
import { SidebarPropertyListItem } from "@/components/common/layout/sidebar/property-list-item";
// hooks
import { useIssueDetail } from "@/hooks/store/use-issue-detail";
import { useProject } from "@/hooks/store/use-project";
import { customPropertyService } from "@/services/issue/custom_property.service";

type Props = {
  workspaceSlug: string;
  projectId: string;
  issueId: string;
  disabled: boolean;
};

const INPUT_CLASS =
  "h-7.5 w-full rounded-md border border-transparent bg-transparent px-2 text-body-xs-regular text-primary hover:bg-layer-1 focus:border-subtle focus:bg-layer-1 focus:outline-none disabled:opacity-60 disabled:hover:bg-transparent";
const SELECT_BUTTON_CLASS = "h-7.5 w-full justify-between text-left text-body-xs-regular";

export type TEditorProps = {
  property: TCustomProperty;
  value: TCustomPropertyValue | undefined;
  disabled: boolean;
  projectId: string;
  onChange: (value: TCustomPropertyValue) => void;
};

/** One editor per property kind, built from the same dropdowns the built-in properties use. */
export function PropertyEditor({ property, value, disabled, projectId, onChange }: TEditorProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const asList = Array.isArray(value) ? value : value ? [String(value)] : [];

  if (property.property_type === "text" || property.property_type === "number") {
    const isNumber = property.property_type === "number";
    const stored = value === null || value === undefined ? "" : String(value);
    return (
      <input
        type={isNumber ? "number" : "text"}
        step="any"
        disabled={disabled}
        placeholder={isNumber ? "Add number" : "Add text"}
        className={INPUT_CLASS}
        value={draft ?? stored}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => {
          if (draft === null) return;
          const next = draft.trim();
          setDraft(null);
          if (next !== stored) onChange(next === "" ? null : next);
        }}
      />
    );
  }

  if (property.property_type === "person") {
    const common = {
      disabled,
      projectId,
      placeholder: "Add person",
      showUserDetails: true,
      className: "group w-full grow",
      buttonContainerClassName: "w-full text-left h-7.5",
      buttonClassName: `text-body-xs-regular justify-between ${asList.length > 0 ? "" : "text-placeholder"}`,
      hideIcon: asList.length === 0,
      dropdownArrow: true,
      dropdownArrowClassName: "h-3.5 w-3.5 hidden group-hover:inline",
    };
    return property.is_multi ? (
      <MemberDropdown
        {...common}
        multiple
        value={asList}
        onChange={(ids: string[]) => onChange(ids)}
        buttonVariant={asList.length > 1 ? "transparent-without-text" : "transparent-with-text"}
      />
    ) : (
      <MemberDropdown
        {...common}
        multiple={false}
        value={asList[0] ?? null}
        onChange={(id: string | null) => onChange(id ?? null)}
        buttonVariant="transparent-with-text"
      />
    );
  }

  const options = property.options
    .filter((option) => option.is_active)
    .map((option) => ({ value: option.id, query: option.name, content: <span>{option.name}</span> }));
  const names = asList.map((id) => options.find((option) => option.value === id)?.query).filter(Boolean);
  const label = (
    <span className={names.length > 0 ? "text-primary" : "text-placeholder"}>
      {names.length > 0 ? names.join(", ") : property.property_type === "multi_select" ? "Add options" : "Select"}
    </span>
  );

  if (property.property_type === "multi_select") {
    return (
      <CustomSearchSelect
        multiple
        value={asList}
        onChange={(ids: string[]) => onChange(ids)}
        options={options}
        label={label}
        disabled={disabled}
        className="w-full"
        buttonClassName={SELECT_BUTTON_CLASS}
        optionsClassName="w-48"
        maxHeight="md"
      />
    );
  }
  return (
    <CustomSearchSelect
      value={asList[0] ?? null}
      onChange={(id: string | null) => onChange(id || null)}
      options={[{ value: "", query: "none", content: <span className="text-tertiary">None</span> }, ...options]}
      label={label}
      disabled={disabled}
      className="w-full"
      buttonClassName={SELECT_BUTTON_CLASS}
      optionsClassName="w-48"
      maxHeight="md"
    />
  );
}

/** Custom property rows for the work item sidebar and peek view. Renders nothing when there are none. */
export const IssueCustomProperties = observer(function IssueCustomProperties(props: Props) {
  const { workspaceSlug, projectId, issueId, disabled } = props;
  const { getProjectById } = useProject();
  const {
    issue: { getIssueById },
  } = useIssueDetail();
  const { mutate: globalMutate } = useSWRConfig();
  const isEnabled = !!getProjectById(projectId)?.is_issue_type_enabled;
  const typeId = getIssueById(issueId)?.type_id ?? "default";
  const { data, mutate } = useSWR(
    isEnabled ? `ISSUE_CUSTOM_PROPERTIES_${issueId}_${typeId}` : null,
    () => customPropertyService.getValues(workspaceSlug, projectId, issueId),
    { revalidateOnFocus: false }
  );

  if (!isEnabled || !data || data.properties.length === 0) return null;

  const handleChange = async (property: TCustomProperty, value: TCustomPropertyValue) => {
    try {
      await mutate(customPropertyService.setValues(workspaceSlug, projectId, issueId, { [property.id]: value }), {
        revalidate: false,
      });
      void globalMutate(`PROJECT_CUSTOM_VALUES_${workspaceSlug}_${projectId}`);
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
            projectId={projectId}
            onChange={(value) => handleChange(property, value)}
          />
        </SidebarPropertyListItem>
      ))}
    </>
  );
});
