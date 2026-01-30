import { useCallback } from 'react';
import { getApi } from '../../api';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import type { StyleProfileAdd } from '../../types/styleProfiles';
import { useAsyncAction } from '../useAsyncAction';

interface UseStyleProfileParams extends RequestHook<Response<StyleProfileAdd[]>> {
  styleProfiles?: StyleProfileAdd[];
}

export const useStyleProfileAddBatch = ({
  styleProfiles,
  immediate = true,
  showLoader = true,
  onDone
}: UseStyleProfileParams) => {
  const asyncFn = useCallback(() => {
    if (!styleProfiles) return Promise.resolve({ success: false });
    return getApi().addBatchStyleProfile(styleProfiles);
  }, [styleProfiles]);

  const { data, loading, execute } = useAsyncAction<Response<StyleProfileAdd[]>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data, loading, execute };
};
