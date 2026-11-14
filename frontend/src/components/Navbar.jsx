import React from 'react';
import {
  Menu,
  Play,
  Pause,
  Zap,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { setTimeWindow, fetchAnalyticsOverview } from '../store/analyticsSlice';
import {
  setLiveStreamEnabled,
  simulateLogBatch,
  fetchLogs,
  fetchThreats,
} from '../store/logsSlice';

const TIME_WINDOWS = [
  { key: '1h', label: '1H' },
  { key: '24h', label: '24H' },
  { key: '7d', label: '7D' },
];

export default function Navbar({ title, subtitle, onMenuClick, onOpenIngest }) {
  const dispatch = useDispatch();
  const { window: activeWindow, loading: analyticsLoading } = useSelector((s) => s.analytics);
  const { liveStreamEnabled, simulating } = useSelector((s) => s.logs);

  const handleRefresh = () => {
    dispatch(fetchAnalyticsOverview(activeWindow));
    dispatch(fetchLogs({ page: 1, limit: 50 }));
    dispatch(fetchThreats());
  };

  const handleBurst = async () => {
    await dispatch(simulateLogBatch({ count: 10, threatRatio: 0.3 }));
    dispatch(fetchAnalyticsOverview(activeWindow));
    dispatch(fetchThreats());
  };

  return (
    <header className="sticky top-0 z-20 bg-[#060B18]/65 backdrop-blur-2xl border-b border-cyan-400/15 px-4 sm:px-6 py-3.5 shadow-[0_8px_30px_rgba(2,6,23,0.55)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg bg-[#131B2E] border border-[#1F2A44] text-slate-300"
            aria-label="Open menu"
          >
            <Menu className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-base sm:text-lg font-semibold text-white tracking-tight">
              {title}
            </h1>
            {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Time Window Selector */}
          <div className="inline-flex rounded-lg bg-[#0D1321] border border-[#1F2A44] p-0.5">
            {TIME_WINDOWS.map((tw) => (
              <button
                key={tw.key}
                type="button"
                onClick={() => {
                  dispatch(setTimeWindow(tw.key));
                  dispatch(fetchAnalyticsOverview(tw.key));
                }}
                className={`px-2.5 py-1 text-xs font-mono rounded-md transition ${
                  activeWindow === tw.key
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tw.label}
              </button>
            ))}
          </div>

          {/* Live Stream Toggle */}
          <button
            type="button"
            onClick={() => dispatch(setLiveStreamEnabled(!liveStreamEnabled))}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              liveStreamEnabled
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                : 'bg-[#131B2E] border-[#1F2A44] text-slate-300 hover:border-cyan-500/40'
            }`}
          >
            {liveStreamEnabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {liveStreamEnabled ? 'Pause Live' : 'Live Stream'}
          </button>

          {/* Inject Burst */}
          <button
            type="button"
            onClick={handleBurst}
            disabled={simulating}
            className="nexus-btn-secondary text-xs py-1.5 px-3"
            title="Simulate 10 multi-source server logs"
          >
            <Zap className={`w-3.5 h-3.5 text-amber-400 ${simulating ? 'animate-pulse' : ''}`} />
            {simulating ? 'Ingesting...' : 'Simulate Burst'}
          </button>

          {/* Manual Raw Log Ingest */}
          {onOpenIngest && (
            <button
              type="button"
              onClick={onOpenIngest}
              className="nexus-btn-primary text-xs py-1.5 px-3"
            >
              <Upload className="w-3.5 h-3.5" />
              Ingest Logs
            </button>
          )}

          <button
            type="button"
            onClick={handleRefresh}
            className="p-2 rounded-lg bg-[#131B2E] border border-[#1F2A44] text-slate-300 hover:text-cyan-300 transition"
            title="Refresh telemetry"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${analyticsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
}
