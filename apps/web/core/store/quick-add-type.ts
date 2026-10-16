/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observable, runInAction } from "mobx";

const STORAGE_KEY = "plane_quick_add_issue_type";
const read = (): Record<string, string> => {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
};

/** The type the quick-add row will use, per project; remembered in this browser. */
const typeByProject = observable.map<string, string>(Object.entries(typeof window === "undefined" ? {} : read()));

export const getQuickAddTypeId = (projectId: string) => typeByProject.get(projectId);

export const setQuickAddTypeId = (projectId: string, typeId: string) => {
  runInAction(() => typeByProject.set(projectId, typeId));
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(typeByProject)));
  } catch {
    // storage unavailable: the choice just is not remembered
  }
};
