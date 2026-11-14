# Engineering & Academic Project Report

## Nexus: Real-Time Server Observability Platform

- **Team / Brand:** Cipher Logiq  
- **Author & Lead Developer:** Rakshak Gupta  
- **Technology Stack:** MongoDB Atlas (Mongoose ODM), Express.js (Vercel Serverless), React 18, Redux Toolkit, Tailwind CSS, Recharts, Node.js 20  
- **Deployment Target:** Vercel Serverless Monorepo (Unified Frontend + `/api` Serverless Functions)

---

## 1. Executive Summary & Problem Statement

Modern distributed web infrastructures emit heterogeneous, unstructured, and semi-structured log streams across reverse proxies (Nginx, Apache HTTP), host authentication daemons (`sshd`), and application microservices. Without a centralized observability pipeline, Site Reliability Engineers (SREs) and Security Operations Center (SOC) analysts suffer from high Mean Time to Detection (MTTD) and Mean Time to Resolution (MTTR) during production outages, latency spikes, and active exploitation attempts (SQL Injection, Cross-Site Scripting, Path Traversal, and SSH Brute-Force attacks).

**Nexus** solves this by delivering a unified, multi-tenant MERN observability platform engineered specifically for zero-infrastructure serverless deployment on Vercel and MongoDB Atlas. It combines a **ReDoS-hardened Regular Expression Parsing Engine**, automated threat risk scoring, one-click remediation playbooks, MongoDB aggregation-driven telemetry analytics, and a Rimac-inspired futuristic AI HUD cockpit.

---

## 2. System Architecture & Serverless Design

### 2.1 Unified Vercel Monorepo Topology
Rather than maintaining separate CORS-coupled repositories for frontend and backend deployments, Nexus adopts a unified monorepo structure governed by `vercel.json`:
- **Static Edge Layer (`frontend/dist`)**: Built with Vite + React 18, served globally via Vercel Edge CDN.
- **Serverless API Layer (`api/index.js` -> `backend/app.js`)**: Express 4 application exported without binding a TCP port when `NODE_ENV === 'production'`, enabling zero-config Vercel Node.js Serverless execution.
- **Route Rewriting**:
  - `/api/(.*)` routes directly to `/api/index.js`.
  - Non-API, non-asset client paths fall back to `/index.html` for React Router SPA navigation.

### 2.2 Cold-Start MongoDB Connection Caching
In serverless environments, each cold invocation initializes a new runtime instance, while warm invocations reuse the Node.js module scope. Opening a fresh `mongoose.connect()` call on every HTTP request exhausts MongoDB Atlas connection limits (`M0`/`M10` tiers).

`backend/config/db.js` implements a global singleton cache (`global.__nexusMongooseCache`):
1. Stores `{ conn, promise }` on the Node global object.
2. Concurrent requests arriving during a cold start await the same pending `promise` rather than opening duplicate connection pools.
3. Enforces `bufferCommands: false`, `maxPoolSize: 10`, and `serverSelectionTimeoutMS: 5000` so unreachable clusters fail fast with a structured HTTP `503` instead of hanging until Vercel's execution timeout.
4. Clears `cached.promise = null` on connection errors so subsequent invocations recover automatically.

### 2.3 Trade-Off Analysis: Short-Interval Polling vs. WebSockets
Vercel Serverless Functions are stateless and short-lived; they cannot hold persistent long-lived WebSocket (`ws` / `Socket.IO`) connections across invocations without introducing an external pub/sub broker (e.g., Pusher, Ably, or Redis).
- **Selected Architecture**: 4.5-second reactive polling paired with batch log simulation (`POST /api/logs/simulate`) and manual batch ingestion (`POST /api/logs/ingest`).
- **Benefit**: Zero external WebSocket broker cost, 100% compatibility with Vercel Serverless, and deterministic backpressure control.

---

## 3. Data Modeling & Indexing Strategy (MongoDB)

### 3.1 `User` Collection (`backend/models/User.js`)
- Stores `name`, unique lowercase `email`, `passwordHash` (`bcryptjs`, cost factor 12, `select: false`), `role` (`admin` | `analyst` | `viewer`), and `organization`.
- JSON serialization transform strips `passwordHash` and `__v` on every response.

