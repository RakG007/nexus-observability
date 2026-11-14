import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ShieldAlert, Skull, Globe, CheckCircle2, Wrench } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { fetchThreats, fixAllThreatIssues } from '../store/logsSlice';
import { fetchAnalyticsOverview } from '../store/analyticsSlice';
import ThreatFeed from '../components/ThreatFeed';

export default function ThreatMonitor() {
  const dispatch = useDispatch();
  const { threats, threatSummary, fixingAll } = useSelector((s) => s.logs);
  const activeWindow = useSelector((s) => s.analytics.window);

  useEffect(() => {
    dispatch(fetchThreats({ limit: 50 }));
  }, [dispatch]);

  const handleFixAll = async () => {
    await dispatch(fixAllThreatIssues());
    dispatch(fetchThreats({ limit: 50 }));
    dispatch(fetchAnalyticsOverview(activeWindow));
  };

  return (
    <div className="space-y-5">
      {threatSummary.unacknowledgedCount > 0 && (
        <div className="nexus-glass-hero p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-white">
                {threatSummary.unacknowledgedCount} Open Security / Anomaly Alerts Detected
              </p>
              <p className="text-xs text-slate-300 font-mono">
                Deploy automated WAF, IP quarantine, CSP, and circuit-breaker playbooks in one click.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={fixingAll}
            onClick={handleFixAll}
            className="nexus-btn-primary text-xs"
          >
            <Wrench className={`w-3.5 h-3.5 ${fixingAll ? 'animate-spin' : ''}`} />
            {fixingAll ? 'Applying Playbooks...' : `Fix All Issues (${threatSummary.unacknowledgedCount})`}
          </button>
        </div>
      )}
      {/* Security KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="nexus-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-medium">Total Threat Events</p>
            <p className="text-2xl font-bold font-mono text-white mt-1">
              {threatSummary.totalThreats}
            </p>
          </div>
          <ShieldAlert className="w-6 h-6 text-rose-400" />
        </div>
        <div className="nexus-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-medium">Unacknowledged Alerts</p>
            <p className="text-2xl font-bold font-mono text-amber-300 mt-1">
              {threatSummary.unacknowledgedCount}
            </p>
          </div>
          <CheckCircle2 className="w-6 h-6 text-amber-400" />
        </div>
        <div className="nexus-card p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400 uppercase font-medium">Mean Risk Score</p>
            <p className="text-2xl font-bold font-mono text-cyan-300 mt-1">
              {threatSummary.avgThreatScore}/100
            </p>
          </div>
          <Skull className="w-6 h-6 text-cyan-400" />
        </div>
      </div>

      {/* Classification Chart & Offending IPs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="nexus-card p-4">
          <h2 className="text-sm font-semibold text-white mb-1">Attack Vector Breakdown</h2>
          <p className="text-xs text-slate-400 mb-3">Signature & heuristic threat categories</p>
          <div className="h-56">
            {threatSummary.byType.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500 font-mono">
                No threat vectors recorded
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={threatSummary.byType} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1F2A44" />
                  <XAxis dataKey="threatType" stroke="#64748B" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748B" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#090E1A',
                      borderColor: '#1F2A44',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="count" name="Events" fill="#F43F5E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="nexus-card overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1F2A44] bg-[#090E1A] flex items-center gap-2">
            <Globe className="w-4 h-4 text-rose-400" />
            <h2 className="text-sm font-semibold text-white">Top Offending Source IPs</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-[#090E1A]/60 text-slate-400 uppercase">
                <tr>
                  <th className="px-4 py-2.5">Source IP</th>
                  <th className="px-4 py-2.5">Vectors</th>
                  <th className="px-4 py-2.5 text-right">Events</th>
                  <th className="px-4 py-2.5 text-right">Max Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1F2A44]/60">
                {threatSummary.topIps.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                      No offending IPs detected.
                    </td>
                  </tr>
                ) : (
                  threatSummary.topIps.map((item) => (
                    <tr key={item.ip} className="hover:bg-[#131B2E]/50">
                      <td className="px-4 py-2.5 text-cyan-300">{item.ip}</td>
                      <td className="px-4 py-2.5 text-slate-300">{item.types.join(', ')}</td>
                      <td className="px-4 py-2.5 text-right text-white">{item.count}</td>
                      <td className="px-4 py-2.5 text-right text-rose-400 font-semibold">
                        {item.maxScore}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <ThreatFeed threats={threats} maxItems={50} onAfterAck={() => dispatch(fetchThreats())} />
    </div>
  );
}
