'use client';

import { useState, type FormEvent } from 'react';
import { DetailDialog } from './DetailDialog';
import type { Session } from '../hooks/useDashboard';
import { errorMessage } from '../lib/api';
import { demoAccounts, demoPassword } from '../lib/mock';
import type { DataSource } from '../types';

export function LoginDialog({ source, session, onClose }: { source: DataSource; session: Session; onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try { await session.login(email, password); onClose(); }
    catch (cause) { setError(errorMessage(cause)); }
  };
  return <DetailDialog compact title="Operator sign in" eyebrow={source === 'demo' ? 'SIMULATED SESSION' : 'SENTINELX OPERATORS'} onClose={onClose}>
    <p className="muted">Sign in with a precreated operator account to assign, acknowledge and resolve incidents.</p>
    {source === 'demo' && <div className="notice"><strong>Demo accounts</strong><p>{demoAccounts.map((account) => account.email).join(' or ')}</p><p>Password: <code>{demoPassword}</code></p><p>Actions are simulated and saved for this browser tab.</p></div>}
    <form onSubmit={(event) => void submit(event)} className="login-form">
      <label>Email<input type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <label>Password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      {error && <p className="inline-error" role="alert">{error}</p>}
      <button className="primary-button" disabled={session.busy} type="submit">{session.busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  </DetailDialog>;
}
