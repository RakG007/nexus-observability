const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const app = require('../app');
const { connectDB, resetDBCache } = require('../config/db');
const { validateRegexSafety, testRegexPattern } = require('../utils/regexParser');
const { isPrivateOrReservedIp, probeTargetUrl } = require('../utils/urlProbe');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await connectDB(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  resetDBCache();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('Nexus Observability Platform — Unit & Integration Suite', () => {
  let tokenA;
  let tokenB;
  let customRuleId;
  let sqliLogId;

  test('GET /api/health returns service status and connected DB state', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.service).toContain('Cipher Logiq');
    expect(res.body.dbState).toBe('connected');
  });

  test('validateRegexSafety rejects ReDoS catastrophic backtracking patterns', () => {
    expect(validateRegexSafety('(a+)+').valid).toBe(false);
    expect(validateRegexSafety('([a-zA-Z]+)*').valid).toBe(false);
    expect(validateRegexSafety('^(?<ip>\\d{1,3}(?:\\.\\d{1,3}){3})\\s+(?<status>\\d{3})$').valid).toBe(
      true
    );
  });

  test('testRegexPattern extracts named capture groups and measures execution time', () => {
    const result = testRegexPattern({
      pattern: '^(?<ip>\\d{1,3}(?:\\.\\d{1,3}){3})\\s+(?<method>GET|POST)\\s+(?<path>\\S+)\\s+(?<status>\\d{3})',
      flags: '',
      sampleLines: ['192.168.1.50 GET /api/v1/health 200'],
    });
    expect(result.valid).toBe(true);
    expect(result.results[0].matched).toBe(true);
    expect(result.results[0].groups).toEqual({
      ip: '192.168.1.50',
      method: 'GET',
      path: '/api/v1/health',
      status: '200',
    });
    expect(typeof result.results[0].executionMs).toBe('number');
  });

  test('Auth: register provisions user, default regex rules, and initial logs', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Rakshak Gupta',
      email: 'rakshak@cipherlogiq.io',
      password: 'StrongPassword123!',
      organization: 'Cipher Logiq',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('rakshak@cipherlogiq.io');
    expect(res.body.user.passwordHash).toBeUndefined();
    tokenA = res.body.token;

    // Duplicate email rejected with 409
    const dup = await request(app).post('/api/auth/register').send({
      name: 'Duplicate',
      email: 'rakshak@cipherlogiq.io',
      password: 'StrongPassword123!',
    });
    expect(dup.status).toBe(409);

    // Register second user for multi-tenant isolation test
    const userBRes = await request(app).post('/api/auth/register').send({
      name: 'Second Analyst',
      email: 'analyst2@cipherlogiq.io',
      password: 'StrongPassword123!',
    });
    expect(userBRes.status).toBe(201);
    tokenB = userBRes.body.token;
  });

  test('Auth: login rejects invalid password and succeeds with valid credentials', async () => {
    const bad = await request(app).post('/api/auth/login').send({
      email: 'rakshak@cipherlogiq.io',
      password: 'WrongPassword',
    });
    expect(bad.status).toBe(401);

    const good = await request(app).post('/api/auth/login').send({
      email: 'rakshak@cipherlogiq.io',
      password: 'StrongPassword123!',
    });
    expect(good.status).toBe(200);
    expect(good.body.token).toBeTruthy();

    const unauth = await request(app).get('/api/logs');
    expect(unauth.status).toBe(401);
  });

  test('Regex Rules: blocks unsafe ReDoS rules and supports CRUD + dry-run test', async () => {
    const unsafeRes = await request(app)
      .post('/api/logs/rules')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Evil ReDoS Rule',
        pattern: '^(a+)+$',
      });
    expect(unsafeRes.status).toBe(400);
    expect(unsafeRes.body.message).toMatch(/ReDoS/i);

    const dryRunRes = await request(app)
      .post('/api/logs/rules/test')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        pattern: '^CUSTOM\\s+ip=(?<ip>\\S+)\\s+status=(?<status>\\d{3})',
        sampleText: 'CUSTOM ip=10.0.0.5 status=201',
      });
    expect(dryRunRes.status).toBe(200);
    expect(dryRunRes.body.results[0].matched).toBe(true);
    expect(dryRunRes.body.results[0].groups.ip).toBe('10.0.0.5');

    const createRes = await request(app)
      .post('/api/logs/rules')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Custom Edge Format',
        sourceType: 'custom',
        pattern: '^CUSTOM\\s+ip=(?<ip>\\S+)\\s+status=(?<status>\\d{3})\\s+path=(?<path>\\S+)',
        priority: 5,
      });
    expect(createRes.status).toBe(201);
    customRuleId = createRes.body.rule._id;

    // Tenant isolation: User B cannot update User A's rule
    const crossTenant = await request(app)
      .put(`/api/logs/rules/${customRuleId}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: 'Hijacked' });
    expect(crossTenant.status).toBe(404);
  });

  test('Ingestion & Threat Detection: parses Nginx, SSH, API, SQLi, XSS, and Path Traversal', async () => {
    const rawLogs = [
      '203.0.113.42 - - [12/Nov/2026:14:22:01 +0000] "GET /api/v1/users?id=1%20UNION%20SELECT%20password%20FROM%20users-- HTTP/1.1" 403 312 "-" "sqlmap/1.8" rt=14.2ms',
      '185.220.101.44 - - [12/Nov/2026:14:23:01 +0000] "GET /files?f=../../../../etc/passwd HTTP/1.1" 400 200 "-" "curl/8.4.0" rt=8.0ms',
      'Nov 12 14:26:03 prod-bastion-01 sshd[4821]: Failed password for invalid user admin from 45.155.205.91 port 54122 ssh2',
      'CUSTOM ip=10.1.2.3 status=200 path=/internal/ping',
    ].join('\n');

    const ingestRes = await request(app)
      .post('/api/logs/ingest')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ rawLogs });

    expect(ingestRes.status).toBe(201);
    expect(ingestRes.body.ingestedCount).toBe(4);
    expect(ingestRes.body.threatCount).toBe(3);

    const sqli = ingestRes.body.logs.find((l) => l.threatType === 'SQLI');
    expect(sqli).toBeTruthy();
    expect(sqli.level).toBe('CRITICAL');
    expect(sqli.ip).toBe('203.0.113.42');
    sqliLogId = sqli._id;

    const custom = ingestRes.body.logs.find((l) => l.matchedRuleName === 'Custom Edge Format');
    expect(custom).toBeTruthy();
    expect(custom.statusCode).toBe(200);
  });

  test('Log Explorer, Threat Feed, Acknowledge & Analytics Aggregation', async () => {
    const searchRes = await request(app)
      .get('/api/logs?search=UNION&isThreat=true')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(searchRes.status).toBe(200);
    expect(searchRes.body.logs.length).toBeGreaterThanOrEqual(1);

    const ackRes = await request(app)
      .patch(`/api/logs/${sqliLogId}/acknowledge`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ acknowledged: true });
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.log.acknowledged).toBe(true);

    const fixSingleRes = await request(app)
      .post(`/api/logs/${sqliLogId}/fix`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(fixSingleRes.status).toBe(200);
    expect(fixSingleRes.body.log.remediated).toBe(true);
    expect(fixSingleRes.body.log.remediationAction).toBe('WAF_SQLI_RULE_DEPLOYED');

    const fixAllRes = await request(app)
      .post('/api/logs/fix-all')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(fixAllRes.status).toBe(200);
    expect(fixAllRes.body.success).toBe(true);
    expect(fixAllRes.body.fixedCount).toBeGreaterThanOrEqual(1);

    const threatsRes = await request(app)
      .get('/api/logs/threats')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(threatsRes.status).toBe(200);
    expect(threatsRes.body.summary.totalThreats).toBeGreaterThanOrEqual(3);

    const analyticsRes = await request(app)
      .get('/api/analytics/overview?window=24h')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(analyticsRes.status).toBe(200);
    expect(analyticsRes.body.kpis.totalLogs).toBeGreaterThanOrEqual(20);
    expect(Array.isArray(analyticsRes.body.timeSeries)).toBe(true);
    expect(Array.isArray(analyticsRes.body.statusDistribution)).toBe(true);
    expect(Array.isArray(analyticsRes.body.topEndpoints)).toBe(true);
  });

  test('URL Probe: blocks SSRF private/metadata targets and audits public URLs', async () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('93.184.216.34')).toBe(false);

    const ssrfLocal = await request(app)
      .post('/api/logs/probe-url')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ url: 'http://127.0.0.1:27017' });
    expect(ssrfLocal.status).toBe(400);
    expect(ssrfLocal.body.message).toMatch(/SSRF/i);

    const ssrfMeta = await request(app)
      .post('/api/logs/probe-url')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ url: 'http://169.254.169.254/latest/meta-data' });
    expect(ssrfMeta.status).toBe(400);

    // Verify probeTargetUrl header audit & telemetry generation using a mocked fetch on public IP
    const mockFetch = async () => ({
      status: 200,
      statusText: 'OK',
      url: 'https://93.184.216.34/',
      headers: new Map([
        ['strict-transport-security', 'max-age=31536000'],
        ['content-security-policy', "default-src 'self'"],
        ['x-frame-options', 'DENY'],
        ['server', 'nginx'],
      ]),
      body: { cancel: async () => {} },
    });
    const probeReport = await probeTargetUrl('https://93.184.216.34', mockFetch);
    expect(probeReport.statusCode).toBe(200);
    expect(probeReport.isHttps).toBe(true);
    expect(probeReport.securityScore).toBe(75);
    expect(probeReport.grade).toBe('A');
    expect(probeReport.missingHeaders).toEqual(['x-content-type-options', 'referrer-policy']);
    expect(probeReport.rawLogLine).toContain('service=url-probe');
  });

  test('Simulation, Error Middleware (Malformed JSON / CastError), and Clear Logs', async () => {
    const simRes = await request(app)
      .post('/api/logs/simulate')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ count: 8, threatRatio: 0.5 });
    expect(simRes.status).toBe(201);
    expect(simRes.body.ingestedCount).toBe(8);

    // Invalid ObjectId triggers CastError -> 400 JSON
    const badIdRes = await request(app)
      .patch('/api/logs/not-a-valid-object-id/acknowledge')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ acknowledged: true });
    expect(badIdRes.status).toBe(400);
    expect(badIdRes.body.success).toBe(false);

    // Malformed JSON triggers centralized JSON 400 handler
    const malformedJsonRes = await request(app)
      .post('/api/logs/ingest')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Content-Type', 'application/json')
      .send('{"rawLogs": [broken}');
    expect(malformedJsonRes.status).toBe(400);
    expect(malformedJsonRes.body.success).toBe(false);

    // Clear logs for user B only (does not touch user A)
    const clearBRes = await request(app)
      .delete('/api/logs/clear')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(clearBRes.status).toBe(200);
    expect(clearBRes.body.deletedCount).toBeGreaterThanOrEqual(1);
  });

  test('Cleanup: deletes custom regex rule cleanly', async () => {
    const delRes = await request(app)
      .delete(`/api/logs/rules/${customRuleId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.deletedId).toBe(customRuleId);
  });
});
