import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../errors';

interface AsyncResourceOptions<T> {
  resourceKey: string;
  load: () => Promise<T>;
  initialData: T;
  errorMessage: string;
  logLabel: string;
}

interface AsyncResourceState<T> {
  resourceKey: string | null;
  data: T;
  error: string | null;
}

/**
 * Loads server data that belongs to the active business.
 *
 * The resource key prevents data from the previous business from being
 * presented as current while a business switch is in progress.
 */
export function useAsyncResource<T>({
  resourceKey,
  load,
  initialData,
  errorMessage,
  logLabel,
}: AsyncResourceOptions<T>) {
  const [state, setState] = useState<AsyncResourceState<T>>({
    resourceKey: null,
    data: initialData,
    error: null,
  });
  const [requestVersion, setRequestVersion] = useState(0);

  useEffect(() => {
    let isCancelled = false;

    void load()
      .then((data) => {
        if (isCancelled) return;

        setState({
          resourceKey,
          data,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (isCancelled) return;

        console.error(`${logLabel}:`, getErrorMessage(error));
        setState({
          resourceKey,
          data: initialData,
          error: errorMessage,
        });
      });

    return () => {
      isCancelled = true;
    };
  }, [
    errorMessage,
    initialData,
    load,
    logLabel,
    requestVersion,
    resourceKey,
  ]);

  const refresh = useCallback(() => {
    setRequestVersion((version) => version + 1);
  }, []);

  return {
    data: state.data,
    error: state.error,
    isLoading: state.resourceKey !== resourceKey,
    refresh,
  };
}
