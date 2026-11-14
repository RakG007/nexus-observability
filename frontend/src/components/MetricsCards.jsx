import React from 'react';
import { Database, AlertTriangle, ShieldAlert, Gauge } from 'lucide-react';

export default function MetricsCards({ kpis }) {
  const cards = [
    {
      label: 'Total Logs Ingested',
      value: (kpis?.totalLogs || 0).toLocaleString(),
      sub: `${kpis?.requestsPerMinute || 0} req/min avg`,
      icon: Database,
      accent: 'text-cyan-300',
      glow: 'from-cyan-400/40 via-sky-400/10 to-transparent',
      bg: 'bg-cyan-500/15 border-cyan-400/30',
      barColor: 'bg-gradient-to-r from-cyan-400 to-sky-400',
      barPct: Math.min(100, Math.max(12, (kpis?.totalLogs || 0) * 1.5)),
    },
    {
      label: 'Error Rate (5xx / Err)',
      value: `${kpis?.errorRate ?? 0}%`,
      sub: `${kpis?.errorCount || 0} errors · ${kpis?.warnCount || 0} warns`,
      icon: AlertTriangle,
      accent: (kpis?.errorRate || 0) > 10 ? 'text-rose-300' : 'text-amber-300',
      glow:
        (kpis?.errorRate || 0) > 10
          ? 'from-rose-400/40 via-rose-500/10 to-transparent'
          : 'from-amber-400/40 via-amber-500/10 to-transparent',
      bg:
        (kpis?.errorRate || 0) > 10
          ? 'bg-rose-500/15 border-rose-400/35'
          : 'bg-amber-500/15 border-amber-400/30',
      barColor:
        (kpis?.errorRate || 0) > 10
          ? 'bg-gradient-to-r from-rose-500 to-amber-400'
          : 'bg-gradient-to-r from-amber-400 to-yellow-300',
      barPct: Math.min(100, Math.max(6, (kpis?.errorRate || 0) * 2.5)),
    },
    {
      label: 'Detected Threats',
      value: (kpis?.threatCount || 0).toLocaleString(),
      sub: `${kpis?.unacknowledgedThreats || 0} unacknowledged alerts`,
      icon: ShieldAlert,
      accent: (kpis?.unacknowledgedThreats || 0) > 0 ? 'text-rose-300' : 'text-emerald-300',
      glow:
        (kpis?.unacknowledgedThreats || 0) > 0
          ? 'from-rose-400/45 via-rose-500/10 to-transparent'
          : 'from-emerald-400/40 via-emerald-500/10 to-transparent',
      bg:
        (kpis?.unacknowledgedThreats || 0) > 0
          ? 'bg-rose-500/15 border-rose-400/35'
          : 'bg-emerald-500/15 border-emerald-400/30',
      barColor:
        (kpis?.unacknowledgedThreats || 0) > 0
          ? 'bg-gradient-to-r from-rose-500 to-pink-400'
          : 'bg-gradient-to-r from-emerald-400 to-cyan-400',
      barPct: Math.min(100, Math.max(8, (kpis?.threatCount || 0) * 6)),
    },
    {
      label: 'Avg / P95 Latency',
      value: `${kpis?.avgLatencyMs || 0} ms`,
      sub: `P95 tail: ${kpis?.p95LatencyMs || 0} ms`,
      icon: Gauge,
      accent: (kpis?.p95LatencyMs || 0) > 1000 ? 'text-amber-300' : 'text-violet-300',
      glow: 'from-violet-400/40 via-cyan-400/10 to-transparent',
      bg: 'bg-violet-500/15 border-violet-400/30',
      barColor: 'bg-gradient-to-r from-violet-400 to-cyan-400',
      barPct: Math.min(100, Math.max(10, ((kpis?.avgLatencyMs || 0) / 1500) * 100)),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className="nexus-card p-4 overflow-hidden group">
            {/* Top-left subtle glass refraction edge */}
            <div
              className={`absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r ${card.glow} opacity-75 group-hover:opacity-100 transition-opacity`}
            />

            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <p className="text-[11px] font-mono font-medium text-slate-400 uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-white font-mono tracking-tight">
                  {card.value}
                </p>
                <p className="text-xs text-slate-400 font-mono truncate">{card.sub}</p>
              </div>
              <div className={`p-2.5 rounded-xl border backdrop-blur-md shrink-0 ${card.bg}`}>
                <Icon className={`w-5 h-5 ${card.accent}`} />
              </div>
            </div>

            {/* Micro telemetry progress rail */}
            <div className="mt-3.5 h-1 w-full rounded-full bg-slate-800/80 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${card.barColor}`}
                style={{ width: `${card.barPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
