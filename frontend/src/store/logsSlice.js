import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchLogs = createAsyncThunk(
  'logs/fetchLogs',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/logs', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch logs');
    }
  }
);

export const simulateLogBatch = createAsyncThunk(
  'logs/simulate',
  async (payload = { count: 6, threatRatio: 0.25 }, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/logs/simulate', payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Simulation failed');
    }
  }
);

export const probeTargetUrl = createAsyncThunk(
  'logs/probeUrl',
  async (url, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/logs/probe-url', { url });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to probe URL');
    }
  }
);

export const ingestRawLogs = createAsyncThunk(
  'logs/ingest',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/logs/ingest', payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Log ingestion failed');
    }
  }
);

export const fetchThreats = createAsyncThunk(
  'logs/fetchThreats',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/logs/threats', { params });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch threat feed');
    }
  }
);

export const acknowledgeThreatLog = createAsyncThunk(
  'logs/acknowledgeThreat',
  async ({ id, acknowledged }, { rejectWithValue }) => {
    try {
      const { data } = await api.patch(`/logs/${id}/acknowledge`, { acknowledged });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to acknowledge threat');
    }
  }
);

export const fixThreatIssue = createAsyncThunk(
  'logs/fixThreatIssue',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.post(`/logs/${id}/fix`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fix issue');
    }
  }
);

export const fixAllThreatIssues = createAsyncThunk(
  'logs/fixAllThreatIssues',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/logs/fix-all');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to batch-fix issues');
    }
  }
);

export const clearAllLogs = createAsyncThunk(
  'logs/clearAll',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.delete('/logs/clear');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to clear logs');
    }
  }
);

export const fetchRegexRules = createAsyncThunk(
  'logs/fetchRules',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await api.get('/logs/rules');
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to fetch regex rules');
    }
  }
);

export const createRegexRule = createAsyncThunk(
  'logs/createRule',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/logs/rules', payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to create regex rule');
    }
  }
);

export const updateRegexRule = createAsyncThunk(
  'logs/updateRule',
  async ({ id, updates }, { rejectWithValue }) => {
    try {
      const { data } = await api.put(`/logs/rules/${id}`, updates);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to update regex rule');
    }
  }
);

export const deleteRegexRule = createAsyncThunk(
  'logs/deleteRule',
  async (id, { rejectWithValue }) => {
    try {
      const { data } = await api.delete(`/logs/rules/${id}`);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to delete regex rule');
    }
  }
);

export const testRegexRule = createAsyncThunk(
  'logs/testRule',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await api.post('/logs/rules/test', payload);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Regex test failed');
    }
  }
);

