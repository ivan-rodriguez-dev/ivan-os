import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react';
import { errorMessage } from '@/lib/errors';

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  /** Re-runs the fetcher, keeping current data visible while it loads. */
  reload: () => Promise<void>;
}

/** Loads async data, reloading when `deps` change. Stale responses are ignored. */
export function useQuery<T>(fetcher: () => Promise<T>, deps: DependencyList): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const reload = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const result = await fetcherRef.current();
      if (id !== requestId.current) return;
      setData(result);
      setError(null);
    } catch (err) {
      if (id !== requestId.current) return;
      setError(errorMessage(err));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    return () => {
      requestId.current++;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error, reload };
}
