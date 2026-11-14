import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Search, Filter, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchLogs, clearAllLogs } from '../store/logsSlice';
import { fetchAnalyticsOverview } from '../store/analyticsSlice';
import LiveLogStream from '../components/LiveLogStream';

export default function LogExplorer() {
  const dispatch = useDispatch();
  const { items, pagination, loading } = useSelector((s) => s.logs);
  const activeWindow = useSelector((s) => s.analytics.window);

  const [search, setSearch] = useState('');
  const [level, setLevel] = useState('');
  const [source, setSource] = useState('');
  const [isThreat, setIsThreat] = useState('');
  const [page, setPage] = useState(1);
  const [confirmClear, setConfirmClear] = useState(false);

  const loadLogs = (targetPage = page) => {
    dispatch(
      fetchLogs({
        page: targetPage,
        limit: 40,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(level ? { level } : {}),
        ...(source ? { source } : {}),
        ...(isThreat ? { isThreat } : {}),
      })
    );
  };

  useEffect(() => {
    loadLogs(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, level, source, isThreat]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    loadLogs(1);
  };

  const handleClear = async () => {
    await dispatch(clearAllLogs());
    setConfirmClear(false);
    dispatch(fetchAnalyticsOverview(activeWindow));
  };

  return (
    <div className="space-y-4">
      {/* Filter Toolbar */}
      <form
        onSubmit={handleSearchSubmit}
        className="nexus-card p-4 flex flex-wrap items-center gap-3"
      >
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search IP, path, service, rule, or raw payload..."
            className="nexus-input pl-10 font-mono text-xs"
          />
        </div>

        <select
          value={level}
          onChange={(e) => {
            setLevel(e.target.value);
            setPage(1);
          }}
          className="nexus-input w-36 text-xs"
        >
          <option value="">All Levels</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
          <option value="CRITICAL">CRITICAL</option>
        </select>

        <select
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(1);
          }}
          className="nexus-input w-36 text-xs"
        >
          <option value="">All Sources</option>
          <option value="nginx">nginx</option>
          <option value="apache">apache</option>
          <option value="auth">auth</option>
          <option value="api">api</option>
          <option value="custom">custom</option>
        </select>

        <select
          value={isThreat}
          onChange={(e) => {
            setIsThreat(e.target.value);
            setPage(1);
          }}
          className="nexus-input w-36 text-xs"
        >
          <option value="">All Events</option>
          <option value="true">Threats Only</option>
          <option value="false">Normal Traffic</option>
        </select>

        <button type="submit" className="nexus-btn-primary text-xs">
          <Filter className="w-3.5 h-3.5" />
          Apply
        </button>

        {!confirmClear ? (
          <button
            type="button"
            onClick={() => setConfirmClear(true)}
            className="nexus-btn-secondary text-xs text-rose-300 hover:border-rose-500/40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Clear Workspace
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              className="px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold"
            >
              Confirm Delete All
            </button>
            <button
              type="button"
              onClick={() => setConfirmClear(false)}
              className="nexus-btn-secondary text-xs"
            >
              Cancel
            </button>
          </div>
        )}
      </form>

      <LiveLogStream
        logs={items}
        maxItems={40}
        title={loading ? 'Querying MongoDB Atlas...' : `Indexed Log Explorer (${pagination.total} total)`}
      />

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 text-xs font-mono text-slate-400">
        <span>
          Page {pagination.page} of {pagination.pages} ({pagination.total} records)
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="nexus-btn-secondary py-1.5 px-3 text-xs"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Prev
          </button>
          <button
            type="button"
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
            className="nexus-btn-secondary py-1.5 px-3 text-xs"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
