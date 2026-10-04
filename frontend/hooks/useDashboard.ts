'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, type ApiClient, errorMessage } from '../lib/api';
import { timestamp } from '../lib/presentation';
import type { CameraObservation, IncidentWorkflow, MapData, UserSummary, WorkflowPatch, WorkflowStatus } from '../types';

// Reused by data and session checks; hidden tabs do no scheduled work.
function useVisiblePolling(refresh: () => Promise<void>) {
  useEffect(() => {
    const run = () => { if (!document.hidden) void refresh(); };
    run();
    const interval = setInterval(run, 15_000);
    document.addEventListener('visibilitychange', run);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', run); };
  }, [refresh]);
}

export function useDashboard(client: ApiClient) {
  const [data, setData] = useState<MapData | null>(null);
  const [workflows, setWorkflows] = useState<Record<string, IncidentWorkflow>>({});
  const [workflowStatus, setWorkflowStatus] = useState<WorkflowStatus>('loading');
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSuccess, setLastSuccess] = useState<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const hasWorkflows = useRef(false);
  const revision = useRef(0);
  const saved = useRef<Record<string, { workflow: IncidentWorkflow; revision: number }>>({});
  const saving = useRef(new Set<string>());
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    const startedAtRevision = revision.current;
    setRefreshing(true);
    const [mapResult, workflowResult] = await Promise.allSettled([client.map(controller.signal), client.workflows(controller.signal)]);
    if (controller.signal.aborted || !mounted.current) return;
    if (mapResult.status === 'fulfilled') {
      setData(mapResult.value);
      setLastSuccess(new Date().toISOString());
      setError(null);
    } else setError(errorMessage(mapResult.reason));
    if (workflowResult.status === 'fulfilled') {
      const next = Object.fromEntries(workflowResult.value.map((item) => [item.incident_id, item]));
      // A read started before a save, or an older replica response, cannot undo it.
      for (const [id, entry] of Object.entries(saved.current)) {
        if (entry.revision > startedAtRevision || timestamp(entry.workflow.updated_at) >= timestamp(next[id]?.updated_at)) next[id] = entry.workflow;
      }
      setWorkflows((previous) => {
        for (const [id, workflow] of Object.entries(previous)) {
          if (timestamp(workflow.updated_at) > timestamp(next[id]?.updated_at)) next[id] = workflow;
        }
        return next;
      });
      hasWorkflows.current = true;
      setWorkflowStatus('ready');
      setWorkflowError(null);
    } else {
      setWorkflowStatus(hasWorkflows.current ? 'stale' : 'unavailable');
      setWorkflowError(errorMessage(workflowResult.reason));
    }
    pending.current = null;
    setRefreshing(false);
  }, [client]);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current?.abort(); pending.current = null; };
  }, []);
  useVisiblePolling(refresh);

  const saveWorkflow = useCallback(async (id: string, patch: WorkflowPatch) => {
    if (saving.current.has(id)) throw new Error('A change is already being saved.');
    saving.current.add(id);
    try {
      const workflow = await client.saveWorkflow(id, patch);
      if (mounted.current) {
        saved.current[id] = { workflow, revision: ++revision.current };
        setWorkflows((previous) => ({ ...previous, [id]: workflow }));
      }
      return workflow;
    } finally { saving.current.delete(id); }
  }, [client]);

  return { data, workflows, workflowStatus, workflowError, error, refreshing, lastSuccess, refresh, saveWorkflow };
}

export function useSession(client: ApiClient) {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const checking = useRef<AbortController | null>(null);
  const epoch = useRef(0);
  const operation = useRef(false);

  const check = useCallback(async () => {
    if (checking.current || operation.current) return;
    const controller = new AbortController();
    checking.current = controller;
    const version = epoch.current;
    try {
      const current = await client.me(controller.signal);
      if (controller.signal.aborted || version !== epoch.current) return;
      setUser(current);
      setError(null);
      if (!current) { setUsers([]); setRosterError(null); return; }
      try {
        const roster = await client.users(controller.signal);
        if (!controller.signal.aborted && version === epoch.current) { setUsers(roster); setRosterError(null); }
      } catch (cause) {
        if (controller.signal.aborted || version !== epoch.current) return;
        setUsers([]);
        setRosterError(errorMessage(cause));
        if (cause instanceof ApiError && cause.status === 401) { setUser(null); setError(errorMessage(cause)); }
      }
    } catch (cause) {
      if (!controller.signal.aborted && version === epoch.current) { setError('Session unavailable. ' + errorMessage(cause)); setUser(null); setUsers([]); }
    } finally { if (checking.current === controller) checking.current = null; }
  }, [client]);
  useVisiblePolling(check);
  useEffect(() => () => { epoch.current++; checking.current?.abort(); checking.current = null; }, []);

  const authenticate = async (email?: string, password?: string) => {
    if (operation.current) throw new Error('A session request is already in progress.');
    operation.current = true;
    epoch.current++;
    checking.current?.abort();
    checking.current = null;
    setBusy(true);
    try {
      if (email !== undefined && password !== undefined) {
        const current = await client.login(email, password);
        setUser(current);
        setError(null);
      } else {
        await client.logout();
        setUser(null);
        setUsers([]);
        setError(null);
      }
    } catch (cause) { setError(errorMessage(cause)); throw cause; }
    finally { setBusy(false); operation.current = false; }
    void check();
  };
  const expire = () => {
    epoch.current++;
    checking.current?.abort();
    checking.current = null;
    setUser(null);
    setUsers([]);
    setError('Your session has expired. Sign in again.');
  };
  return { user, users, error, rosterError, busy, login: (email: string, password: string) => authenticate(email, password), logout: () => authenticate(), expire, check };
}
export type Session = ReturnType<typeof useSession>;

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
