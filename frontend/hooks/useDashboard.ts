'use client';
import { useEffect, useState } from 'react';
import { timestamp } from '../lib/presentation';
import type { ApiClient } from '../lib/api';
import type { CameraObservation } from '../types';

export function useObservations(client: ApiClient, cameraIds: string[], refreshKey: string | null) {
  const ids = [...new Set(cameraIds)].sort().join('\u001f');
  const [state, setState] = useState<{ observations: CameraObservation[]; loading: boolean; error: string | null }>({ observations: [], loading: true, error: null });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    const cameras = ids ? ids.split('\u001f') : [];
    setState((previous) => ({ ...previous, loading: true }));
    void Promise.allSettled(cameras.map((id) => client.observations(id, controller.signal))).then((results) => {
      if (controller.signal.aborted) return;
      const observations = results.flatMap((result) => result.status === 'fulfilled' ? result.value : []).sort((a, b) => timestamp(b.timestamp) - timestamp(a.timestamp));
      const failed = results.some((result) => result.status === 'rejected');
      setState({ observations, loading: false, error: failed ? 'Some observation history could not be loaded.' : null });
    });
    return () => controller.abort();
  }, [client, ids, refreshKey, retry]);
  return { ...state, retry: () => setRetry((value) => value + 1) };
}
