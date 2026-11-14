import React, { useState } from 'react';
import {
  Terminal,
  ChevronDown,
  ChevronRight,
  ShieldAlert,
  Clock,
  Wrench,
  ShieldCheck,
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { fixThreatIssue } from '../store/logsSlice';
import { fetchAnalyticsOverview } from '../store/analyticsSlice';

const LEVEL_STYLES = {
  INFO: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30',
  WARN: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  ERROR: 'bg-rose-500/10 text-rose-300 border-rose-500/30',
  CRITICAL: 'bg-red-600/20 text-red-300 border-red-500/50',
};

export default function LiveLogStream({ logs = [], maxItems = 25, title = 'Live Parsed Log Stream' }) {
  const dispatch = useDispatch();
  const activeWindow = useSelector((s) => s.analytics.window);
  const [expandedId, setExpandedId] = useState(null);
  const [fixingId, setFixingId] = useState(null);
  const visibleLogs = logs.slice(0, maxItems);

  const handleFixLog = async (e, logId) => {
    e.stopPropagation();
    setFixingId(logId);
    await dispatch(fixThreatIssue(logId));
    setFixingId(null);
    dispatch(fetchAnalyticsOverview(activeWindow));
  };

  return (
    <div className="nexus-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-cyan-400/15 flex items-center justify-between bg-[#070C1A]/60">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-400/25">
            {visibleLogs.length} events
          </span>
        </div>
        <span className="text-[11px] font-mono text-slate-400">Click row to inspect AST / fields</span>
      </div>

      <div className="divide-y divide-cyan-400/10 max-h-[460px] overflow-y-auto font-mono text-xs">
        {visibleLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No parsed log entries available. Use "Simulate Burst" or "Ingest Logs" to stream telemetry.
          </div>
        ) : (
          visibleLogs.map((log) => {
            const isOpen = expandedId === log._id;
            return (
              <div key={log._id} className="hover:bg-[#131B2E]/60 transition">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setExpandedId(isOpen ? null : log._id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setExpandedId(isOpen ? null : log._id);
                    }
                  }}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 cursor-pointer"
                >
                  <span className="text-slate-500 shrink-0">
                    {isOpen ? (
                      <ChevronDown className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5" />
                    )}
                  </span>

                  <span className="text-slate-500 shrink-0 hidden sm:inline">
                    {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                  </span>

                  <span
                    className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold shrink-0 ${
                      LEVEL_STYLES[log.level] || LEVEL_STYLES.INFO
                    }`}
                  >
                    {log.level}
                  </span>

                  <span className="px-1.5 py-0.5 rounded bg-[#131B2E] border border-[#1F2A44] text-slate-300 text-[10px] uppercase shrink-0">
                    {log.source}
                  </span>

                  {log.isThreat && (
                    <span
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] shrink-0 ${
                        log.remediated
                          ? 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
                          : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                      }`}
                    >
                      {log.remediated ? (
                        <ShieldCheck className="w-3 h-3" />
                      ) : (
                        <ShieldAlert className="w-3 h-3" />
                      )}
                      {log.threatType}
                      {log.remediated ? ' · FIXED' : ''}
                    </span>
                  )}

                  <span className="text-slate-200 truncate flex-1">{log.raw}</span>

                  {log.isThreat && !log.remediated && (
                    <button
                      type="button"
                      disabled={fixingId === log._id}
                      onClick={(e) => handleFixLog(e, log._id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#00E5FF]/15 hover:bg-[#00E5FF]/30 border border-[#00E5FF]/40 text-[#5CF2FF] text-[10px] font-semibold shrink-0 transition"
                    >
                      <Wrench className={`w-3 h-3 ${fixingId === log._id ? 'animate-spin' : ''}`} />
                      {fixingId === log._id ? 'Fixing' : 'Fix'}
                    </button>
                  )}

                  {log.latencyMs !== null && log.latencyMs !== undefined && (
                    <span className="hidden md:inline-flex items-center gap-1 text-slate-400 shrink-0">
                      <Clock className="w-3 h-3" />
                      {log.latencyMs}ms
                    </span>
                  )}
                </div>

                {isOpen && (
                  <div className="px-10 pb-3 pt-1 bg-[#060911]/80 border-t border-[#1F2A44]/50 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
                      <div className="flex flex-wrap gap-3">
                        <span>
                          Rule: <strong className="text-cyan-300">{log.matchedRuleName}</strong>
                        </span>
                        {log.ip && (
                          <span>
                            IP: <strong className="text-slate-200">{log.ip}</strong>
                          </span>
                        )}
                        {log.statusCode && (
                          <span>
                            Status: <strong className="text-slate-200">{log.statusCode}</strong>
                          </span>
                        )}
                        {log.service && (
                          <span>
                            Service: <strong className="text-slate-200">{log.service}</strong>
                          </span>
                        )}
                        {log.isThreat && (
                          <span>
                            Threat Score:{' '}
                            <strong className="text-rose-400">{log.threatScore}/100</strong>
                          </span>
                        )}
                      </div>

                      {log.isThreat && !log.remediated && (
                        <button
                          type="button"
                          disabled={fixingId === log._id}
                          onClick={(e) => handleFixLog(e, log._id)}
                          className="nexus-btn-primary py-1 px-2.5 text-[11px]"
                        >
                          <Wrench className="w-3 h-3" />
                          {fixingId === log._id ? 'Applying Fix...' : 'Fix Issue'}
                        </button>
                      )}
                    </div>

                    {log.remediated && log.remediationSummary && (
                      <div className="px-2.5 py-1.5 rounded bg-emerald-500/10 border border-emerald-400/25 text-[11px] text-emerald-300">
                        ✓ {log.remediationAction}: {log.remediationSummary}
                      </div>
                    )}

                    <pre className="p-2.5 rounded bg-[#0D1321] border border-[#1F2A44] text-[11px] text-emerald-300 overflow-x-auto">
                      {JSON.stringify(log.parsedFields || {}, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
