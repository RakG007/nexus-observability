import React, { useEffect, useState } from 'react';
import { X, Play, Save, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import {
  testRegexRule,
  createRegexRule,
  updateRegexRule,
  clearTestResults,
} from '../store/logsSlice';

const DEFAULT_SAMPLE = `203.0.113.42 - - [12/Nov/2026:14:22:01 +0000] "GET /api/v1/users?id=42 HTTP/1.1" 200 1842 "-" "Mozilla/5.0" rt=18.4ms
185.220.101.44 - - [12/Nov/2026:14:23:11 +0000] "GET /api/v1/users?id=1%20UNION%20SELECT%201,2-- HTTP/1.1" 403 312 "-" "sqlmap/1.8" rt=11.2ms`;

export default function RegexTesterModal({ isOpen, onClose, initialRule = null }) {
  const dispatch = useDispatch();
  const { testResults, testingRegex } = useSelector((s) => s.logs);

  const [name, setName] = useState('');
  const [sourceType, setSourceType] = useState('custom');
  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('');
  const [priority, setPriority] = useState(50);
  const [severityOverride, setSeverityOverride] = useState('AUTO');
  const [description, setDescription] = useState('');
  const [sampleText, setSampleText] = useState(DEFAULT_SAMPLE);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    dispatch(clearTestResults());
    setSaveError(null);
    if (initialRule) {
      setName(initialRule.name || '');
      setSourceType(initialRule.sourceType || 'custom');
      setPattern(initialRule.pattern || '');
      setFlags(initialRule.flags || '');
      setPriority(initialRule.priority ?? 50);
      setSeverityOverride(initialRule.severityOverride || 'AUTO');
      setDescription(initialRule.description || '');
      setSampleText(initialRule.sampleLine || DEFAULT_SAMPLE);
    } else {
      setName('');
      setSourceType('custom');
      setPattern(
        '^(?<ip>\\d{1,3}(?:\\.\\d{1,3}){3})\\s+\\S+\\s+\\S+\\s+\\[(?<timestamp>[^\\]]+)\\]\\s+"(?<method>[A-Z]+)\\s+(?<path>\\S+)[^"]*"\\s+(?<status>\\d{3})'
      );
      setFlags('');
      setPriority(50);
      setSeverityOverride('AUTO');
      setDescription('');
      setSampleText(DEFAULT_SAMPLE);
    }
  }, [isOpen, initialRule, dispatch]);

  if (!isOpen) return null;

  const handleRunTest = () => {
    setSaveError(null);
    dispatch(testRegexRule({ pattern, flags, sampleText }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError(null);
    if (!name.trim() || !pattern.trim()) {
      setSaveError('Rule name and regex pattern are required.');
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      sourceType,
      pattern,
      flags,
      priority: Number(priority) || 50,
      severityOverride,
      description,
      sampleLine: sampleText.split(/\r?\n/)[0] || '',
    };

    const action = initialRule?._id
      ? await dispatch(updateRegexRule({ id: initialRule._id, updates: payload }))
      : await dispatch(createRegexRule(payload));

    setSaving(false);
    if (action.error) {
      setSaveError(action.payload || 'Failed to save rule');
      return;
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="nexus-card w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F2A44] flex items-center justify-between bg-[#090E1A]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">
              {initialRule ? 'Edit & Test Regex Parsing Rule' : 'Regex Parsing Sandbox & Rule Builder'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#131B2E]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 overflow-y-auto space-y-4">
          {saveError && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-slate-300 mb-1">Rule Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Custom Gateway JSON-KV"
                className="nexus-input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Source Type</label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value)}
                className="nexus-input"
              >
                <option value="nginx">nginx</option>
                <option value="apache">apache</option>
                <option value="auth">auth</option>
                <option value="api">api</option>
                <option value="custom">custom</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Priority (1 = First)</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="nexus-input font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div className="md:col-span-4">
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-slate-300">
                  Regex Pattern (Supports Named Groups: <code>{'(?<ip>...)'}</code>,{' '}
                  <code>{'(?<status>...)'}</code>, <code>{'(?<path>...)'}</code>)
                </label>
              </div>
              <input
                type="text"
                value={pattern}
                onChange={(e) => setPattern(e.target.value)}
                className="nexus-input font-mono text-xs text-cyan-200"
                placeholder="^(?<ip>\d+\.\d+\.\d+\.\d+)..."
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Flags</label>
              <input
                type="text"
                value={flags}
                onChange={(e) => setFlags(e.target.value)}
                placeholder="i"
                className="nexus-input font-mono text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Severity</label>
              <select
                value={severityOverride}
                onChange={(e) => setSeverityOverride(e.target.value)}
                className="nexus-input text-xs"
              >
                <option value="AUTO">AUTO</option>
                <option value="INFO">INFO</option>
                <option value="WARN">WARN</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Sample Unstructured Log Lines (one per line)
            </label>
            <textarea
              rows={4}
              value={sampleText}
              onChange={(e) => setSampleText(e.target.value)}
              className="nexus-input font-mono text-xs leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleRunTest}
              disabled={testingRegex}
              className="nexus-btn-secondary border-cyan-500/40 text-cyan-300"
            >
              <Play className="w-3.5 h-3.5" />
              {testingRegex ? 'Evaluating (ReDoS Guard Active)...' : 'Dry-Run Regex Test'}
            </button>

            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="nexus-btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="nexus-btn-primary">
                <Save className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : initialRule ? 'Update Rule' : 'Save Rule'}
              </button>
            </div>
          </div>

          {/* Dry-Run Evaluation Results */}
          {testResults && (
            <div className="border-t border-[#1F2A44] pt-4 space-y-2">
              <h3 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Dry-Run AST & Extraction Output
              </h3>
              {!testResults.valid ? (
                <div className="p-3 rounded-lg bg-rose-500/15 border border-rose-500/40 text-xs text-rose-200 font-mono">
                  {testResults.error}
                </div>
              ) : (
                <div className="space-y-2">
                  {testResults.results.map((r, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-[#060911] border border-[#1F2A44] font-mono text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 font-semibold ${
                            r.matched ? 'text-emerald-400' : 'text-amber-400'
                          }`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Line {i + 1}: {r.matched ? 'MATCHED' : 'NO MATCH'}
                        </span>
                        <span className="text-slate-500">{r.executionMs} ms</span>
                      </div>
                      <p className="text-slate-400 truncate">{r.line}</p>
                      {r.matched && (
                        <pre className="p-2 rounded bg-[#0D1321] text-cyan-300 overflow-x-auto text-[11px]">
                          {JSON.stringify(r.groups, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