### 3.2 `RegexRule` Collection (`backend/models/RegexRule.js`)
- Stores `name`, `sourceType` (`nginx`, `apache`, `auth`, `api`, `custom`), `pattern`, `flags`, `severityOverride`, `isActive`, `isDefault`, `priority`, and `createdBy`.
- Compound index `{ createdBy: 1, isActive: 1, priority: 1 }` ensures user-scoped rules are retrieved in deterministic evaluation order in O(log N) time.

### 3.3 `LogEntry` Collection (`backend/models/LogEntry.js`)
- Stores raw log payload (`maxlength: 8192`), normalized fields (`timestamp`, `level`, `method`, `path`, `statusCode`, `ip`, `latencyMs`, `userAgent`, `service`), `matchedRuleName`, `parsedFields` (`Mixed`), threat metadata (`isThreat`, `threatType`, `threatScore`, `acknowledged`), and remediation audit fields (`remediated`, `remediatedAt`, `remediationAction`, `remediationSummary`).
- Compound indexes optimize dashboard aggregations and paginated Log Explorer queries:
  - `{ owner: 1, timestamp: -1 }`
  - `{ owner: 1, isThreat: 1, acknowledged: 1, timestamp: -1 }`
  - `{ owner: 1, level: 1, timestamp: -1 }`
  - `{ owner: 1, source: 1, timestamp: -1 }`

---

## 4. Regex Parsing Engine, Threat Detection & Remediation

### 4.1 ReDoS (Catastrophic Backtracking) Defense-in-Depth
Accepting arbitrary user-authored regular expressions introduces a critical **Regular Expression Denial of Service (ReDoS)** risk capable of freezing Node's single-threaded V8 event loop. Nexus implements three defensive layers in `backend/utils/regexParser.js`:
1. **Static AST / Nesting Gate (`validateRegexSafety`)**: Rejects patterns exceeding 500 characters, invalid flags, syntax errors, and nested unbounded quantifiers (e.g., `(a+)+`, `([a-z]+)*`) before persistence or execution.
2. **Input Bounding**: Truncates evaluated log lines to 8,192 characters.
3. **Timeout-Guarded VM Isolation (`execRegexSafely`)**: Evaluates patterns inside `vm.runInNewContext(..., { timeout: 50 })`, interrupting pathological backtracking within 50ms.

### 4.2 Named Capture Groups & Automated Threat Classification
Built-in rules utilize ES2018+ named capture groups (`(?<ip>...)`, `(?<method>...)`, `(?<path>...)`, `(?<status>...)`, `(?<latency>...)`) to transform unstructured text into structured telemetry. Each parsed event passes through `classifyThreat()` (evaluating both raw text and percent-decoded payloads via `safePercentDecode` to catch URL-encoded evasion):
- **SQL Injection (`SQLI`, Score 92)**
- **Path Traversal (`PATH_TRAVERSAL`, Score 88)**
- **Cross-Site Scripting (`XSS`, Score 84)**
- **Credential Brute Force (`BRUTE_FORCE`, Score 68–78)**
- **Automated Scanners (`SCANNER`, Score 74)**
- **HTTP 5xx Server Faults (`SERVER_ERROR`, Score 65–70)**
- **Tail Latency Anomalies (`ANOMALY`, Score 55 for latency >= 1500ms)**

### 4.3 Automated Remediation Playbook Engine
- **Single-Incident Remediation (`POST /api/logs/:id/fix`)**: Applies deterministic threat-type playbooks (`WAF_SQLI_RULE_DEPLOYED`, `PATH_SANDBOX_ENFORCED`, `CSP_XSS_SHIELD_ACTIVE`, `IP_QUARANTINE_ENFORCED`, `EDGE_SCANNER_DROP`, `CIRCUIT_BREAKER_RESET`, `LATENCY_MITIGATION_APPLIED`), recording `remediatedAt` and `remediationSummary`.
- **Batch Cockpit Remediation (`POST /api/logs/fix-all`)**: Executes atomic `LogEntry.bulkWrite` updates across all open alerts for the authenticated tenant.

