/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
// plane imports
import { setToast, TOAST_TYPE } from "@plane/propel/toast";
import type { TIssueTypeCardStyle } from "@plane/types";
// hooks
import { useProject } from "@/hooks/store/use-project";

type Props = {
  workspaceSlug: string;
  projectId: string;
  isAdmin: boolean;
};

const PREVIEW_COLOR = "#E5484D";

const OPTIONS: { value: TIssueTypeCardStyle; label: string; hint: string }[] = [
  { value: "footer", label: "Footer band", hint: "Tinted strip at the bottom with the type and key (default)" },
  { value: "header", label: "Header band", hint: "Solid colour across the top with the type and key" },
  { value: "gutter", label: "Side gutter", hint: "Solid colour column on the left with icon, type and key" },
  { value: "edge", label: "Edge bar", hint: "Thin colour bar on the left edge" },
  { value: "tint", label: "Soft tint", hint: "Light colour wash over the whole card" },
  { value: "standard", label: "Standard", hint: "Plain card, type icon beside the key" },
];

/** Miniature card showing roughly how a style paints the card (the real card uses each type's own colour). */
function StylePreview({ value }: { value: TIssueTypeCardStyle }) {
  const lines = (
    <div className="flex flex-col gap-1">
      <div className="h-1.5 w-4/5 rounded-sm bg-layer-1" />
      <div className="h-1.5 w-3/5 rounded-sm bg-layer-1" />
    </div>
  );
  return (
    <div
      className="relative h-14 w-28 overflow-hidden rounded-md border border-subtle bg-layer-2 text-[8px] text-white"
      style={
        value === "tint" ? { backgroundColor: `${PREVIEW_COLOR}1F`, borderColor: `${PREVIEW_COLOR}66` } : undefined
      }
    >
      {value === "edge" && (
        <div className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: PREVIEW_COLOR }} />
      )}
      {value === "header" && (
        <div className="px-1.5 py-0.5" style={{ backgroundColor: PREVIEW_COLOR }}>
          Bug
        </div>
      )}
      {value === "gutter" && (
        <div className="absolute inset-y-0 left-0 w-8 px-1 pt-1" style={{ backgroundColor: PREVIEW_COLOR }}>
          Bug
        </div>
      )}
      <div className={`p-1.5 ${value === "gutter" ? "ml-8" : value === "edge" ? "ml-1.5" : ""}`}>{lines}</div>
      {value === "footer" && (
        <div
          className="absolute inset-x-0 bottom-0 px-1.5 py-0.5 text-primary"
          style={{ backgroundColor: `${PREVIEW_COLOR}26`, borderTop: `1px solid ${PREVIEW_COLOR}66` }}
        >
          Bug
        </div>
      )}
    </div>
  );
}

/** Project-wide choice of how work item type colours show on board cards. */
export const CardStyleSettings = observer(function CardStyleSettings({ workspaceSlug, projectId, isAdmin }: Props) {
  const { getProjectById, updateProject } = useProject();
  const current = getProjectById(projectId)?.issue_type_card_style ?? "footer";

  const handleChange = async (value: TIssueTypeCardStyle) => {
    if (value === current) return;
    try {
      await updateProject(workspaceSlug, projectId, { issue_type_card_style: value });
    } catch {
      setToast({ type: TOAST_TYPE.ERROR, title: "Error!", message: "Could not change the card style." });
    }
  };

  return (
    <div className="mt-3 rounded-lg border border-subtle p-4">
      <div className="text-body-sm-medium text-primary">Card style</div>
      <p className="mt-1 text-caption-md-regular text-tertiary">
        How a work item&apos;s type colour shows on board cards. Applies to everyone in this project.
      </p>
      <div role="radiogroup" aria-label="Card style" className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={current === option.value}
            disabled={!isAdmin}
            onClick={() => handleChange(option.value)}
            className={`flex items-center gap-3 rounded-md border p-2 text-left ${
              current === option.value ? "border-accent-strong bg-layer-1" : "border-subtle hover:bg-layer-1"
            }`}
          >
            <StylePreview value={option.value} />
            <span>
              <span className="block text-body-sm-medium text-primary">{option.label}</span>
              <span className="block text-caption-sm-regular text-tertiary">{option.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
});
