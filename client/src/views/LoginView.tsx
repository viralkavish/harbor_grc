import { useState } from 'react';
import { Shield, Lock, Mail, User, AlertCircle, KeyRound, CheckCircle2 } from 'lucide-react';
import { api } from '../lib/api';
import type { Notify } from '../lib/types';

interface LoginViewProps {
  needsBootstrap: boolean;
  setupToken?: string;
  onAuthenticated: (user: any) => void;
  notify: Notify;
}

export function LoginView({ needsBootstrap, setupToken, onAuthenticated, notify }: LoginViewProps) {
  const [isBootstrap, setIsBootstrap] = useState(needsBootstrap);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [tokenInput, setTokenInput] = useState(setupToken || '');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await api.post('/auth/login', {
        email: email.trim().toLowerCase(),
        password
      });
      notify(`Welcome back, ${res.name} (${res.role})`);
      onAuthenticated(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 12) {
      setErrorMessage('Password must be at least 12 characters.');
      return;
    }
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await api.post('/auth/bootstrap_admin', {
        setup_token: tokenInput.trim(),
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password
      });
      notify(`Root administrator provisioned: ${res.name}`);
      onAuthenticated(res);
    } catch (err: any) {
      setErrorMessage(err.message || 'Setup failed. Please check the setup token.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '20px'
    }}>
      <div className="card" style={{
        width: '100%',
        maxWidth: '440px',
        padding: '32px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
        border: '1px solid var(--border)',
        borderRadius: '12px'
      }}>
        {/* Brand Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '48px',
            height: '48px',
            borderRadius: '12px',
            background: 'var(--accent)',
            color: '#fff',
            marginBottom: '12px'
          }}>
            <Shield size={26} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--ink)' }}>
            {isBootstrap ? 'Initial Admin Setup' : 'tofromGRC Login'}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--muted)', margin: 0 }}>
            {isBootstrap
              ? 'Provision the Root Administrator for your internal SOC 2 workspace.'
              : 'Enter your staff credentials to access the compliance console.'}
          </p>
        </div>

        {errorMessage && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            background: 'rgba(255, 107, 107, 0.15)',
            border: '1px solid var(--danger)',
            borderRadius: '6px',
            padding: '10px 14px',
            color: 'var(--danger)',
            fontSize: '12px',
            marginBottom: '18px'
          }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {isBootstrap ? (
          <form onSubmit={handleBootstrap} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="field">
              <span>Setup Token *</span>
              <input
                type="text"
                required
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                placeholder="Single-use setup token"
              />
            </div>

            <div className="field">
              <span>Full Name *</span>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Security Officer"
              />
            </div>

            <div className="field">
              <span>Work Email *</span>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@tofrom.internal"
              />
            </div>

            <div className="field">
              <span>Passphrase (min 12 characters) *</span>
              <input
                type="password"
                required
                minLength={12}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••••••"
              />
            </div>

            <button
              type="submit"
              className="button button-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '6px', padding: '10px' }}
            >
              {loading ? 'Provisioning…' : 'Initialize Workspace'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="field">
              <span>Work Email *</span>
              <div style={{ position: 'relative' }}>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="name@tofrom.internal"
                  autoFocus
                />
              </div>
            </div>

            <div className="field">
              <span>Password *</span>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>

            <button
              type="submit"
              className="button button-primary"
              disabled={loading}
              style={{ width: '100%', marginTop: '6px', padding: '10px' }}
            >
              {loading ? 'Authenticating…' : 'Sign In'}
            </button>
          </form>
        )}

        {/* Auditor Portal Deep Link Note */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: '1px solid var(--border)',
          textAlign: 'center',
          fontSize: '11px',
          color: 'var(--muted)'
        }}>
          External Auditor? Access with your engagement bearer token at{' '}
          <a href="/#auditor" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
            Auditor Portal
          </a>
        </div>
      </div>
    </div>
  );
}
