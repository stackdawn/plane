/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TIssueType } from "@plane/types";

export const ISSUE_TYPE_COLORS = [
  "#E5484D",
  "#30A46C",
  "#3E63DD",
  "#8E4EC6",
  "#F76B15",
  "#12A594",
  "#6F6E77",
  "#D6409F",
];

type TGlyph = "bug" | "plus" | "check" | "doc" | "bolt" | "dot";

const NAME_PRESETS: Record<string, { color: string; glyph: TGlyph }> = {
  bug: { color: "#E5484D", glyph: "bug" },
  feature: { color: "#30A46C", glyph: "plus" },
  task: { color: "#3E63DD", glyph: "check" },
  documentation: { color: "#8E4EC6", glyph: "doc" },
  spike: { color: "#F76B15", glyph: "bolt" },
};

const GLYPHS: Record<TGlyph, string> = {
  bug: "M12 8a4 4 0 100 8 4 4 0 000-8z",
  plus: "M12 7v10M7 12h10",
  check: "M7.5 12.5l3 3 6-6.5",
  doc: "M8 8h8M8 12h8M8 16h5",
  bolt: "M13 6l-5 7h4l-1 5 5-7h-4z",
  dot: "M12 9a3 3 0 100 6 3 3 0 000-6z",
};

/** Resolves colour and glyph from the type's logo_props, then its name, then a stable fallback. */
export const getIssueTypeVisual = (issueType: Pick<TIssueType, "name" | "logo_props">) => {
  const preset = NAME_PRESETS[issueType.name.trim().toLowerCase()];
  const customColor = (issueType.logo_props as { color?: string } | undefined)?.color;
  const hash = [...issueType.name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return {
    color: customColor ?? preset?.color ?? ISSUE_TYPE_COLORS[hash % ISSUE_TYPE_COLORS.length],
    glyph: preset?.glyph ?? ("dot" as TGlyph),
  };
};

type Props = { issueType: Pick<TIssueType, "name" | "logo_props">; size?: number };

/** Jira-style type marker: a small rounded square in the type's colour with a glyph. */
export function IssueTypeIcon({ issueType, size = 16 }: Props) {
  const { color, glyph } = getIssueTypeVisual(issueType);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={issueType.name} role="img" className="shrink-0">
      <title>{issueType.name}</title>
      <rect x="1" y="1" width="22" height="22" rx="5" fill={color} />
      <path
        d={GLYPHS[glyph]}
        fill={glyph === "bug" || glyph === "dot" || glyph === "bolt" ? "#fff" : "none"}
        stroke="#fff"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
