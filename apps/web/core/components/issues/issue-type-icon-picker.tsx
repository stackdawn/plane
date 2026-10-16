/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRef, useState } from "react";
import type { TIssueType } from "@plane/types";
import {
  ISSUE_TYPE_COLORS,
  ISSUE_TYPE_GLYPHS,
  IssueTypeIcon,
  getIssueTypeVisual,
} from "@/components/issues/issue-type-icon";

type TLogoProps = { color?: string; glyph?: string; image?: string };

type Props = {
  issueType: TIssueType;
  onSave: (logoProps: TLogoProps) => Promise<void> | void;
};

const IMAGE_SIZE = 64;

/** Downscales an uploaded image to a 64px PNG data URI so it stays small enough to store inline. */
const toSmallDataUri = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = IMAGE_SIZE;
      canvas.height = IMAGE_SIZE;
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Canvas is not available"));
      const side = Math.min(img.width, img.height);
      context.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, IMAGE_SIZE, IMAGE_SIZE);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file is not a readable image"));
    };
    img.src = url;
  });

/** Icon list + colour swatches + optional image upload, as in Jira's issue type editor. */
export function IssueTypeIconPicker({ issueType, onSave }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const visual = getIssueTypeVisual(issueType);
  const current = (issueType.logo_props ?? {}) as TLogoProps;

  const save = (patch: TLogoProps) => onSave({ ...current, ...patch });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      await save({ image: await toSmallDataUri(file) });
    } catch (uploadError) {
      setError((uploadError as Error).message);
    }
  };

  return (
    <div className="mt-1 mb-2 rounded-md border border-subtle p-3">
      <div className="text-caption-md-medium text-secondary">Icon</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {Object.entries(ISSUE_TYPE_GLYPHS).map(([key, { label, Icon }]) => (
          <button
            key={key}
            type="button"
            title={label}
            aria-label={label}
            onClick={() => save({ glyph: key, image: undefined })}
            className="flex size-8 items-center justify-center rounded-md border text-secondary hover:bg-layer-1"
            style={{ borderColor: !visual.image && visual.glyph === key ? visual.color : "transparent" }}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>
      <div className="mt-3 text-caption-md-medium text-secondary">Colour</div>
      <div className="mt-2 flex items-center gap-1.5">
        {ISSUE_TYPE_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Colour ${color}`}
            onClick={() => save({ color })}
            className="size-5 rounded-full border border-subtle"
            style={{ backgroundColor: color, outline: visual.color === color ? "2px solid currentColor" : "none" }}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <IssueTypeIcon issueType={issueType} size={28} />
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            void handleFile(event.target.files?.[0]);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="rounded-md border border-subtle px-2.5 py-1 text-caption-md-medium text-secondary hover:bg-layer-1"
        >
          Upload image
        </button>
        {current.image && (
          <button
            type="button"
            onClick={() => save({ image: undefined })}
            className="text-caption-md-medium text-danger-primary"
          >
            Remove image
          </button>
        )}
      </div>
      {error && <div className="mt-2 text-caption-md-regular text-danger-primary">{error}</div>}
    </div>
  );
}
