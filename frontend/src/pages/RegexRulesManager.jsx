import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Edit3, Trash2, Regex, ShieldCheck } from 'lucide-react';
import {
  fetchRegexRules,
  updateRegexRule,
  deleteRegexRule,
} from '../store/logsSlice';
import RegexTesterModal from '../components/RegexTesterModal';

export default function RegexRulesManager() {
  const dispatch = useDispatch();
  const { rules } = useSelector((s) => s.logs);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  useEffect(() => {
    dispatch(fetchRegexRules());
  }, [dispatch]);

  const handleToggleActive = (rule) => {
    dispatch(
      updateRegexRule({
        id: rule._id,
        updates: { isActive: !rule.isActive },
      })
    );
  };

  return (
    <div className="space-y-4">
      <div className="nexus-card p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white">
              ReDoS-Protected Regex Parsing Engine
            </h2>
            <p className="text-xs text-slate-400">
              Rules run in priority order (lowest number first) inside a 50ms V8 sandbox timeout.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingRule(null);
            setModalOpen(true);
          }}
          className="nexus-btn-primary text-xs"
        >
          <Plus className="w-4 h-4" />
          New Regex Rule
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {rules.map((rule) => (
          <div key={rule._id} className="nexus-card p-4 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Regex className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-sm text-white">{rule.name}</span>
                <span className="px-2 py-0.5 rounded bg-[#131B2E] border border-[#1F2A44] text-[10px] font-mono uppercase text-slate-300">
                  {rule.sourceType}
                </span>
                <span className="px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-[10px] font-mono text-cyan-300">
                  Priority {rule.priority}
                </span>
                {rule.isDefault && (
                  <span className="px-2 py-0.5 rounded bg-indigo-500/15 border border-indigo-500/30 text-[10px] font-mono text-indigo-300">
                    BUILT-IN
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleToggleActive(rule)}
                  className={`px-2.5 py-1 rounded text-xs font-mono border transition ${
                    rule.isActive
                      ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                      : 'bg-[#131B2E] border-[#1F2A44] text-slate-400'
                  }`}
                >
                  {rule.isActive ? 'ENABLED' : 'DISABLED'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingRule(rule);
                    setModalOpen(true);
                  }}
                  className="nexus-btn-secondary py-1 px-2.5 text-xs"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Test / Edit
                </button>
                <button
                  type="button"
                  onClick={() => dispatch(deleteRegexRule(rule._id))}
                  className="p-1.5 rounded-lg bg-[#131B2E] border border-[#1F2A44] text-slate-400 hover:text-rose-400 hover:border-rose-500/40 transition"
                  title="Delete rule"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {rule.description && <p className="text-xs text-slate-400">{rule.description}</p>}

            <div className="p-2.5 rounded-lg bg-[#060911] border border-[#1F2A44] font-mono text-xs text-cyan-200 overflow-x-auto">
              /{rule.pattern}/{rule.flags}
            </div>
          </div>
        ))}
      </div>

      <RegexTesterModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialRule={editingRule}
      />
    </div>
  );
}
