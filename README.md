# Nexus: Real-Time Server Observability Platform

**Brand / Team:** Cipher Logiq  
**Developer:** Rakshak Gupta  
**Stack:** MongoDB Atlas · Express.js (Vercel Serverless) · React 18 · Redux Toolkit · Tailwind CSS · Recharts

---

## Overview

**Nexus** is a production-ready, Vercel-deployable full-stack MERN observability platform designed to ingest, parse, index, and analyze unstructured server logs (Nginx, Apache HTTP, Linux SSH/Auth, and Microservice API telemetry) in real time using a **ReDoS-hardened Regex Parsing Engine**.

### Key Capabilities
- **ReDoS-Hardened Regex Engine (`backend/utils/regexParser.js`)**: Supports named capture groups (`(?<ip>...)`, `(?<status>...)`, `(?<path>...)`, `(?<latency>...)`) with static catastrophic-backtracking validation and a 50ms V8 `vm` execution timeout.
- **Automated Threat & Anomaly Detection**: Classifies `SQLI`, `XSS`, `PATH_TRAVERSAL`, `BRUTE_FORCE`, `SCANNER`, `SERVER_ERROR` (5xx), and latency `ANOMALY` (>1500ms) events with `0–100` risk scoring and SOC triage acknowledgement.
- **Serverless-Ready MongoDB Atlas Integration (`backend/config/db.js`)**: Global connection & promise caching eliminates connection-pool exhaustion across Vercel Serverless warm/cold starts.
- **Real-Time Telemetry Hub**: Short-interval live stream simulator + manual multi-line raw log ingestion + `$facet` MongoDB analytics aggregations (`1h`, `24h`, `7d`).

---

## Monorepo Architecture

```text
nexus-observability/
├── api/index.js                 # Vercel serverless function entry point
├── backend/
│   ├── config/db.js             # Cached MongoDB connection helper
│   ├── controllers/             # authController, logController, analyticsController
│   ├── middleware/              # JWT authMiddleware & centralized errorMiddleware
│   ├── models/                  # User, LogEntry, RegexRule schemas
│   ├── routes/                  # authRoutes, logRoutes, analyticsRoutes
│   ├── utils/                   # regexParser.js, sampleLogs.js
│   ├── tests/nexus.test.js      # Jest + Supertest + mongodb-memory-server suite
│   └── app.js                   # Express app (serverless export + local listener)
├── frontend/                    # React + Vite + Tailwind + Redux Toolkit + Recharts
├── vercel.json                  # API + SPA rewrites and frontend/dist output config
├── package.json                 # Root scripts (install:all, dev, build, test)
├── .env.example
└── PROJECT_REPORT.md            # Academic & engineering project report
```

---

## Local Development Setup

### 1. Prerequisites
- Node.js >= 18 (`v20.x` recommended)
- MongoDB Atlas connection string (or local MongoDB instance)

### 2. Install Dependencies
```bash
npm run install:all
```

### 3. Configure Environment Variables
```bash
cp .env.example .env
```
Edit `.env` and provide your `MONGODB_URI` and a strong `JWT_SECRET`.

### 4. Run Backend + Frontend Concurrently
```bash
npm run dev
```
- Backend API: `http://localhost:5001` (`GET /api/health`)
- Frontend UI: `http://localhost:5173` (Vite proxies `/api/*` to port `5001`)

### 5. Run Automated Tests & Production Build
```bash
npm test
npm run build
```

---

## 1-Click Vercel Deployment Guide

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "feat: initial Nexus Observability Platform by Cipher Logiq"
   git branch -M main
   git remote add origin https://github.com/<your-username>/nexus-observability.git
   git push -u origin main
   ```
2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new) and import your `nexus-observability` repository.
   - Keep **Framework Preset** as `Other` (or let `vercel.json` govern `buildCommand` and `outputDirectory: "frontend/dist"`).
3. **Set Environment Variables in Vercel Project Settings**:
   - `MONGODB_URI` — Your MongoDB Atlas SRV connection string (ensure Network Access allows `0.0.0.0/0` for Vercel dynamic egress IPs).
   - `JWT_SECRET` — A 64-character random cryptographic string.
   - `NODE_ENV` — `production`
4. **Deploy**: Click **Deploy**. Vercel builds the Vite bundle into `frontend/dist` and deploys `api/index.js` as a Serverless Function handling all `/api/*` routes.
