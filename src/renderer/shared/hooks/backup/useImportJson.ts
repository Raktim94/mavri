import { useCallback } from 'react';
import { getApi } from '../../api';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

export const useImportJson = ({ showLoader = true, immediate = true, onDone }: RequestHook<Response<unknown>>) => {
  const asyncFn = useCallback(() => getApi().importAllData(), []);
  const { data, execute } = useAsyncAction<Response<unknown>>(asyncFn, { showLoader, immediate, onDone });

  return { data, execute };
};
