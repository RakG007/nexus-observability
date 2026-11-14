import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  Activity,
  Terminal,
  Regex,
  ShieldAlert,
  LogOut,
  Radio,
  Globe,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { logout } from '../store/authSlice';
import CipherLogiqLogo from './CipherLogiqLogo';

const NAV_ITEMS = [
  { to: '/', label: 'Observability Hub', icon: Activity },
  { to: '/probe', label: 'URL Inspector', icon: Globe },
  { to: '/logs', label: 'Log Explorer', icon: Terminal },
  { to: '/rules', label: 'Regex Rules', icon: Regex },
  { to: '/threats', label: 'Threat Monitor', icon: ShieldAlert },
];

export default function Sidebar({ mobileOpen, onClose }) {
  const dispatch = useDispatch();
  const { user } = useSelector((s) => s.auth);
  const { liveStreamEnabled } = useSelector((s) => s.logs);
  const unackCount = useSelector((s) => s.analytics.kpis?.unacknowledgedThreats || 0);

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#070C1A]/75 backdrop-blur-2xl border-r border-cyan-400/15 flex flex-col justify-between transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div>
          {/* Brand Header */}
          <div className="px-4 py-5 border-b border-[#00E5FF]/15">
            <CipherLogiqLogo size="sm" />
          </div>

          {/* Live Telemetry Pill */}
          <div className="px-4 pt-4">
            <div
              className={`flex items-center justify-between px-3 py-2 rounded-xl border backdrop-blur-md text-xs font-mono ${
                liveStreamEnabled
                  ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300 shadow-[0_0_20px_-6px_rgba(16,185,129,0.5)]'
                  : 'bg-[#0C1427]/70 border-cyan-400/15 text-slate-400'
              }`}
            >
              <span className="flex items-center gap-2">
                <Radio
                  className={`w-3.5 h-3.5 ${liveStreamEnabled ? 'animate-pulse text-emerald-400' : ''}`}
                />
                {liveStreamEnabled ? 'NEURAL STREAM ON' : 'STREAM STANDBY'}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  liveStreamEnabled ? 'bg-emerald-400' : 'bg-slate-600'
                }`}
              />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 py-5 space-y-1.5">
            {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                onClick={onClose}
                className={({ isActive }) =>
                  `relative flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-cyan-500/20 via-sky-500/10 to-transparent text-cyan-200 border border-cyan-400/35 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-cyan-400 shadow-[0_0_10px_#22D3EE]" />
                    )}
                    <span className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-300' : ''}`} />
                      {label}
                    </span>
                    {to === '/threats' && unackCount > 0 && (
                      <span className="px-1.5 py-0.5 text-[11px] font-mono rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/40">
                        {unackCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* User Footer */}
        <div className="p-4 border-t border-[#1F2A44] space-y-3">
          <div className="flex items-center gap-3 px-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 font-bold text-xs uppercase">
              {user?.name?.slice(0, 2) || 'CL'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {user?.name || 'Analyst'}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{user?.organization || 'Cipher Logiq'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => dispatch(logout())}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-slate-300 bg-[#131B2E] hover:bg-rose-500/15 hover:text-rose-300 border border-[#1F2A44] hover:border-rose-500/30 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
          <p className="text-[10px] text-center text-slate-500 font-mono">
            Engineered by Rakshak Gupta
          </p>
        </div>
      </aside>
    </>
  );
}
