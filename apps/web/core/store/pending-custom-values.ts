/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observable, runInAction } from "mobx";
import type { TCustomPropertyValue } from "@plane/types";
import { customPropertyService } from "@/services/issue/custom_property.service";

/** Values typed into the create-work-item modal, saved right after the work item exists. */
const pending = observable.map<string, TCustomPropertyValue>();

export const getPendingCustomValue = (propertyId: string) => pending.get(propertyId);
export const setPendingCustomValue = (propertyId: string, value: TCustomPropertyValue) =>
  runInAction(() => pending.set(propertyId, value));
export const clearPendingCustomValues = () => runInAction(() => pending.clear());

export const flushPendingCustomValues = async (workspaceSlug: string, projectId: string, issueId: string) => {
  const values = Object.fromEntries([...pending.entries()].filter(([, value]) => value !== null && value !== ""));
  clearPendingCustomValues();
  if (Object.keys(values).length === 0) return;
  await customPropertyService.setValues(workspaceSlug, projectId, issueId, values);
};
