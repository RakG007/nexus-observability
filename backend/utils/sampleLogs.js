/**
 * Realistic multi-source server log generator for live simulation & demo seeding.
 * Produces Nginx, Apache, SSH Auth, and Microservice API logs including realistic threat payloads.
 */

const NORMAL_IPS = [
  '203.0.113.42',
  '198.51.100.14',
  '172.16.40.12',
  '10.24.8.19',
  '34.210.88.141',
  '52.95.110.1',
  '104.28.14.77',
];

const THREAT_IPS = [
  '185.220.101.44',
  '45.155.205.91',
  '91.240.118.172',
  '193.32.162.157',
];

const NORMAL_PATHS = [
  '/api/v1/health',
  '/api/v1/users/profile',
  '/api/v1/orders?page=1&limit=20',
  '/api/v1/telemetry/metrics',
  '/api/v1/projects/cipher-logiq',
  '/checkout/summary',
  '/assets/app.bundle.js',
  '/api/v1/billing/invoices',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/129.0.0.0',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Safari/537.36',
  'CipherLogiq-Agent/2.4.1',
  'curl/8.4.0',
  'PostmanRuntime/7.41.0',
];

const SERVICES = ['auth-service', 'payments-core', 'ledger-worker', 'edge-proxy', 'search-indexer'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function formatClfDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${months[date.getUTCMonth()]}/${date.getUTCFullYear()}:${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} +0000`;
}

function formatSyslogDate(date) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  return `${months[date.getUTCMonth()]} ${String(date.getUTCDate()).padStart(2, ' ')} ${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

function generateThreatLine(now) {
  const clf = formatClfDate(now);
  const sys = formatSyslogDate(now);
  const iso = now.toISOString();
  const ip = pick(THREAT_IPS);

  const scenarios = [
    {
      source: 'nginx',
      raw: `${ip} - - [${clf}] "GET /api/v1/users?id=1%20UNION%20SELECT%20username,password%20FROM%20users-- HTTP/1.1" 403 312 "-" "sqlmap/1.8.2" rt=14.2ms`,
    },
    {
      source: 'nginx',
      raw: `${ip} - - [${clf}] "GET /api/v1/files?name=../../../../etc/passwd HTTP/1.1" 400 248 "-" "curl/8.4.0" rt=9.1ms`,
    },
    {
      source: 'apache',
      raw: `${ip} - - [${clf}] "POST /search?q=<script>alert(document.cookie)</script> HTTP/1.1" 403 410 "https://target.local" "Mozilla/5.0"`,
    },
    {
      source: 'nginx',
      raw: `${ip} - - [${clf}] "GET /.env HTTP/1.1" 404 162 "-" "Nikto/2.5.0" rt=4.3ms`,
    },
    {
      source: 'auth',
      raw: `${sys} prod-bastion-01 sshd[${1000 + Math.floor(Math.random() * 8000)}]: Failed password for invalid user admin from ${ip} port ${30000 + Math.floor(Math.random() * 30000)} ssh2`,
    },
    {
      source: 'api',
      raw: `${iso} [ERROR] service=payments-core method=POST path=/api/v1/charge status=502 latency=2140.8ms ip=${ip} msg="Upstream payment processor timeout"`,
    },
  ];

  return pick(scenarios);
}

function generateNormalLine(now) {
  const clf = formatClfDate(now);
  const sys = formatSyslogDate(now);
  const iso = now.toISOString();
  const ip = pick(NORMAL_IPS);
  const path = pick(NORMAL_PATHS);
  const ua = pick(USER_AGENTS);
  const method = Math.random() < 0.72 ? 'GET' : Math.random() < 0.8 ? 'POST' : 'PUT';
  const statusRoll = Math.random();
  const status = statusRoll < 0.84 ? 200 : statusRoll < 0.92 ? 201 : statusRoll < 0.97 ? 304 : 404;
  const latency = (8 + Math.random() * 145).toFixed(1);
  const bytes = 240 + Math.floor(Math.random() * 8200);

  const kindRoll = Math.random();
  if (kindRoll < 0.42) {
    return {
      source: 'nginx',
      raw: `${ip} - - [${clf}] "${method} ${path} HTTP/1.1" ${status} ${bytes} "-" "${ua}" rt=${latency}ms`,
    };
  }
  if (kindRoll < 0.65) {
    return {
      source: 'apache',
      raw: `${ip} - svc_edge [${clf}] "${method} ${path} HTTP/1.1" ${status} ${bytes} "https://app.cipherlogiq.io" "${ua}"`,
    };
  }
  if (kindRoll < 0.78) {
    return {
      source: 'auth',
      raw: `${sys} prod-bastion-01 sshd[${1000 + Math.floor(Math.random() * 8000)}]: Accepted publickey for deploy from ${ip} port ${40000 + Math.floor(Math.random() * 20000)} ssh2`,
    };
  }
  const level = status >= 400 ? 'WARN' : 'INFO';
  return {
    source: 'api',
    raw: `${iso} [${level}] service=${pick(SERVICES)} method=${method} path=${path} status=${status} latency=${latency}ms ip=${ip} msg="Request completed"`,
  };
}

/**
 * Generates a batch of realistic log samples.
 * @param {number} count
 * @param {number} threatRatio - probability [0..1] of generating a security/anomaly event
 * @param {number} [spreadMinutes=0] - optional backward time spread for initial dashboard seeding
 */
function generateSampleBatch(count = 12, threatRatio = 0.22, spreadMinutes = 0) {
  const safeCount = Math.max(1, Math.min(Number(count) || 12, 100));
  const items = [];

  for (let i = 0; i < safeCount; i += 1) {
    const offsetMs = spreadMinutes > 0 ? Math.floor(Math.random() * spreadMinutes * 60 * 1000) : 0;
    const ts = new Date(Date.now() - offsetMs);
    if (Math.random() < threatRatio) {
      items.push(generateThreatLine(ts));
    } else {
      items.push(generateNormalLine(ts));
    }
  }

  return items;
}

module.exports = { generateSampleBatch };
