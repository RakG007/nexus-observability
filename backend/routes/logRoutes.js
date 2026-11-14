const express = require('express');
const {
  ingestLogs,
  simulateLogs,
  probeUrl,
  getLogs,
  getThreats,
  acknowledgeThreat,
  fixIssue,
  fixAllIssues,
  clearLogs,
  getRules,
  createRule,
  updateRule,
  deleteRule,
  testRule,
} = require('../controllers/logController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

// Static and collection routes first (avoid matching /:id)
router.post('/ingest', ingestLogs);
router.post('/simulate', simulateLogs);
router.post('/probe-url', probeUrl);
router.post('/fix-all', fixAllIssues);
router.get('/threats', getThreats);
router.delete('/clear', clearLogs);

// Regex parsing rules management & dry-run tester
router.get('/rules', getRules);
router.post('/rules', createRule);
router.post('/rules/test', testRule);
router.put('/rules/:id', updateRule);
router.delete('/rules/:id', deleteRule);

// Paginated log explorer, remediation & threat acknowledgement
router.get('/', getLogs);
router.patch('/:id/acknowledge', acknowledgeThreat);
router.post('/:id/fix', fixIssue);

module.exports = router;
