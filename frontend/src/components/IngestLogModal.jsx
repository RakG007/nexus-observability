import React, { useState } from 'react';
import { X, Upload, AlertCircle } from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { ingestRawLogs, fetchLogs, fetchThreats } from '../store/logsSlice';
import { fetchAnalyticsOverview } from '../store/analyticsSlice';

const PRESET_RAW = `203.0.113.42 - - [12/Nov/2026:15:02:11 +0000] "GET /api/v1/orders?page=2 HTTP/1.1" 200 2410 "-" "Mozilla/5.0" rt=21.4ms
185.220.101.44 - - [12/Nov/2026:15:02:15 +0000] "GET /api/v1/users?id=1%20UNION%20SELECT%20password%20FROM%20users-- HTTP/1.1" 403 310 "-" "sqlmap/1.8" rt=12.1ms
Nov 12 15:02:20 prod-bastion-01 sshd[8120]: Failed password for invalid user root from 45.155.205.91 port 51204 ssh2
2026-11-12T15:02:25.102Z [ERROR] service=payments-core method=POST path=/api/v1/charge status=502 latency=1940.5ms ip=10.24.8.19 msg="Gateway timeout"`;

export default function IngestLogModal({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const activeWindow = useSelector((s) => s.analytics.window);

  const [rawLogs, setRawLogs] = useState(PRESET_RAW);
  const [source, setSource] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!rawLogs.trim()) {
      setError('Paste at least one raw log line to ingest.');
      return;
    }
    setSubmitting(true);
    const res = await dispatch(
      ingestRawLogs({ rawLogs, ...(source ? { source } : {}) })
    );
    setSubmitting(false);

    if (res.error) {
      setError(res.payload || 'Ingestion failed');
      return;
    }

    dispatch(fetchAnalyticsOverview(activeWindow));
    dispatch(fetchLogs({ page: 1, limit: 50 }));
    dispatch(fetchThreats());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="nexus-card w-full max-w-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#1F2A44] flex items-center justify-between bg-[#090E1A]">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Ingest Unstructured Server Logs</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#131B2E]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-rose-500/15 border border-rose-500/40 text-rose-200 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Source Override (Optional — leave Auto to let Regex Rules classify)
            </label>
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="nexus-input"
            >
              <option value="">Auto-detect via Active Regex Rules</option>
              <option value="nginx">nginx</option>
              <option value="apache">apache</option>
              <option value="auth">auth</option>
              <option value="api">api</option>
              <option value="custom">custom</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Raw Log Lines (Newline-delimited, up to 500 lines per batch)
            </label>
            <textarea
              rows={8}
              value={rawLogs}
              onChange={(e) => setRawLogs(e.target.value)}
              className="nexus-input font-mono text-xs leading-relaxed"
              placeholder="Paste Nginx, Apache, Syslog, or API telemetry lines..."
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={onClose} className="nexus-btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="nexus-btn-primary">
              <Upload className="w-3.5 h-3.5" />
              {submitting ? 'Parsing & Indexing...' : 'Parse & Ingest'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