### 4.4 Additional Application Security Controls
- **NoSQL Injection & Search Safety**: Log Explorer text searches pass through `escapeRegExp()` and length caps before creating MongoDB `$regex` filters.
- **SSRF Protection on Live URL Probing (`backend/utils/urlProbe.js`)**: `POST /api/logs/probe-url` enforces `http:`/`https:` schemes, resolves hostnames via `dns.lookup(..., { all: true })`, and blocks loopback, RFC1918 private networks, link-local (`169.254.0.0/16`), and IPv6 ULA addresses via `isPrivateOrReservedIp()`.
- **Multi-Tenant Ownership Enforcement**: All log, threat, remediation, analytics, and regex rule queries strictly filter by `req.user._id`.
- **Fail-Closed Production JWT Secret**: `authMiddleware.js` refuses to fall back to a default secret when `NODE_ENV === 'production'`.
- **Bounded Aggregation Memory**: `analyticsController.js` computes P95 latency from a bounded sample of the 2,000 most recent latency records rather than unbounded `$push` arrays inside `$facet`, preventing 16MB BSON document limit failures at scale.

---

## 5. Frontend Architecture & Rimac-Inspired AI HUD

Built with React 18, Redux Toolkit (`authSlice`, `logsSlice`, `analyticsSlice`), Tailwind CSS, and Recharts:
- **Brand Identity (`CipherLogiqLogo.jsx`)**: Custom vector crest combining a chamfered octagonal chassis with interlocking **C + L** optical conduits and SVG favicon integration.
- **Kinetic Telemetry Canvas (`DynamicGlassBackdrop.jsx`)**: 60fps HTML5 `<canvas>` rendering a matte carbon micro-weave, perspective velocity grid, horizon laser, and swept `#00F0FF` light conduits (with automatic visibility pausing and `prefers-reduced-motion` support).
- **AI Observability Core (`AiObservabilityCore.jsx`)**: Hypercar-cockpit 270° graduated radial integrity gauge, pointer-reactive chamfered glass spotlight, autonomous diagnostic synthesis, and one-click `Fix All Issues` trigger.
- **Observability Views**: `Dashboard.jsx` (KPIs, Recharts Area/Bar timelines, Live Telemetry Tail, Threat Feed, Top Endpoints), `UrlInspector.jsx` (SSRF-safe live URL latency, status, TLS & OWASP header auditor), `LogExplorer.jsx` (paginated search & filters), `RegexRulesManager.jsx` & `RegexTesterModal.jsx` (ReDoS-safe dry-run AST sandbox), and `ThreatMonitor.jsx` (SOC triage & batch playbook deployment).

---

## 6. Verification & Quality Assurance

- **Test Environment**: Node.js `v20.19.5`, Jest `29.7.0`, Supertest `7.0.0`, `mongodb-memory-server` `10.1.2`.
- **Backend Automated Test Results (`npm test`)**: **11 / 11 tests passed** (`1 passed` test suite in `3.458 s`):
  - Health endpoint & connected DB state (`GET /api/health`)
  - Static ReDoS pattern rejection (`(a+)+`, `([a-zA-Z]+)*`) & dry-run named capture group timing (`testRegexPattern`)
  - User registration, auto-provisioning of default rules/logs, bcrypt password hashing, JWT verification, and `401`/`409` handling
  - Cross-tenant isolation on rule updates (`404` for non-owners)
  - Multi-source log ingestion, URL-encoded SQLi / Path Traversal / SSH Brute-Force threat classification, acknowledgement, single-incident remediation (`POST /api/logs/:id/fix`), batch remediation (`POST /api/logs/fix-all`), and `$facet` analytics aggregations
  - Live URL Probe SSRF blocking (`127.0.0.1`, `169.254.169.254`) and OWASP header audit (`probeTargetUrl`)
  - Live log simulation (`POST /api/logs/simulate`), centralized JSON error middleware (`400` on malformed JSON & invalid ObjectIds), workspace clearing, and rule deletion
- **Serverless Entry Verification**: `require('./api/index.js')` verified as exporting a callable function (`typeof h === 'function'`).
- **Frontend Production Build (`npm --prefix frontend run build`)**: Vite `7.3.8` transformed `2078` modules and built `frontend/dist/` cleanly in `2.59 s` (`dist/index.html` `1.30 kB`, `dist/assets/index-DCYQ9lSY.css` `41.89 kB`, `dist/assets/index-DLoVUyjq.js` `753.32 kB`).
