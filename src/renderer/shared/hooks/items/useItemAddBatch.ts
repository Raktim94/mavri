import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '../../../state/configureStore';
import { addToast } from '../../../state/pageSlice';
import { getApi } from '../../api/restApi';
import type { Category } from '../../types/category';
import type { Item, ItemAdd } from '../../types/item';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import type { Unit } from '../../types/unit';
import { useCategoriesRetrieve } from '../categories/useCategoriesRetrieve';
import { useUnitsRetrieve } from '../units/useUnitsRetrieve';
import { useAsyncAction } from '../useAsyncAction';

interface UseItemAddParams extends RequestHook<Response<ItemAdd[]>> {
  items?: ItemAdd[];
}

export const useItemAddBatch = ({ items, immediate = true, showLoader = true, onDone }: UseItemAddParams) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation();

  const { execute: reloadUnits } = useUnitsRetrieve({
    immediate: false,
    onDone: (data: Response<Unit[]>) => {
      if (!data.success) {
        if (data.message) dispatch(addToast({ message: data.message, severity: 'error' }));
        else if (data.key) dispatch(addToast({ message: t(data.key), severity: 'error' }));
      }
    }
  });

  const { execute: reloadCategories } = useCategoriesRetrieve({
    immediate: false,
    onDone: (data: Response<Category[]>) => {
      if (!data.success) {
        if (data.message) dispatch(addToast({ message: data.message, severity: 'error' }));
        else if (data.key) dispatch(addToast({ message: t(data.key), severity: 'error' }));
      }
    }
  });

  const asyncFn = useCallback(() => {
    if (!items) return Promise.resolve({ success: false });
    return getApi().addBatchItem(items);
  }, [items]);

  const { data, loading, execute } = useAsyncAction<Response<Item[]>>(asyncFn, {
    immediate,
    showLoader,
    onDone: (data: Response<Item[]>) => {
      reloadCategories();
      reloadUnits();
      if (onDone) onDone(data);
    }
  });

  return { data, loading, execute };
};
