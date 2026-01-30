import { useCallback } from 'react';
import { getApi } from '../../api';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import type { UnitUpdate } from '../../types/unit';
import { useAsyncAction } from '../useAsyncAction';

interface UseUnitUpdateParams extends RequestHook<Response<UnitUpdate>> {
  unit?: UnitUpdate;
}

export const useUnitUpdate = ({ unit, immediate = true, showLoader = true, onDone }: UseUnitUpdateParams) => {
  const asyncFn = useCallback(async (): Promise<Response<UnitUpdate>> => {
    if (!unit) return Promise.resolve({ success: false });
    return getApi().updateUnit(unit);
  }, [unit]);

  const { data, loading, execute } = useAsyncAction<Response<UnitUpdate>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data, loading, execute };
};
