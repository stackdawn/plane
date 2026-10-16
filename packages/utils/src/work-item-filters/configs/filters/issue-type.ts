/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane imports
import type { TFilterProperty, TIssueType, TSupportedOperators } from "@plane/types";
import { EQUALITY_OPERATOR, COLLECTION_OPERATOR } from "@plane/types";
// local imports
import type { TCreateFilterConfigParams, IFilterIconConfig, TCreateFilterConfig } from "../../../rich-filters";
import { createFilterConfig, getMultiSelectConfig, createOperatorConfigEntry } from "../../../rich-filters";

/** Work item type filter specific params. The option icon receives the whole type. */
export type TCreateIssueTypeFilterParams = TCreateFilterConfigParams &
  IFilterIconConfig<TIssueType> & {
    issueTypes: TIssueType[];
  };

export const getIssueTypeMultiSelectConfig = (
  params: TCreateIssueTypeFilterParams,
  singleValueOperator: TSupportedOperators
) =>
  getMultiSelectConfig<TIssueType, string, TIssueType>(
    {
      items: params.issueTypes,
      getId: (issueType) => issueType.id,
      getLabel: (issueType) => issueType.name,
      getValue: (issueType) => issueType.id,
      getIconData: (issueType) => issueType,
    },
    {
      singleValueOperator,
      ...params,
    },
    {
      getOptionIcon: params.getOptionIcon,
    }
  );

/** Get the work item type filter config for the given filter key. */
export const getIssueTypeFilterConfig =
  <K extends TFilterProperty>(key: K): TCreateFilterConfig<K, TCreateIssueTypeFilterParams> =>
  (params: TCreateIssueTypeFilterParams) =>
    createFilterConfig<K>({
      id: key,
      label: "Type",
      ...params,
      icon: params.filterIcon,
      supportedOperatorConfigsMap: new Map([
        createOperatorConfigEntry(COLLECTION_OPERATOR.IN, params, (updatedParams) =>
          getIssueTypeMultiSelectConfig(updatedParams, EQUALITY_OPERATOR.EXACT)
        ),
      ]),
    });
