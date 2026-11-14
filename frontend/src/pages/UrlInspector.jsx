import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Globe,
  Search,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  Clock,
  Server,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Wrench,
} from 'lucide-react';
import { probeTargetUrl, fixThreatIssue } from '../store/logsSlice';
import { fetchAnalyticsOverview } from '../store/analyticsSlice';

const QUICK_PRESETS = [
  'https://github.com',
  'https://example.com',
  'https://httpbin.org/status/500',
  'http://neverssl.com',
];

export default function UrlInspector() {
  const dispatch = useDispatch();
  const { probingUrl, lastProbeResult, probeHistory, probeError } = useSelector((s) => s.logs);
  const activeWindow = useSelector((s) => s.analytics.window);

  const [urlInput, setUrlInput] = useState('https://example.com');
  const [fixing, setFixing] = useState(false);

  const runProbe = async (target) => {
    const clean = (target ?? urlInput).trim();
    if (!clean) return;
    setUrlInput(clean);
    await dispatch(probeTargetUrl(clean));
    dispatch(fetchAnalyticsOverview(activeWindow));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    runProbe(urlInput);
  };

  const handleFixProbedLog = async (logId) => {
    setFixing(true);
    await dispatch(fixThreatIssue(logId));
    setFixing(false);
    dispatch(fetchAnalyticsOverview(activeWindow));
  };

  const probe = lastProbeResult?.probe;
  const log = lastProbeResult?.log;

  return (
    <div className="space-y-5">
      {/* URL Input Hero Bar */}
      <section className="nexus-glass-hero p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#00E5FF]/15 border border-[#00E5FF]/35 text-[10px] font-mono uppercase tracking-[0.18em] text-[#5CF2FF]">
              <Globe className="w-3 h-3" />
              SSRF-PROTECTED LIVE PROBE
            </span>
            <h2 className="text-base sm:text-lg font-semibold text-white mt-2">
              Inspect Any Live Website or API Endpoint URL
            </h2>
            <p className="text-xs text-slate-300">
              Measures real-time HTTP status, response latency, TLS encryption, and OWASP security
              headers, then indexes the parsed telemetry into Nexus.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Enter any URL (e.g., https://github.com or https://example.com)"
              className="nexus-input pl-10 font-mono text-sm"
            />
          </div>
          <button type="submit" disabled={probingUrl} className="nexus-btn-primary px-6 py-2.5">
            <Search className={`w-4 h-4 ${probingUrl ? 'animate-spin' : ''}`} />
            {probingUrl ? 'Probing URL...' : 'Check URL'}
          </button>
        </form>

        {/* Quick Demo URL Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-mono text-[11px]">Quick test targets:</span>
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={probingUrl}
              onClick={() => runProbe(preset)}
              className="px-2.5 py-1 rounded-lg bg-[#0B1221]/80 hover:bg-[#13203A] border border-[#00E5FF]/20 hover:border-[#00E5FF]/50 text-cyan-200 font-mono text-[11px] transition"
            >
              {preset}
            </button>
          ))}
        </div>

        {probeError && (
          <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs font-mono">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{probeError}</span>
          </div>
        )}
      </section>

      {/* Live Probe Telemetry Result */}
      {probe && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {/* Security Score & Grade */}
            <div className="nexus-card p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase">Security Grade</p>
                <p className="text-2xl font-bold font-mono text-white mt-1">
                  {probe.grade}{' '}
                  <span className="text-sm text-[#00E5FF]">({probe.securityScore}/100)</span>
                </p>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  {probe.missingHeaders.length} missing headers
                </p>
              </div>
              {probe.securityScore >= 75 ? (
                <ShieldCheck className="w-7 h-7 text-emerald-400" />
              ) : (
                <ShieldAlert className="w-7 h-7 text-amber-400" />
              )}
            </div>

            {/* HTTP Status */}
            <div className="nexus-card p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase">HTTP Status</p>
                <p
                  className={`text-2xl font-bold font-mono mt-1 ${
                    probe.statusCode >= 500 || !probe.reachable
                      ? 'text-rose-400'
                      : probe.statusCode >= 400
                        ? 'text-amber-300'
                        : 'text-emerald-300'
                  }`}
                >
                  {probe.statusCode}
                </p>
                <p className="text-xs font-mono text-slate-400 mt-0.5 truncate max-w-[180px]">
                  {probe.statusText}
                </p>
              </div>
              <Server className="w-7 h-7 text-cyan-400" />
            </div>

            {/* Latency */}
            <div className="nexus-card p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase">Response Latency</p>
                <p className="text-2xl font-bold font-mono text-white mt-1">
                  {probe.latencyMs} <span className="text-sm text-slate-400">ms</span>
                </p>
                <p className="text-xs font-mono text-slate-400 mt-0.5">
                  Resolved IP: {probe.resolvedIp}
                </p>
              </div>
              <Clock className="w-7 h-7 text-violet-400" />
            </div>

            {/* TLS / Transport */}
            <div className="nexus-card p-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-mono text-slate-400 uppercase">Transport Security</p>
                <p
                  className={`text-lg font-bold font-mono mt-1 ${
                    probe.isHttps ? 'text-emerald-300' : 'text-rose-400'
                  }`}
                >
                  {probe.isHttps ? 'HTTPS / TLS' : 'UNENCRYPTED HTTP'}
                </p>
                <p className="text-xs font-mono text-slate-400 mt-0.5 truncate max-w-[180px]">
                  Server: {probe.serverHeader}
                </p>
              </div>
              {probe.isHttps ? (
                <Lock className="w-7 h-7 text-emerald-400" />
              ) : (
                <Unlock className="w-7 h-7 text-rose-400" />
              )}
            </div>
          </div>

          {/* Security Headers Audit & Generated Log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="nexus-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">OWASP HTTP Security Headers Audit</h3>
              <div className="space-y-2">
                {probe.headerAudit.map((h) => (
                  <div
                    key={h.header}
                    className="p-2.5 rounded-lg bg-[#050912]/80 border border-cyan-400/10 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono font-semibold text-slate-200 flex items-center gap-2">
                        {h.present ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        )}
                        {h.label}
                      </p>
                      <p className="text-[11px] font-mono text-slate-400 mt-0.5 truncate">
                        {h.present ? h.value : h.advice}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 ${
                        h.present
                          ? 'bg-emerald-500/15 border-emerald-400/35 text-emerald-300'
                          : 'bg-amber-500/15 border-amber-400/35 text-amber-300'
                      }`}
                    >
                      {h.present ? `+${h.weight} pts` : 'MISSING'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="nexus-card p-4 space-y-3 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-white">
                    Ingested Nexus Telemetry Log
                  </h3>
                  {log?.isThreat && !log?.remediated && (
                    <button
                      type="button"
                      disabled={fixing}
                      onClick={() => handleFixProbedLog(log._id)}
                      className="nexus-btn-primary py-1 px-3 text-xs"
                    >
                      <Wrench className={`w-3.5 h-3.5 ${fixing ? 'animate-spin' : ''}`} />
                      {fixing ? 'Fixing...' : 'Fix Issue'}
                    </button>
                  )}
                  {log?.remediated && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-mono">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      FIXED
                    </span>
                  )}
                </div>

                <div className="p-3 rounded-lg bg-[#050912] border border-cyan-400/15 font-mono text-xs text-cyan-200 break-all">
                  {probe.rawLogLine}
                </div>

                {log?.remediated && log?.remediationSummary && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-400/30 text-xs font-mono text-emerald-300">
                    ✓ {log.remediationAction}: {log.remediationSummary}
                  </div>
                )}

                <pre className="p-3 rounded-lg bg-[#050912] border border-cyan-400/15 font-mono text-[11px] text-emerald-300 overflow-x-auto max-h-56">
                  {JSON.stringify(log?.parsedFields || {}, null, 2)}
                </pre>
              </div>

              <p className="text-[11px] font-mono text-slate-400">
                Saved to MongoDB LogEntry ({log?._id}) · Matched rule:{' '}
                <span className="text-cyan-300">{log?.matchedRuleName}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Session Probe History */}
      {probeHistory.length > 0 && (
        <div className="nexus-card overflow-hidden">
          <div className="px-4 py-3 border-b border-cyan-400/15 bg-[#070C1A]/60">
            <h3 className="text-sm font-semibold text-white">Recent URL Probes (This Session)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#070C1A]/50 text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Target URL</th>
                  <th className="px-4 py-2.5">Resolved IP</th>
                  <th className="px-4 py-2.5 text-right">Status</th>
                  <th className="px-4 py-2.5 text-right">Latency</th>
                  <th className="px-4 py-2.5 text-right">Grade</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-400/10">
                {probeHistory.map((item, idx) => (
                  <tr key={`${item.probe.targetUrl}-${idx}`} className="hover:bg-cyan-400/5">
                    <td className="px-4 py-2.5 text-cyan-300 truncate max-w-sm">
                      {item.probe.targetUrl}
                    </td>
                    <td className="px-4 py-2.5 text-slate-300">{item.probe.resolvedIp}</td>
                    <td className="px-4 py-2.5 text-right text-white">{item.probe.statusCode}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-300">
                      {item.probe.latencyMs} ms
                    </td>
                    <td className="px-4 py-2.5 text-right text-white font-semibold">
                      {item.probe.grade} ({item.probe.securityScore})
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
