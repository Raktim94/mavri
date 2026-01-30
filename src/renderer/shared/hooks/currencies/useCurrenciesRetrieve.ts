import { useCallback } from 'react';
import { getApi } from '../../api';
import type { Currency } from '../../types/currency';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

export const useCurrenciesRetrieve = ({
  showLoader = true,
  immediate = true,
  filter,
  onDone
}: RequestHook<Response<Currency[]>>) => {
  const asyncFn = useCallback(() => getApi().getAllCurrencies(filter), [filter]);
  const { data: currencies, execute } = useAsyncAction<Response<Currency[]>>(asyncFn, {
    showLoader,
    immediate,
    onDone
  });

  return { currencies: currencies?.data ?? [], execute };
};
