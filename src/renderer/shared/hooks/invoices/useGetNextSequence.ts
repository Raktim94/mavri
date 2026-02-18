import { useCallback } from 'react';
import { getApi } from '../../api/restApi';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

interface UseSequenceParams extends RequestHook<Response<number | undefined>> {
  seqData: { businessId: number; clientId: number };
}

export const useGetNextSequence = ({ immediate = true, showLoader = true, seqData, onDone }: UseSequenceParams) => {
  const asyncFn = useCallback(() => getApi().getNextSequence(seqData), [seqData]);
  const { data: result, execute } = useAsyncAction<Response<number | undefined>>(asyncFn, {
    showLoader,
    immediate,
    onDone
  });

  return { sequence: result?.data, execute };
};
