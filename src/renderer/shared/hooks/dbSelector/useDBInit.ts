import { useCallback } from 'react';
import { getApi } from '../../api';
import { DBInitType } from '../../enums/dbInitType';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

interface UseInitDBParams extends RequestHook<Response<unknown>> {
  fullPath: string;
  mode?: DBInitType;
}

export const useDBInit = ({
  fullPath,
  mode = DBInitType.create,
  immediate = true,
  showLoader = true,
  onDone
}: UseInitDBParams) => {
  const asyncFn = useCallback(() => getApi().initializeDatabase({ fullPath, mode }), [fullPath, mode]);
  const { data, execute } = useAsyncAction<Response<unknown>>(asyncFn, { showLoader, immediate, onDone });

  return { data, execute };
};
