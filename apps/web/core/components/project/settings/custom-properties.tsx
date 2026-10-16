/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
// plane imports
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TCustomPropertyType } from "@plane/types";
// hooks
import { useProjectIssueTypes } from "@/hooks/use-project-issue-types";
import { customPropertyService } from "@/services/issue/custom_property.service";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

const TYPE_LABELS: Record<TCustomPropertyType, string> = {
  text: "Text",
  number: "Number",
  person: "Person",
  select: "Select (one option)",
  multi_select: "Multi select",
};

const FIELD_CLASS = "rounded-md border border-subtle bg-transparent px-3 py-1.5 text-body-sm-regular text-primary";

/** Define custom properties (text, number, person, select, multi-select) for the project's work items. */
export const CustomPropertiesSettings = observer(function CustomPropertiesSettings(props: Props) {
  const { workspaceSlug, projectId, isAdmin } = props;
  const [name, setName] = useState("");
  const [propertyType, setPropertyType] = useState<TCustomPropertyType>("text");
  const [issueTypeId, setIssueTypeId] = useState("");
  const [isMulti, setIsMulti] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const { issueTypes } = useProjectIssueTypes(workspaceSlug, projectId, true);
  const { data: properties = [], mutate } = useSWR(
    `PROJECT_CUSTOM_PROPERTIES_${workspaceSlug}_${projectId}`,
    () => customPropertyService.list(workspaceSlug, projectId),
    { revalidateOnFocus: false }
  );

  const needsOptions = propertyType === "select" || propertyType === "multi_select";

  const showError = (error: unknown, fallback: string) => {
    const first = Object.values((error ?? {}) as Record<string, unknown>)[0];
    setToast({
      type: TOAST_TYPE.ERROR,
      title: "Error!",
      message: Array.isArray(first) ? String(first[0]) : typeof first === "string" ? first : fallback,
    });
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      await customPropertyService.create(workspaceSlug, projectId, {
        name: trimmed,
        property_type: propertyType,
        issue_type: issueTypeId || null,
        is_multi: propertyType === "person" && isMulti,
        options: needsOptions
          ? optionsText
              .split(/[\n,]/)
              .map((option) => option.trim())
              .filter(Boolean)
              .map((option) => ({ name: option }))
          : undefined,
      });
      setName("");
      setOptionsText("");
      setIsMulti(false);
      await mutate();
    } catch (error) {
      showError(error, "Could not create the property.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (propertyId: string) => {
    if (!window.confirm("Delete this property and every value stored for it?")) return;
    try {
      await customPropertyService.remove(workspaceSlug, projectId, propertyId);
      await mutate();
    } catch (error) {
      showError(error, "Could not delete the property.");
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-subtle p-4">
      <div className="text-body-sm-medium text-primary">Custom properties</div>
      <p className="mt-1 text-caption-md-regular text-tertiary">
        Extra fields on work items, for all types or one type. They show in the work item sidebar.
      </p>
      <ul className="mt-3 flex flex-col gap-y-1.5">
        {properties.length === 0 && <li className="text-caption-md-regular text-tertiary">No properties yet.</li>}
        {properties.map((property) => (
          <li
            key={property.id}
            className="flex items-center justify-between rounded-md bg-layer-1 px-3 py-2 text-body-sm-regular text-primary"
          >
            <span>
              {property.name}
              <span className="ml-2 text-caption-sm-regular text-tertiary">
                {TYPE_LABELS[property.property_type]}
                {property.property_type === "person" && property.is_multi ? " (several people)" : ""}
                {" - "}
                {property.issue_type
                  ? (issueTypes.find((type) => type.id === property.issue_type)?.name ?? "one type")
                  : "all types"}
                {property.options.length > 0 ? ` - ${property.options.map((option) => option.name).join(", ")}` : ""}
              </span>
            </span>
            {isAdmin && (
              <button
                type="button"
                className="text-caption-md-medium text-danger-primary"
                onClick={() => handleDelete(property.id)}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Property name, for example QA Assistant"
              maxLength={255}
              className={`${FIELD_CLASS} min-w-56 flex-1`}
            />
            <select
              value={propertyType}
              onChange={(event) => setPropertyType(event.target.value as TCustomPropertyType)}
              className={FIELD_CLASS}
              aria-label="Property type"
            >
              {Object.entries(TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={issueTypeId}
              onChange={(event) => setIssueTypeId(event.target.value)}
              className={FIELD_CLASS}
              aria-label="Applies to"
            >
              <option value="">All work item types</option>
              {issueTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  Only {type.name}
                </option>
              ))}
            </select>
          </div>
          {propertyType === "person" && (
            <label className="flex items-center gap-2 text-body-sm-regular text-secondary">
              <input type="checkbox" checked={isMulti} onChange={(event) => setIsMulti(event.target.checked)} />
              Allow several people
            </label>
          )}
          {needsOptions && (
            <textarea
              value={optionsText}
              onChange={(event) => setOptionsText(event.target.value)}
              placeholder="Options, one per line or comma separated"
              rows={3}
              className={FIELD_CLASS}
            />
          )}
          <div>
            <button
              type="submit"
              disabled={isSaving || !name.trim() || (needsOptions && !optionsText.trim())}
              className="rounded-md bg-accent-primary px-3 py-1.5 text-body-sm-medium text-on-color disabled:opacity-50"
            >
              Add property
            </button>
          </div>
        </form>
      )}
    </div>
  );
});
