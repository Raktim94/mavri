import { useCallback } from 'react';
import { getApi } from '../../api';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

interface UseStyleProfileDeleteParams extends RequestHook<Response<unknown>> {
  id: number;
}

export const useStyleProfileDelete = ({
  id,
  immediate = true,
  showLoader = true,
  onDone
}: UseStyleProfileDeleteParams) => {
  const asyncFn = useCallback(() => getApi().deleteStyleProfile(id), [id]);
  const { data, loading, execute } = useAsyncAction<Response<unknown>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data, loading, execute };
};
