import { useCallback } from 'react';
import { getApi } from '../../api/restApi';
import type { CurrencyUpdate } from '../../types/currency';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

interface UseCurrencyUpdateParams extends RequestHook<Response<CurrencyUpdate>> {
  currency?: CurrencyUpdate;
}

export const useCurrencyUpdate = ({
  currency,
  immediate = true,
  showLoader = true,
  onDone
}: UseCurrencyUpdateParams) => {
  const asyncFn = useCallback((): Promise<Response<CurrencyUpdate>> => {
    if (!currency) return Promise.resolve({ success: false });
    return getApi().updateCurrency(currency);
  }, [currency]);

  const { data, loading, execute } = useAsyncAction<Response<CurrencyUpdate>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data, loading, execute };
};
