import { useCallback } from 'react';
import { getApi } from '../../api';
import type { ExportMeta } from '../../types/exportMeta';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

export const useExportJson = ({ showLoader = true, immediate = true, onDone }: RequestHook<Response<ExportMeta>>) => {
  const asyncFn = useCallback(() => getApi().exportAllData(), []);
  const { data, execute } = useAsyncAction<Response<ExportMeta>>(asyncFn, { showLoader, immediate, onDone });

  return { data, execute };
};
