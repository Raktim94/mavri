import type { TFunction } from 'i18next';

import type { FilterType } from '../enums/filterType';

import type { CustomOption } from './customOption';

export interface FilterData {
  type: FilterType;
  value?: string;
}

export interface Filter {
  label: string;
  value?: string;
  description?: string;
  type: FilterType;
  options?: Options<string | number | symbol>;
  initial?: boolean;
  isGroup?: boolean;
  shouldCloseOnClick?: boolean;
}

export interface FilterConfig {
  t: TFunction;
  namespace: string;
  initial?: FilterType;
  shouldCloseOnClick?: boolean;
}

type Options<T extends string | number | symbol> = CustomOption<T>[];
