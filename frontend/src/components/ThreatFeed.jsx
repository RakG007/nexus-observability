import React, { useState } from 'react';
import { ShieldAlert, CheckCircle2, RotateCcw, Wrench, ShieldCheck } from 'lucide-react';
import { useDispatch } from 'react-redux';
import { acknowledgeThreatLog, fixThreatIssue } from '../store/logsSlice';

export default function ThreatFeed({ threats = [], maxItems = 10, onAfterAck }) {
  const dispatch = useDispatch();
  const [fixingId, setFixingId] = useState(null);
  const visible = threats.slice(0, maxItems);

  const handleToggle = async (item) => {
    await dispatch(
      acknowledgeThreatLog({ id: item._id, acknowledged: !item.acknowledged })
    );
    if (onAfterAck) onAfterAck();
  };

  const handleFix = async (item) => {
    setFixingId(item._id);
    await dispatch(fixThreatIssue(item._id));
    setFixingId(null);
    if (onAfterAck) onAfterAck();
  };

  return (
    <div className="nexus-card overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-cyan-400/15 flex items-center justify-between bg-[#070C1A]/60">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-rose-400" />
          <h2 className="text-sm font-semibold text-white">Security & Anomaly Feed</h2>
        </div>
        <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-rose-500/15 border border-rose-400/30 text-rose-300">
          {threats.filter((t) => !t.acknowledged).length} open
        </span>
      </div>

      <div className="divide-y divide-cyan-400/10 max-h-[460px] overflow-y-auto">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500 font-mono">
            Zero threats detected in the active log window.
          </div>
        ) : (
          visible.map((threat) => (
            <div
              key={threat._id}
              className={`p-3.5 transition ${
                threat.remediated
                  ? 'bg-emerald-500/[0.04]'
                  : threat.acknowledged
                    ? 'opacity-70 bg-[#090E1A]/40'
                    : 'hover:bg-[#131B2E]/60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                      threat.remediated
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40'
                        : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                    }`}
                  >
                    {threat.threatType}
                  </span>
                  {threat.remediated && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-400/40">
                      <ShieldCheck className="w-3 h-3" />
                      FIXED
                    </span>
                  )}
                  <span className="text-xs font-mono text-amber-300">
                    Score {threat.threatScore}
                  </span>
                  {threat.ip && (
                    <span className="text-xs font-mono text-cyan-300">{threat.ip}</span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {!threat.remediated && (
                    <button
                      type="button"
                      disabled={fixingId === threat._id}
                      onClick={() => handleFix(threat)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-semibold bg-[#00E5FF]/15 hover:bg-[#00E5FF]/30 border border-[#00E5FF]/45 text-[#5CF2FF] transition disabled:opacity-50"
                      title="Apply automated remediation playbook"
                    >
                      <Wrench className={`w-3 h-3 ${fixingId === threat._id ? 'animate-spin' : ''}`} />
                      {fixingId === threat._id ? 'Fixing...' : 'Fix'}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleToggle(threat)}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition ${
                      threat.acknowledged
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-[#131B2E]'
                        : 'bg-[#131B2E] border-[#1F2A44] text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300'
                    }`}
                  >
                    {threat.acknowledged ? (
                      <>
                        <RotateCcw className="w-3 h-3" /> Reopen
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Ack
                      </>
                    )}
                  </button>
                </div>
              </div>

              <p className="text-xs font-mono text-slate-300 break-all line-clamp-2">
                {threat.raw}
              </p>

              {threat.remediated && threat.remediationSummary && (
                <div className="mt-2 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-400/25 text-[11px] font-mono text-emerald-300">
                  ✓ {threat.remediationAction}: {threat.remediationSummary}
                </div>
              )}

              <p className="text-[10px] font-mono text-slate-500 mt-1">
                {new Date(threat.timestamp).toLocaleString()} · {threat.matchedRuleName}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
