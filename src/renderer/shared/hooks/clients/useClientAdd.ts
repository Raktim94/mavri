import { useCallback } from 'react';
import type { Client, ClientAdd } from '../../types/client';
import type { RequestHook } from '../../types/requestHook';
import type { Response } from '../../types/response';
import { useAsyncAction } from '../useAsyncAction';

interface UseClientAddParams extends RequestHook<Response<Client>> {
  client?: ClientAdd;
}

export const useClientAdd = ({ client, immediate = true, showLoader = true, onDone }: UseClientAddParams) => {
  const asyncFn = useCallback(() => {
    if (!client) return Promise.resolve({ success: false });
    return window.electronAPI.addClient(client);
  }, [client]);

  const { data, loading, execute } = useAsyncAction<Response<Client>>(asyncFn, {
    immediate,
    showLoader,
    onDone
  });

  return { data: data?.data, loading, execute };
};
