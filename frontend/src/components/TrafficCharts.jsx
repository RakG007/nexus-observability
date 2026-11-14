import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

const STATUS_COLORS = {
  '2xx': '#10B981',
  '3xx': '#06B6D4',
  '4xx': '#F59E0B',
  '5xx': '#F43F5E',
};

const SOURCE_COLORS = ['#06B6D4', '#8B5CF6', '#10B981', '#F59E0B', '#64748B'];

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#060B18]/90 backdrop-blur-xl border border-cyan-400/25 rounded-xl px-3.5 py-2.5 text-xs shadow-2xl">
      <p className="font-mono text-cyan-200 mb-1.5 border-b border-cyan-400/15 pb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="font-mono flex items-center justify-between gap-4" style={{ color: entry.color }}>
          <span>{entry.name}</span>
          <span className="font-semibold text-white">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function TrafficCharts({ timeSeries = [], statusDistribution = [], sourceBreakdown = [] }) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      {/* Traffic & Threat Volume Time-Series */}
      <div className="nexus-card p-4 xl:col-span-2">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Ingestion Volume & Anomaly Timeline</h2>
            <p className="text-xs text-slate-400">Total parsed requests vs errors and security threats</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-mono">
            <span className="flex items-center gap-1.5 text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400" /> Total
            </span>
            <span className="flex items-center gap-1.5 text-amber-300">
              <span className="w-2 h-2 rounded-full bg-amber-400" /> Errors
            </span>
            <span className="flex items-center gap-1.5 text-rose-300">
              <span className="w-2 h-2 rounded-full bg-rose-500" /> Threats
            </span>
          </div>
        </div>
        <div className="h-64">
          {timeSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
              No telemetry buckets in selected window. Click "Simulate Burst" to stream logs.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeries} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="nexusTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="nexusThreat" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2A44" />
                <XAxis dataKey="label" stroke="#64748B" tick={{ fontSize: 11 }} />
                <YAxis stroke="#64748B" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="total"
                  name="Total"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  fill="url(#nexusTotal)"
                />
                <Area
                  type="monotone"
                  dataKey="errors"
                  name="Errors"
                  stroke="#F59E0B"
                  strokeWidth={1.8}
                  fill="transparent"
                />
                <Area
                  type="monotone"
                  dataKey="threats"
                  name="Threats"
                  stroke="#F43F5E"
                  strokeWidth={2}
                  fill="url(#nexusThreat)"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Status Distribution & Sources */}
      <div className="nexus-card p-4 flex flex-col justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-white">HTTP Status Breakdown</h2>
          <p className="text-xs text-slate-400 mb-3">Response code classes parsed by Regex Engine</p>
          <div className="h-36">
            {statusDistribution.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                No HTTP status logs yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusDistribution} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2A44" />
                  <XAxis dataKey="bucket" stroke="#64748B" tick={{ fontSize: 11 }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" name="Requests" radius={[4, 4, 0, 0]}>
                    {statusDistribution.map((entry) => (
                      <Cell key={entry.bucket} fill={STATUS_COLORS[entry.bucket] || '#06B6D4'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="border-t border-[#1F2A44] pt-3">
          <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
            Telemetry Sources
          </h3>
          <div className="space-y-1.5">
            {sourceBreakdown.length === 0 ? (
              <p className="text-xs text-slate-500 font-mono">No active sources</p>
            ) : (
              sourceBreakdown.map((item, idx) => (
                <div key={item.source} className="flex items-center justify-between text-xs font-mono">
                  <span className="flex items-center gap-2 text-slate-300 uppercase">
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: SOURCE_COLORS[idx % SOURCE_COLORS.length] }}
                    />
                    {item.source}
                  </span>
                  <span className="text-white font-semibold">{item.count}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
