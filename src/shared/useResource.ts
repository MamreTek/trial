import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText } from './api/client';
export function useResource<T>(load: () => Promise<T>, poll = 0) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++generation.current;
    setLoading(true); setError('');
    try { const value = await load(); if (id === generation.current) setData(value); }
    catch (e) { if (id === generation.current) setError(errorText(e)); }
    finally { if (id === generation.current) setLoading(false); }
  }, [load]);
  const invalidate = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    void refresh();
    const onMockChange = () => void refresh();
    window.addEventListener('trial:mock-change', onMockChange);
    const timer = poll ? setInterval(() => void refresh(), poll) : undefined;
    return () => { invalidate(); clearInterval(timer); window.removeEventListener('trial:mock-change', onMockChange); };
  }, [refresh, poll, invalidate]);
  return { data, loading, error, refresh };
}
