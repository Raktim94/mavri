import { useCallback } from 'react';
import { getApi } from '../../api';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import type { StyleProfileUpdate } from '../../types/styleProfiles';
import { useAsyncAction } from '../useAsyncAction';

interface UseStyleProfileUpdateParams extends RequestHook<Response<StyleProfileUpdate>> {
  styleProfile?: StyleProfileUpdate;
}

export const useStyleProfileUpdate = ({
  styleProfile,
  immediate = true,
  showLoader = true,
  onDone
}: UseStyleProfileUpdateParams) => {
  const asyncFn = useCallback(async (): Promise<Response<StyleProfileUpdate>> => {
    if (!styleProfile) return Promise.resolve({ success: false });
    return getApi().updateStyleProfile(styleProfile);
  }, [styleProfile]);

  const { data, loading, execute } = useAsyncAction<Response<StyleProfileUpdate>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data, loading, execute };
};
