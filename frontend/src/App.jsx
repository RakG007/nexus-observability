import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { registerUnauthorizedHandler } from './services/api';
import { logout, fetchCurrentUser } from './store/authSlice';
import { simulateLogBatch, fetchThreats, fetchLogs } from './store/logsSlice';
import { fetchAnalyticsOverview } from './store/analyticsSlice';

import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import IngestLogModal from './components/IngestLogModal';
import DynamicGlassBackdrop from './components/DynamicGlassBackdrop';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import UrlInspector from './pages/UrlInspector';
import LogExplorer from './pages/LogExplorer';
import RegexRulesManager from './pages/RegexRulesManager';
import ThreatMonitor from './pages/ThreatMonitor';

const PAGE_META = {
  '/': {
    title: 'Observability Hub',
    subtitle: 'Real-time ingestion metrics, latency percentiles, and anomaly detection',
  },
  '/probe': {
    title: 'Live URL Inspector',
    subtitle: 'Probe any website or API URL for status, latency, TLS, and OWASP security headers',
  },
  '/logs': {
    title: 'Log Explorer',
    subtitle: 'Search, filter, and inspect parsed AST telemetry across all servers',
  },
  '/rules': {
    title: 'Regex Rules Engine',
    subtitle: 'Author, dry-run, and prioritize ReDoS-safe log parsing rules',
  },
  '/threats': {
    title: 'Threat Monitor (SOC)',
    subtitle: 'Live SQLi, XSS, path traversal, and brute-force forensic triage',
  },
};

function ProtectedShell() {
  const dispatch = useDispatch();
  const location = useLocation();
  const { token } = useSelector((s) => s.auth);
  const { liveStreamEnabled } = useSelector((s) => s.logs);
  const activeWindow = useSelector((s) => s.analytics.window);

  const [mobileOpen, setMobileOpen] = useState(false);
  const [ingestOpen, setIngestOpen] = useState(false);

  useEffect(() => {
    if (token) {
      dispatch(fetchCurrentUser());
    }
  }, [token, dispatch]);

  // Serverless-friendly short-interval live telemetry streaming
  useEffect(() => {
    if (!token || !liveStreamEnabled) return undefined;
    const timer = setInterval(async () => {
      await dispatch(simulateLogBatch({ count: 3, threatRatio: 0.25 }));
      dispatch(fetchAnalyticsOverview(activeWindow));
      dispatch(fetchThreats({ limit: 20 }));
      if (location.pathname === '/logs') {
        dispatch(fetchLogs({ page: 1, limit: 40 }));
      }
    }, 4500);

    return () => clearInterval(timer);
  }, [token, liveStreamEnabled, activeWindow, location.pathname, dispatch]);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  const meta = PAGE_META[location.pathname] || PAGE_META['/'];

  return (
    <div className="min-h-screen text-slate-100 flex relative z-10">
      <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex-1 min-w-0 flex flex-col">
        <Navbar
          title={meta.title}
          subtitle={meta.subtitle}
          onMenuClick={() => setMobileOpen(true)}
          onOpenIngest={() => setIngestOpen(true)}
        />

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/probe" element={<UrlInspector />} />
            <Route path="/logs" element={<LogExplorer />} />
            <Route path="/rules" element={<RegexRulesManager />} />
            <Route path="/threats" element={<ThreatMonitor />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>

      <IngestLogModal isOpen={ingestOpen} onClose={() => setIngestOpen(false)} />
    </div>
  );
}

export default function App() {
  const dispatch = useDispatch();
  const unackThreats = useSelector((s) => s.analytics.kpis?.unacknowledgedThreats || 0);

  useEffect(() => {
    registerUnauthorizedHandler(() => {
      dispatch(logout());
    });
  }, [dispatch]);

  return (
    <BrowserRouter>
      <div className="relative min-h-screen bg-[#04070F]">
        <DynamicGlassBackdrop threatAlert={unackThreats > 0} />
        <div className="relative z-10">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/*" element={<ProtectedShell />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
