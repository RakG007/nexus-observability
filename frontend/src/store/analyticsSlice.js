import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../services/api';

export const fetchAnalyticsOverview = createAsyncThunk(
  'analytics/fetchOverview',
  async (window = '24h', { rejectWithValue }) => {
    try {
      const { data } = await api.get('/analytics/overview', { params: { window } });
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || 'Failed to load analytics');
    }
  }
);

const analyticsSlice = createSlice({
  name: 'analytics',
  initialState: {
    window: '24h',
    kpis: {
      totalLogs: 0,
      errorCount: 0,
      warnCount: 0,
      errorRate: 0,
      threatCount: 0,
      unacknowledgedThreats: 0,
      remediatedThreats: 0,
      avgLatencyMs: 0,
      p95LatencyMs: 0,
      requestsPerMinute: 0,
    },
    timeSeries: [],
    statusDistribution: [],
    sourceBreakdown: [],
    topEndpoints: [],
    topThreatIPs: [],
    threatBreakdown: [],
    loading: false,
    error: null,
    lastUpdated: null,
  },
  reducers: {
    setTimeWindow(state, action) {
      state.window = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalyticsOverview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsOverview.fulfilled, (state, action) => {
        state.loading = false;
        state.window = action.payload.window;
        state.kpis = action.payload.kpis;
        state.timeSeries = action.payload.timeSeries;
        state.statusDistribution = action.payload.statusDistribution;
        state.sourceBreakdown = action.payload.sourceBreakdown;
        state.topEndpoints = action.payload.topEndpoints;
        state.topThreatIPs = action.payload.topThreatIPs;
        state.threatBreakdown = action.payload.threatBreakdown;
        state.lastUpdated = new Date().toISOString();
      })
      .addCase(fetchAnalyticsOverview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { setTimeWindow } = analyticsSlice.actions;
export default analyticsSlice.reducer;
