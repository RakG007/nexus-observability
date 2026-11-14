import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Lock, Mail, AlertCircle, ArrowRight } from 'lucide-react';
import { loginUser, clearAuthError } from '../store/authSlice';
import CipherLogiqLogo from '../components/CipherLogiqLogo';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token, loading, error } = useSelector((s) => s.auth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  useEffect(() => {
    if (token) navigate('/', { replace: true });
  }, [token, navigate]);

  const handleSubmit = (e) => {
    e.preventDefault();
    dispatch(loginUser({ email, password }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md nexus-glass-hero p-6 sm:p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-3">
          <CipherLogiqLogo size="lg" />
          <p className="text-xs text-slate-300 font-mono tracking-wide">
            Real-Time Server Telemetry & Threat Intelligence
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="rakshak@cipherlogiq.io"
                className="nexus-input pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="nexus-input pl-10"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full nexus-btn-primary py-2.5">
            {loading ? 'Authenticating...' : 'Sign In to Nexus'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <p className="text-center text-xs text-slate-400">
          New to Cipher Logiq?{' '}
          <Link to="/register" className="text-cyan-400 hover:text-cyan-300 font-medium">
            Provision an Analyst Workspace
          </Link>
        </p>
      </div>
    </div>
  );
}
