import { useCallback } from 'react';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import type { StyleProfile } from '../../types/styleProfiles';
import { useAsyncAction } from '../useAsyncAction';

export const useStyleProfilesRetrieve = ({
  immediate = true,
  showLoader = true,
  filter,
  onDone
}: RequestHook<Response<StyleProfile[]>>) => {
  const asyncFn = useCallback(() => window.electronAPI.getAllStyleProfiles(filter), [filter]);
  const { data: styleProfiles, execute } = useAsyncAction<Response<StyleProfile[]>>(asyncFn, {
    showLoader,
    immediate,
    onDone
  });

  return { styleProfiles: styleProfiles?.data ?? [], execute };
};
