/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import { useOutsideClickDetector } from "@plane/hooks";
import type { TIssueType } from "@plane/types";
import { IssueTypeIcon } from "@/components/issues/issue-type-icon";

type Props = {
  issueTypes: TIssueType[];
  value: string | null | undefined;
  onChange: (issueTypeId: string) => void;
  disabled?: boolean;
  showLabel?: boolean;
};

/** Icon + name dropdown used to pick or change a work item's type (as in Jira's issue type picker). */
export function IssueTypeDropdown({ issueTypes, value, onChange, disabled = false, showLabel = true }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useOutsideClickDetector(ref, () => setIsOpen(false));
  const selected = issueTypes.find((type) => type.id === value) ?? issueTypes.find((type) => type.is_default);
  if (!selected) return null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-caption-md-medium text-secondary hover:bg-layer-1 disabled:cursor-default disabled:hover:bg-transparent"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <IssueTypeIcon issueType={selected} />
        {showLabel && <span>{selected.name}</span>}
        {!disabled && <span className="text-tertiary">▾</span>}
      </button>
      {isOpen && (
        <ul
          role="listbox"
          className="shadow-lg absolute left-0 z-30 mt-1 min-w-44 rounded-md border border-subtle bg-surface-1 p-1"
        >
          {issueTypes.map((type) => (
            <li key={type.id} role="option" aria-selected={type.id === selected.id}>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  if (type.id !== selected.id) onChange(type.id);
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-body-sm-regular text-primary hover:bg-layer-1"
              >
                <IssueTypeIcon issueType={type} />
                <span className="flex-1">{type.name}</span>
                {type.id === selected.id && <span className="text-tertiary">✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
