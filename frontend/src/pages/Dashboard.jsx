import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchAnalyticsOverview } from '../store/analyticsSlice';
import {
  fetchLogs,
  fetchThreats,
  simulateLogBatch,
  fixAllThreatIssues,
} from '../store/logsSlice';
import AiObservabilityCore from '../components/AiObservabilityCore';
import MetricsCards from '../components/MetricsCards';
import TrafficCharts from '../components/TrafficCharts';
import LiveLogStream from '../components/LiveLogStream';
import ThreatFeed from '../components/ThreatFeed';

export default function Dashboard() {
  const dispatch = useDispatch();
  const {
    window: activeWindow,
    kpis,
    timeSeries,
    statusDistribution,
    sourceBreakdown,
    topEndpoints,
    topThreatIPs,
    threatBreakdown,
  } = useSelector((s) => s.analytics);
  const { items: logs, threats, liveStreamEnabled, fixingAll } = useSelector((s) => s.logs);

  useEffect(() => {
    dispatch(fetchAnalyticsOverview(activeWindow));
    dispatch(fetchLogs({ page: 1, limit: 30 }));
    dispatch(fetchThreats({ limit: 15 }));
  }, [dispatch, activeWindow]);

  const handleNeuralBurst = async () => {
    await dispatch(simulateLogBatch({ count: 10, threatRatio: 0.3 }));
    dispatch(fetchAnalyticsOverview(activeWindow));
    dispatch(fetchThreats({ limit: 15 }));
  };

  const handleFixAll = async () => {
    const action = await dispatch(fixAllThreatIssues());
    await dispatch(fetchAnalyticsOverview(activeWindow));
    await dispatch(fetchThreats({ limit: 15 }));
    return action.payload;
  };

  return (
    <div className="space-y-5">
      <AiObservabilityCore
        kpis={kpis}
        threatBreakdown={threatBreakdown}
        topThreatIPs={topThreatIPs}
        topEndpoints={topEndpoints}
        liveStreamEnabled={liveStreamEnabled}
        fixingAll={fixingAll}
        onTriggerBurst={handleNeuralBurst}
        onFixAllIssues={handleFixAll}
      />

      <MetricsCards kpis={kpis} />

      <TrafficCharts
        timeSeries={timeSeries}
        statusDistribution={statusDistribution}
        sourceBreakdown={sourceBreakdown}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <LiveLogStream logs={logs} maxItems={20} title="Real-Time Telemetry Tail" />
        </div>
        <div>
          <ThreatFeed
            threats={threats}
            maxItems={10}
            onAfterAck={() => dispatch(fetchAnalyticsOverview(activeWindow))}
          />
        </div>
      </div>

      {/* Top Endpoints Glass Table */}
      <div className="nexus-card overflow-hidden">
        <div className="px-4 py-3 border-b border-cyan-400/15 bg-[#070C1A]/60 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Top Observed Endpoints</h2>
          <span className="text-[11px] font-mono text-cyan-300/80">
            {topEndpoints.length} active routes
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#070C1A]/50 text-slate-400 font-mono uppercase">
              <tr>
                <th className="px-4 py-2.5">Endpoint Path</th>
                <th className="px-4 py-2.5 text-right">Requests</th>
                <th className="px-4 py-2.5 text-right">Errors</th>
                <th className="px-4 py-2.5 text-right">Avg Latency</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-400/10 font-mono">
              {topEndpoints.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    No HTTP endpoint metrics recorded in this window.
                  </td>
                </tr>
              ) : (
                topEndpoints.map((ep) => (
                  <tr key={ep.path} className="hover:bg-cyan-400/5 transition-colors">
                    <td className="px-4 py-2.5 text-cyan-300 truncate max-w-md">{ep.path}</td>
                    <td className="px-4 py-2.5 text-right text-slate-200">{ep.requests}</td>
                    <td
                      className={`px-4 py-2.5 text-right ${
                        ep.errors > 0 ? 'text-rose-400 font-semibold' : 'text-slate-400'
                      }`}
                    >
                      {ep.errors}
                    </td>
                    <td className="px-4 py-2.5 text-right text-emerald-300">
                      {ep.avgLatencyMs} ms
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
