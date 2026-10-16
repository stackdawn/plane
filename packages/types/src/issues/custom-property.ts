/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

export type TCustomPropertyType = "text" | "number" | "person" | "select" | "multi_select";

export type TCustomPropertyOption = {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
};

export type TCustomProperty = {
  id: string;
  issue_type: string | null;
  name: string;
  description: string;
  property_type: TCustomPropertyType;
  is_multi: boolean;
  is_required: boolean;
  is_active: boolean;
  sort_order: number;
  options: TCustomPropertyOption[];
};

export type TCustomPropertyPayload = {
  name?: string;
  description?: string;
  property_type?: TCustomPropertyType;
  issue_type?: string | null;
  is_multi?: boolean;
  is_required?: boolean;
  options?: { id?: string; name: string; color?: string }[];
};

/** A value is a scalar, a list (multi), or null when empty. */
export type TCustomPropertyValue = string | number | string[] | null;

export type TIssueCustomProperties = {
  properties: TCustomProperty[];
  values: Record<string, TCustomPropertyValue>;
};
