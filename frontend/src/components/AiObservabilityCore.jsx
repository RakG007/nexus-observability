import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, Cpu, ArrowUpRight, Zap, Activity, Wrench, CheckCircle2, Globe } from 'lucide-react';
import { CipherLogiqMark } from './CipherLogiqLogo';

/**
 * Rimac-inspired Hyper-Telemetry Cockpit HUD.
 * Displays precision graduated radial instrumentation, swept vector telemetry, live AI synthesis, and 1-click Auto-Fix.
 */
export default function AiObservabilityCore({
  kpis,
  threatBreakdown = [],
  topThreatIPs = [],
  topEndpoints = [],
  liveStreamEnabled = false,
  fixingAll = false,
  onTriggerBurst,
  onFixAllIssues,
}) {
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const [lastFixNotice, setLastFixNotice] = useState(null);

  const handleFixAll = async () => {
    if (!onFixAllIssues) return;
    const res = await onFixAllIssues();
    if (res?.fixedCount > 0) {
      setLastFixNotice(`Mitigated ${res.fixedCount} issue${res.fixedCount > 1 ? 's' : ''}`);
      setTimeout(() => setLastFixNotice(null), 5000);
    }
  };

  const handleMouseMove = (e) => {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
    el.style.setProperty('--my', `${e.clientY - rect.top}px`);
  };

  const telemetry = useMemo(() => {
    const totalLogs = kpis?.totalLogs || 0;
    const errorRate = kpis?.errorRate || 0;
    const unack = kpis?.unacknowledgedThreats || 0;
    const p95 = kpis?.p95LatencyMs || 0;

    const penalty =
      Math.min(40, errorRate * 1.6) +
      Math.min(35, unack * 4.5) +
      (p95 > 1500 ? 15 : p95 > 600 ? 7 : 0);
    const healthScore = totalLogs === 0 ? 100 : Math.max(15, Math.round(100 - penalty));

    const status =
      healthScore < 60 || unack >= 5
        ? {
            label: 'CRITICAL ANOMALY',
            stroke: '#F43F5E',
            badge: 'bg-rose-500/15 border-rose-400/40 text-rose-300',
          }
        : healthScore < 85 || unack > 0
          ? {
              label: 'ELEVATED TELEMETRY',
              stroke: '#F59E0B',
              badge: 'bg-amber-500/15 border-amber-400/40 text-amber-300',
            }
          : {
              label: 'SYSTEM NOMINAL',
              stroke: '#00E5FF',
              badge: 'bg-[#00E5FF]/15 border-[#00E5FF]/40 text-[#5CF2FF]',
            };

    const topVector = threatBreakdown[0];
    const topIp = topThreatIPs[0];
    const slowestEp = [...topEndpoints].sort(
      (a, b) => (b.avgLatencyMs || 0) - (a.avgLatencyMs || 0)
    )[0];

    const insights = [];
    if (totalLogs === 0) {
      insights.push(
        'Telemetry cockpit standby. Pulse a burst or ingest server logs to initialize baseline diagnostics.'
      );
    } else {
      if (topVector) {
        insights.push(
          `Primary vector: ${topVector.threatType} (${topVector.count} flagged events in active window).`
        );
      } else {
        insights.push('Zero hostile signatures detected across current parsed telemetry window.');
      }

      if (topIp) {
        insights.push(
          `Top threat origin ${topIp.ip} (${topIp.count} hits · peak risk ${topIp.maxScore}/100).`
        );
      }

      if (slowestEp && slowestEp.avgLatencyMs > 0) {
        insights.push(
          `Peak route latency on ${slowestEp.path} averaging ${slowestEp.avgLatencyMs} ms.`
        );
      }
    }

    return { healthScore, status, insights };
  }, [kpis, threatBreakdown, topThreatIPs, topEndpoints]);

  // 270-degree hypercar-style digital cockpit arc
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const arcSpan = circumference * 0.75; // 270 deg sweep
  const filledArc = (telemetry.healthScore / 100) * arcSpan;

  // Graduated CAD tick marks around the 270-deg arc
  const ticks = Array.from({ length: 19 }, (_, idx) => {
    const angleDeg = 135 + idx * 15;
    const rad = (angleDeg * Math.PI) / 180;
    const rOuter = 54;
    const rInner = idx % 3 === 0 ? 48.5 : 51;
    return {
      x1: 60 + rInner * Math.cos(rad),
      y1: 60 + rInner * Math.sin(rad),
      x2: 60 + rOuter * Math.cos(rad),
      y2: 60 + rOuter * Math.sin(rad),
      major: idx % 3 === 0,
    };
  });

  return (
    <section
      ref={cardRef}
      onMouseMove={handleMouseMove}
      className="nexus-glass-hero p-5 sm:p-6 group"
    >
      {/* Pointer-tracking specular sheen */}
      <div className="absolute inset-0 nexus-spotlight opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Swept cyan telemetry hairline */}
      <div className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-[#00E5FF]/5 to-transparent animate-scan-sweep pointer-events-none" />

      {/* Chamfered corner precision accent lines */}
      <div className="absolute top-0 left-0 w-8 h-px bg-[#00E5FF]/60 pointer-events-none" />
      <div className="absolute top-0 left-0 h-8 w-px bg-[#00E5FF]/60 pointer-events-none" />

      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 flex-1">
          {/* Rimac-style Graduated Digital Cockpit Gauge */}
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-full h-full">
              {/* Outer rotating reticle */}
              <circle
                cx="60"
                cy="60"
                r="57"
                fill="none"
                stroke="rgba(0,229,255,0.16)"
                strokeWidth="0.8"
                strokeDasharray="3 7"
                className="origin-center animate-spin-slow"
              />

              {/* CAD calibration ticks */}
              {ticks.map((tk, idx) => (
                <line
                  key={idx}
                  x1={tk.x1}
                  y1={tk.y1}
                  x2={tk.x2}
                  y2={tk.y2}
                  stroke={tk.major ? 'rgba(226,232,240,0.55)' : 'rgba(0,229,255,0.28)'}
                  strokeWidth={tk.major ? '1.3' : '0.8'}
                />
              ))}

              {/* Background 270° track */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="rgba(4, 7, 14, 0.72)"
                stroke="rgba(30, 41, 59, 0.85)"
                strokeWidth="5.5"
                strokeDasharray={`${arcSpan} ${circumference}`}
                strokeLinecap="butt"
                transform="rotate(135 60 60)"
              />

              {/* Active Telemetry Arc */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={telemetry.status.stroke}
                strokeWidth="5.5"
                strokeLinecap="butt"
                strokeDasharray={`${filledArc} ${circumference}`}
                transform="rotate(135 60 60)"
                className="transition-all duration-700"
                style={{ filter: `drop-shadow(0 0 8px ${telemetry.status.stroke})` }}
              />
            </svg>

            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pt-1">
              <span className="text-2xl font-bold font-mono text-white leading-none tracking-tight">
                {telemetry.healthScore}
                <span className="text-xs text-[#00E5FF] ml-0.5">%</span>
              </span>
              <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-slate-400 mt-1.5">
                INTEGRITY
              </span>
            </div>
          </div>

          {/* Diagnostic Synthesis */}
          <div className="space-y-2.5 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#00E5FF]/10 border border-[#00E5FF]/35 text-[10px] font-mono font-semibold uppercase tracking-[0.18em] text-[#5CF2FF]">
                <CipherLogiqMark className="w-3.5 h-3.5" glow={false} />
                CIPHER LOGIQ // AI CORE
              </span>
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono uppercase tracking-[0.16em] border ${telemetry.status.badge}`}
              >
                <Activity className="w-3 h-3" />
                {telemetry.status.label}
              </span>
              {liveStreamEnabled && (
                <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-widest bg-emerald-500/15 border border-emerald-400/35 text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  LIVE TELEMETRY
                </span>
              )}
            </div>

            <h2 className="text-base sm:text-lg font-semibold text-white tracking-wide uppercase">
              Autonomous Telemetry & Threat Intelligence
            </h2>

            <ul className="space-y-1 text-xs text-slate-300 font-mono">
              {telemetry.insights.map((line, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-[#00E5FF] mt-0.5">▸</span>
                  <span className="leading-relaxed">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action Dock */}
        <div className="flex flex-row lg:flex-col flex-wrap gap-2 shrink-0">
          {(kpis?.unacknowledgedThreats || 0) > 0 && onFixAllIssues && (
            <button
              type="button"
              disabled={fixingAll}
              onClick={handleFixAll}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-400 via-teal-400 to-[#00E5FF] hover:from-emerald-300 hover:to-[#5CF2FF] text-slate-950 font-semibold text-xs tracking-wide transition shadow-[0_8px_24px_-6px_rgba(16,185,129,0.55)] disabled:opacity-50"
            >
              <Wrench className={`w-3.5 h-3.5 ${fixingAll ? 'animate-spin' : ''}`} />
              {fixingAll
                ? 'Applying Remediation...'
                : `Fix All Issues (${kpis.unacknowledgedThreats})`}
            </button>
          )}

          {lastFixNotice && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {lastFixNotice}
            </div>
          )}

          <button
            type="button"
            onClick={() => navigate('/probe')}
            className="nexus-btn-secondary text-xs justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-[#00E5FF]" />
              Check Live URL
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/threats')}
            className="nexus-btn-secondary text-xs justify-between gap-3 border-rose-400/25 hover:border-rose-400/55"
          >
            <span className="flex items-center gap-2">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              SOC Threat Triage
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          <button
            type="button"
            onClick={() => navigate('/rules')}
            className="nexus-btn-secondary text-xs justify-between gap-3"
          >
            <span className="flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5 text-[#00E5FF]" />
              Regex AST Sandbox
            </span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {onTriggerBurst && (
            <button
              type="button"
              onClick={onTriggerBurst}
              className="nexus-btn-primary text-xs justify-center"
            >
              <Zap className="w-3.5 h-3.5" />
              Pulse Neural Burst
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
