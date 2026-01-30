import { useCallback } from 'react';
import { getApi } from '../../api';
import type { ItemUpdate } from '../../types/item';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

interface UseItemUpdateParams extends RequestHook<Response<ItemUpdate>> {
  item?: ItemUpdate;
}

export const useItemUpdate = ({ item, immediate = true, showLoader = true, onDone }: UseItemUpdateParams) => {
  const asyncFn = useCallback(async (): Promise<Response<ItemUpdate>> => {
    if (!item) return Promise.resolve({ success: false });
    return getApi().updateItem(item);
  }, [item]);

  const { data, loading, execute } = useAsyncAction<Response<ItemUpdate>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data, loading, execute };
};
