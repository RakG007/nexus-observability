const dns = require('dns').promises;
const net = require('net');

const PROBE_TIMEOUT_MS = 8000;

/**
 * Checks whether an IPv4 or IPv6 address belongs to loopback, private, link-local,
 * or cloud metadata ranges to prevent Server-Side Request Forgery (SSRF).
 */
function isPrivateOrReservedIp(ip) {
  if (!ip) return true;
  const normalized = ip.replace(/^::ffff:/i, '');

  if (net.isIPv4(normalized)) {
    const parts = normalized.split('.').map(Number);
    const [a, b] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 cloud metadata / link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  if (net.isIPv6(normalized)) {
    const lower = normalized.toLowerCase();
    if (lower === '::' || lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA fc00::/7
    if (lower.startsWith('fe80')) return true; // Link-local fe80::/10
    if (lower.startsWith('ff')) return true; // Multicast
    return false;
  }

  return true;
}

/**
 * Validates URL syntax, enforces http/https protocol, and resolves public DNS IPs.
 */
async function validateAndResolveUrl(rawUrl) {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) {
    const err = new Error('Please enter a valid URL to inspect.');
    err.statusCode = 400;
    throw err;
  }

  let candidate = rawUrl.trim();
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = `https://${candidate}`;
  }

  let parsed;
  try {
    parsed = new URL(candidate);
  } catch {
    const err = new Error('Invalid URL format. Example: https://example.com');
    err.statusCode = 400;
    throw err;
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    const err = new Error('Only HTTP and HTTPS URLs are permitted.');
    err.statusCode = 400;
    throw err;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    const err = new Error('Blocked internal/localhost target (SSRF protection).');
    err.statusCode = 400;
    throw err;
  }

  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      const err = new Error('Blocked private or reserved IP address (SSRF protection).');
      err.statusCode = 400;
      throw err;
    }
    return { parsedUrl: parsed, resolvedIp: hostname };
  }

  let records;
  try {
    records = await dns.lookup(hostname, { all: true });
  } catch {
    const err = new Error(`DNS resolution failed for host: ${hostname}`);
    err.statusCode = 400;
    throw err;
  }

  if (!records || records.length === 0) {
    const err = new Error(`No DNS A/AAAA records found for host: ${hostname}`);
    err.statusCode = 400;
    throw err;
  }

  for (const rec of records) {
    if (isPrivateOrReservedIp(rec.address)) {
      const err = new Error(
        `Target resolves to private/reserved IP (${rec.address}) and was blocked by SSRF protection.`
      );
      err.statusCode = 400;
      throw err;
    }
  }

  return { parsedUrl: parsed, resolvedIp: records[0].address };
}

const SECURITY_HEADERS = [
  {
    key: 'strict-transport-security',
    label: 'HSTS (Strict-Transport-Security)',
    weight: 20,
    advice: 'Enforce HTTPS with Strict-Transport-Security header.',
  },
  {
    key: 'content-security-policy',
    label: 'Content-Security-Policy (CSP)',
    weight: 25,
    advice: 'Add a Content-Security-Policy header to prevent XSS.',
  },
  {
    key: 'x-frame-options',
    label: 'X-Frame-Options',
    weight: 15,
    advice: 'Set X-Frame-Options to DENY or SAMEORIGIN against clickjacking.',
  },
  {
    key: 'x-content-type-options',
    label: 'X-Content-Type-Options',
    weight: 15,
    advice: 'Set X-Content-Type-Options: nosniff to block MIME sniffing.',
  },
  {
    key: 'referrer-policy',
    label: 'Referrer-Policy',
    weight: 10,
    advice: 'Configure Referrer-Policy (e.g., strict-origin-when-cross-origin).',
  },
];

/**
 * Performs a live HTTP/HTTPS probe against a validated public URL,
 * inspects response latency, status code, TLS usage, and security headers,
 * and returns a full telemetry report + formatted log line.
 */
async function probeTargetUrl(rawUrl, fetchImpl = global.fetch) {
  const { parsedUrl, resolvedIp } = await validateAndResolveUrl(rawUrl);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const startNs = process.hrtime.bigint();

  let response;
  let networkError = null;

  try {
    response = await fetchImpl(parsedUrl.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'CipherLogiq-Nexus-Probe/1.0',
        Accept: 'text/html,application/json;q=0.9,*/*;q=0.8',
      },
    });
    // Cancel body stream immediately to avoid downloading large payloads
    if (response.body && typeof response.body.cancel === 'function') {
      await response.body.cancel().catch(() => {});
    }
  } catch (err) {
    networkError = err.name === 'AbortError' ? 'Request timed out (8000ms)' : err.message;
  } finally {
    clearTimeout(timer);
  }

  const latencyMs = Number((Number(process.hrtime.bigint() - startNs) / 1e6).toFixed(1));
  const isHttps = parsedUrl.protocol === 'https:';
  const statusCode = response ? response.status : 504;
  const statusText = response ? response.statusText : networkError || 'Gateway Timeout';

  const headerAudit = SECURITY_HEADERS.map((h) => {
    const val = response?.headers?.get ? response.headers.get(h.key) : null;
    return {
      header: h.key,
      label: h.label,
      present: Boolean(val),
      value: val || null,
      weight: h.weight,
      advice: h.advice,
    };
  });

  // Compute security & health score (0-100)
  let score = 0;
  if (!networkError) {
    if (isHttps) score += 15;
    for (const h of headerAudit) {
      if (h.present) score += h.weight;
    }
    if (statusCode >= 500) score = Math.max(10, score - 45);
    else if (statusCode >= 400) score = Math.max(20, score - 20);
    if (latencyMs > 1500) score = Math.max(15, score - 15);
  }

  const grade =
    score >= 90 ? 'A+' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'F';

  const missingHeaders = headerAudit.filter((h) => !h.present).map((h) => h.header);
  const serverHeader =
    (response?.headers?.get && response.headers.get('server')) || 'undisclosed';

  const level =
    networkError || statusCode >= 500
      ? 'ERROR'
      : statusCode >= 400 || !isHttps || latencyMs >= 1500 || missingHeaders.length >= 3
        ? 'WARN'
        : 'INFO';

  const iso = new Date().toISOString();
  const targetPath = `${parsedUrl.hostname}${parsedUrl.pathname || '/'}${parsedUrl.search || ''}`;
  const rawLogLine = `${iso} [${level}] service=url-probe method=GET path=${targetPath} status=${statusCode} latency=${latencyMs}ms ip=${resolvedIp} msg="URL probe score=${score} grade=${grade} https=${isHttps} missingHeaders=${missingHeaders.length}"`;

  return {
    targetUrl: parsedUrl.toString(),
    finalUrl: response?.url || parsedUrl.toString(),
    hostname: parsedUrl.hostname,
    resolvedIp,
    isHttps,
    reachable: !networkError,
    networkError,
    statusCode,
    statusText,
    latencyMs,
    serverHeader,
    securityScore: score,
    grade,
    headerAudit,
    missingHeaders,
    rawLogLine,
  };
}

module.exports = {
  isPrivateOrReservedIp,
  validateAndResolveUrl,
  probeTargetUrl,
};
