import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import logsReducer from './logsSlice';
import analyticsReducer from './analyticsSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    logs: logsReducer,
    analytics: analyticsReducer,
  },
});

export default store;
