import { useCallback } from 'react';
import { getApi } from '../../api/restApi';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import type { UnitAdd } from '../../types/unit';
import { useAsyncAction } from '../useAsyncAction';

interface UseUnitAddParams extends RequestHook<Response<UnitAdd[]>> {
  units?: UnitAdd[];
}

export const useUnitAddBatch = ({ units, immediate = true, showLoader = true, onDone }: UseUnitAddParams) => {
  const asyncFn = useCallback(() => {
    if (!units) return Promise.resolve({ success: false });
    return getApi().addBatchUnit(units);
  }, [units]);

  const { data, loading, execute } = useAsyncAction<Response<UnitAdd[]>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data, loading, execute };
};
