import { useCallback } from 'react';
import { getApi } from '../../api';
import type { CategoryUpdate } from '../../types/category';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

interface UseCategoryUpdateParams extends RequestHook<Response<CategoryUpdate>> {
  category?: CategoryUpdate;
}

export const useCategoryUpdate = ({
  category,
  immediate = true,
  showLoader = true,
  onDone
}: UseCategoryUpdateParams) => {
  const asyncFn = useCallback(async (): Promise<Response<CategoryUpdate>> => {
    if (!category) return Promise.resolve({ success: false });
    return getApi().updateCategory(category);
  }, [category]);

  const { data, loading, execute } = useAsyncAction<Response<CategoryUpdate>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data, loading, execute };
};
