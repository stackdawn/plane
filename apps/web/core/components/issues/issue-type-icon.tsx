/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bookmark,
  Bug,
  Check,
  Circle,
  Clock,
  FileText,
  FlaskConical,
  Flag,
  GitBranch,
  HelpCircle,
  Layers,
  Lightbulb,
  Lock,
  MessageSquare,
  Plus,
  Rocket,
  Shield,
  Star,
  Wrench,
  Zap,
} from "lucide-react";
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

/** Keys must match ISSUE_TYPE_GLYPHS in the API serializer. */
export const ISSUE_TYPE_GLYPHS: Record<string, { label: string; Icon: LucideIcon }> = {
  bug: { label: "Bug", Icon: Bug },
  plus: { label: "New feature", Icon: Plus },
  check: { label: "Task", Icon: Check },
  file: { label: "Document", Icon: FileText },
  zap: { label: "Spike", Icon: Zap },
  bookmark: { label: "Story", Icon: Bookmark },
  flag: { label: "Epic", Icon: Flag },
  help: { label: "Question", Icon: HelpCircle },
  alert: { label: "Incident", Icon: AlertTriangle },
  rocket: { label: "Release", Icon: Rocket },
  star: { label: "Improvement", Icon: Star },
  lightbulb: { label: "Idea", Icon: Lightbulb },
  wrench: { label: "Maintenance", Icon: Wrench },
  lock: { label: "Security", Icon: Lock },
  message: { label: "Support", Icon: MessageSquare },
  shield: { label: "Compliance", Icon: Shield },
  layers: { label: "Initiative", Icon: Layers },
  flask: { label: "Test", Icon: FlaskConical },
  branch: { label: "Technical", Icon: GitBranch },
  clock: { label: "Chore", Icon: Clock },
  circle: { label: "Generic", Icon: Circle },
};

const NAME_PRESETS: Record<string, { color: string; glyph: string }> = {
  bug: { color: "#E5484D", glyph: "bug" },
  feature: { color: "#30A46C", glyph: "plus" },
  task: { color: "#3E63DD", glyph: "check" },
  documentation: { color: "#8E4EC6", glyph: "file" },
  spike: { color: "#F76B15", glyph: "zap" },
};

type TLogoProps = { color?: string; glyph?: string; image?: string };

/** Resolves colour and glyph from the type's logo_props, then its name, then a stable fallback. */
export const getIssueTypeVisual = (issueType: Pick<TIssueType, "name" | "logo_props">) => {
  const preset = NAME_PRESETS[issueType.name.trim().toLowerCase()];
  const logo = (issueType.logo_props ?? {}) as TLogoProps;
  const hash = [...issueType.name].reduce((total, char) => total + char.charCodeAt(0), 0);
  return {
    color: logo.color ?? preset?.color ?? ISSUE_TYPE_COLORS[hash % ISSUE_TYPE_COLORS.length],
    glyph: logo.glyph && ISSUE_TYPE_GLYPHS[logo.glyph] ? logo.glyph : (preset?.glyph ?? "circle"),
    image: logo.image,
  };
};

type Props = { issueType: Pick<TIssueType, "name" | "logo_props">; size?: number };

/** Jira-style type marker: an uploaded image, or a rounded square in the type's colour with a glyph. */
export function IssueTypeIcon({ issueType, size = 16 }: Props) {
  const { color, glyph, image } = getIssueTypeVisual(issueType);
  if (image) {
    return (
      <img
        src={image}
        alt={issueType.name}
        title={issueType.name}
        width={size}
        height={size}
        className="shrink-0 rounded-[4px] object-cover"
      />
    );
  }
  const { Icon } = ISSUE_TYPE_GLYPHS[glyph];
  return (
    <span
      title={issueType.name}
      role="img"
      aria-label={issueType.name}
      className="inline-flex shrink-0 items-center justify-center rounded-[4px] text-white"
      style={{ width: size, height: size, backgroundColor: color }}
    >
      <Icon size={Math.round(size * 0.68)} strokeWidth={2.5} />
    </span>
  );
}
