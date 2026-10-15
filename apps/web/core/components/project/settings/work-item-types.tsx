/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
// plane imports
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
// hooks
import { useProjectIssueTypes } from "@/hooks/use-project-issue-types";
import { issueTypeService } from "@/services/issue/issue_type.service";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

/** Manage the work item types of a project (shown under the feature toggle once enabled). */
export const WorkItemTypesSettings = observer(function WorkItemTypesSettings(props: Props) {
  const { workspaceSlug, projectId, isAdmin } = props;
  // state
  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  // hooks
  const { issueTypes, mutate, isLoading } = useProjectIssueTypes(workspaceSlug, projectId, true);

  const showError = (error: unknown, fallback: string) =>
    setToast({
      type: TOAST_TYPE.ERROR,
      title: "Error!",
      message:
        (error as { name?: string[]; error?: string })?.name?.[0] ?? (error as { error?: string })?.error ?? fallback,
    });

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setIsSaving(true);
    try {
      await issueTypeService.create(workspaceSlug, projectId, { name: trimmed });
      setName("");
      await mutate();
    } catch (error) {
      showError(error, "Could not create the work item type.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (issueTypeId: string) => {
    try {
      await issueTypeService.remove(workspaceSlug, projectId, issueTypeId);
      await mutate();
    } catch (error) {
      showError(error, "Could not delete the work item type.");
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-subtle p-4">
      <div className="text-body-sm-medium text-primary">Work item types</div>
      <p className="mt-1 text-caption-md-regular text-tertiary">
        Items without a type are treated as the default type. Deleting a type moves its items back to the default.
      </p>
      <ul className="mt-3 flex flex-col gap-y-1.5">
        {isLoading && <li className="text-caption-md-regular text-tertiary">Loading...</li>}
        {issueTypes.map((issueType) => (
          <li
            key={issueType.id}
            className="flex items-center justify-between rounded-md bg-layer-1 px-3 py-2 text-body-sm-regular text-primary"
          >
            <span>
              {issueType.name}
              {issueType.is_default && <span className="ml-2 text-caption-sm-regular text-tertiary">Default</span>}
            </span>
            {isAdmin && !issueType.is_default && (
              <button
                type="button"
                className="text-caption-md-medium text-danger-primary"
                onClick={() => handleDelete(issueType.id)}
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      {isAdmin && (
        <form
          className="mt-3 flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void handleCreate();
          }}
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New type, for example Bug"
            maxLength={255}
            className="flex-1 rounded-md border border-subtle bg-transparent px-3 py-1.5 text-body-sm-regular text-primary"
          />
          <button
            type="submit"
            disabled={isSaving || !name.trim()}
            className="rounded-md bg-accent-primary px-3 py-1.5 text-body-sm-medium text-on-color disabled:opacity-50"
          >
            Add type
          </button>
        </form>
      )}
    </div>
  );
});
