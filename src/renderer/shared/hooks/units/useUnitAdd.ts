import { useCallback } from 'react';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import type { Unit, UnitAdd } from '../../types/unit';
import { useAsyncAction } from '../useAsyncAction';

interface UseUnitAddParams extends RequestHook<Response<Unit>> {
  unit?: UnitAdd;
}

export const useUnitAdd = ({ unit, immediate = true, showLoader = true, onDone }: UseUnitAddParams) => {
  const asyncFn = useCallback(() => {
    if (!unit) return Promise.resolve({ success: false });
    return window.electronAPI.addUnit(unit);
  }, [unit]);

  const { data, loading, execute } = useAsyncAction<Response<Unit>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data: data?.data, loading, execute };
};