const logsSlice = createSlice({
  name: 'logs',
  initialState: {
    items: [],
    pagination: { page: 1, limit: 50, total: 0, pages: 1 },
    threats: [],
    threatSummary: {
      totalThreats: 0,
      unacknowledgedCount: 0,
      avgThreatScore: 0,
      byType: [],
      topIps: [],
    },
    rules: [],
    testResults: null,
    liveStreamEnabled: false,
    loading: false,
    simulating: false,
    probingUrl: false,
    lastProbeResult: null,
    probeHistory: [],
    probeError: null,
    fixingAll: false,
    testingRegex: false,
    error: null,
  },
  reducers: {
    setLiveStreamEnabled(state, action) {
      state.liveStreamEnabled = action.payload;
    },
    clearTestResults(state) {
      state.testResults = null;
    },
    clearLogsError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchLogs.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchLogs.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.logs;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchLogs.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      .addCase(simulateLogBatch.pending, (state) => {
        state.simulating = true;
      })
      .addCase(simulateLogBatch.fulfilled, (state, action) => {
        state.simulating = false;
        const incoming = action.payload.logs || [];
        state.items = [...incoming, ...state.items].slice(0, 100);
      })
      .addCase(simulateLogBatch.rejected, (state, action) => {
        state.simulating = false;
        state.error = action.payload;
      })
      .addCase(probeTargetUrl.pending, (state) => {
        state.probingUrl = true;
        state.probeError = null;
      })
      .addCase(probeTargetUrl.fulfilled, (state, action) => {
        state.probingUrl = false;
        state.lastProbeResult = action.payload;
        state.probeHistory = [action.payload, ...state.probeHistory].slice(0, 12);
        if (action.payload.log) {
          state.items = [action.payload.log, ...state.items].slice(0, 100);
        }
      })
      .addCase(probeTargetUrl.rejected, (state, action) => {
        state.probingUrl = false;
        state.probeError = action.payload;
      })
      .addCase(ingestRawLogs.fulfilled, (state, action) => {
        const incoming = action.payload.logs || [];
        state.items = [...incoming, ...state.items].slice(0, 100);
      })
      .addCase(fetchThreats.fulfilled, (state, action) => {
        state.threats = action.payload.threats;
        state.threatSummary = action.payload.summary;
      })
      .addCase(acknowledgeThreatLog.fulfilled, (state, action) => {
        const updated = action.payload.log;
        state.threats = state.threats.map((t) => (t._id === updated._id ? updated : t));
        state.items = state.items.map((l) => (l._id === updated._id ? updated : l));
        state.threatSummary.unacknowledgedCount = state.threats.filter(
          (t) => !t.acknowledged
        ).length;
      })
      .addCase(fixThreatIssue.fulfilled, (state, action) => {
        const updated = action.payload.log;
        state.threats = state.threats.map((t) => (t._id === updated._id ? updated : t));
        state.items = state.items.map((l) => (l._id === updated._id ? updated : l));
        if (state.lastProbeResult?.log?._id === updated._id) {
          state.lastProbeResult = { ...state.lastProbeResult, log: updated };
        }
        state.threatSummary.unacknowledgedCount = state.threats.filter(
          (t) => !t.acknowledged
        ).length;
      })
      .addCase(fixAllThreatIssues.pending, (state) => {
        state.fixingAll = true;
      })
      .addCase(fixAllThreatIssues.fulfilled, (state) => {
        state.fixingAll = false;
        const nowIso = new Date().toISOString();
        state.threats = state.threats.map((t) => ({
          ...t,
          acknowledged: true,
          remediated: true,
          remediatedAt: t.remediatedAt || nowIso,
        }));
        state.items = state.items.map((l) =>
          l.isThreat
            ? {
                ...l,
                acknowledged: true,
                remediated: true,
                remediatedAt: l.remediatedAt || nowIso,
              }
            : l
        );
        state.threatSummary.unacknowledgedCount = 0;
      })
      .addCase(fixAllThreatIssues.rejected, (state, action) => {
        state.fixingAll = false;
        state.error = action.payload;
      })
      .addCase(clearAllLogs.fulfilled, (state) => {
        state.items = [];
        state.threats = [];
        state.pagination = { page: 1, limit: 50, total: 0, pages: 1 };
      })
      .addCase(fetchRegexRules.fulfilled, (state, action) => {
        state.rules = action.payload.rules;
      })
      .addCase(createRegexRule.fulfilled, (state, action) => {
        state.rules.push(action.payload.rule);
        state.rules.sort((a, b) => a.priority - b.priority);
      })
      .addCase(updateRegexRule.fulfilled, (state, action) => {
        const updated = action.payload.rule;
        state.rules = state.rules
          .map((r) => (r._id === updated._id ? updated : r))
          .sort((a, b) => a.priority - b.priority);
      })
      .addCase(deleteRegexRule.fulfilled, (state, action) => {
        state.rules = state.rules.filter((r) => r._id !== action.payload.deletedId);
      })
      .addCase(testRegexRule.pending, (state) => {
        state.testingRegex = true;
      })
      .addCase(testRegexRule.fulfilled, (state, action) => {
        state.testingRegex = false;
        state.testResults = action.payload;
      })
      .addCase(testRegexRule.rejected, (state, action) => {
        state.testingRegex = false;
        state.testResults = { valid: false, error: action.payload, results: [] };
      });
  },
});

export const { setLiveStreamEnabled, clearTestResults, clearLogsError } = logsSlice.actions;
export default logsSlice.reducer;
