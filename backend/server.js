require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const database = require('./database');
const fraudDetector = require('./fraudDetector');
const simulator = require('./simulator');

const app = express();

app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  if (req.path !== '/api/stream' && req.path !== '/stream') {
    console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.path}`);
  }
  next();
});

// Lazy DB initialization for Serverless / Vercel execution
let dbInitPromise = null;
app.use(async (req, res, next) => {
  if (
    req.path.startsWith('/api') ||
    req.path === '/health' ||
    req.path === '/stats' ||
    req.path.startsWith('/transactions') ||
    req.path.startsWith('/alerts') ||
    req.path.startsWith('/investigations') ||
    req.path.startsWith('/simulator')
  ) {
    if (!dbInitPromise) {
      dbInitPromise = database.loadInitialData().catch(err => {
        console.warn('DB load warning in serverless context:', err.message);
      });
    }
    await dbInitPromise;
  }
  next();
});

// Optional Token Verification (Permissive in dev mode, strict when configured with enforce header)
function verifyToken(req, res, next) {
  const token = process.env.API_TOKEN;
  const authHeader = req.get('authorization');
  if (!token || !req.headers['x-enforce-auth']) {
    return next();
  }
  if (authHeader && authHeader === `Bearer ${token}`) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: Invalid or missing API token' });
}

// -------------------------------------------------------------
// API ROUTER (Mounts to both '/api' and '/' for Vercel Serverless resilience)
// -------------------------------------------------------------
const apiRouter = express.Router();

// 1. HEALTH & METRICS
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Sentinel Fraud Detection Engine API is running',
    supabaseConnected: database.isSupabaseConnected,
    simulator: simulator.getStatus()
  });
});

apiRouter.get('/stats', (req, res) => {
  res.json(database.getStats());
});

// 2. TRANSACTIONS APIS
apiRouter.get('/transactions', (req, res) => {
  try {
    const result = database.getTransactions(req.query);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/transactions/:id', (req, res) => {
  const tx = database.getTransactionById(req.params.id);
  if (!tx) {
    return res.status(404).json({ error: 'Transaction not found' });
  }
  res.json(tx);
});

// Submit a new transaction -> Runs Fraud Detection Engine immediately!
apiRouter.post('/transactions', async (req, res) => {
  try {
    const { sender, receiver, amount, channel, date } = req.body;

    if (!sender || !receiver || amount === undefined || isNaN(Number(amount))) {
      return res.status(400).json({
        error: 'sender, receiver and a valid numeric amount are required.'
      });
    }

    const txObj = {
      id: req.body.id || `TXN-${Math.floor(1000 + Math.random() * 9000)}`,
      sender: sender.trim().toUpperCase(),
      receiver: receiver.trim().toUpperCase(),
      amount: Number(amount),
      channel: channel || 'UPI',
      date: date || new Date().toISOString()
    };

    // Run Fraud Detection Engine
    const recent = database.getRecentTransactions(50);
    const evaluation = fraudDetector.evaluate(txObj, recent);

    let alertRef = null;
    if (evaluation.is_fraud) {
      alertRef = `ALT-${Math.floor(100 + Math.random() * 900)}`;
      txObj.alertId = alertRef;
    }

    // Save transaction
    const savedTx = await database.saveTransaction(txObj);

    let savedAlert = null;
    let savedInvestigation = null;

    if (evaluation.is_fraud) {
      savedAlert = await database.saveAlert({
        alert_ref: alertRef,
        transaction_id: savedTx.db_id,
        transaction_ref: savedTx.id,
        risk_score: evaluation.risk_score,
        severity: evaluation.severity,
        reason: evaluation.reason,
        status: 'Open'
      });

      const caseRef = `CASE-${Math.floor(100 + Math.random() * 900)}`;
      savedInvestigation = await database.saveInvestigation({
        id: caseRef,
        alert_id: savedAlert.db_id,
        alert_ref: alertRef,
        priority: evaluation.severity,
        status: 'Awaiting review',
        workflow_status: 'awaiting_review',
        analyst: 'AI Sentinel Agent',
        evidence: evaluation.evidence,
        ai_summary: evaluation.ai_summary
      });

      await database.saveEvidence({
        investigation_id: savedInvestigation.db_id,
        evidence_type: 'api_submission_check',
        description: evaluation.reason,
        source_data: {
          transaction_ref: savedTx.id,
          amount: savedTx.amount,
          risk_score: evaluation.risk_score,
          triggered_rules: evaluation.triggered_rules
        }
      });
    }

    res.status(201).json({
      message: 'Transaction processed',
      transaction: savedTx,
      evaluation,
      alert: savedAlert,
      investigation: savedInvestigation
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. ALERTS APIS
apiRouter.get('/alerts', (req, res) => {
  try {
    const alerts = database.getAlerts(req.query);
    res.json(alerts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/alerts/:id', (req, res) => {
  const alert = database.getAlertById(req.params.id);
  if (!alert) {
    return res.status(404).json({ error: 'Alert not found' });
  }
  res.json(alert);
});

// 4. INVESTIGATIONS APIS
apiRouter.get('/investigations', (req, res) => {
  try {
    const list = database.getInvestigations(req.query);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/investigations/:id', (req, res) => {
  const inv = database.getInvestigationById(req.params.id);
  if (!inv) {
    return res.status(404).json({ error: 'Investigation case not found' });
  }
  res.json(inv);
});

apiRouter.patch('/investigations/:id', async (req, res) => {
  try {
    const { outcome, notes, analyst } = req.body;
    const updated = await database.updateInvestigation(req.params.id, {
      outcome,
      notes,
      analyst: analyst || 'Lead Fraud Analyst'
    });
    if (!updated) {
      return res.status(404).json({ error: 'Investigation case not found' });
    }
    res.json({
      message: 'Investigation updated successfully',
      case: updated
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

apiRouter.get('/investigations/:id/evidence', (req, res) => {
  const list = database.memory.evidence.filter(
    e => e.investigation_id === req.params.id || e.investigation_db_id === req.params.id
  );
  res.json({
    investigation_id: req.params.id,
    count: list.length,
    evidence: list
  });
});

apiRouter.post('/investigations/:id/evidence', async (req, res) => {
  try {
    const { evidence_type, description, source_data } = req.body;
    const inv = database.getInvestigationById(req.params.id);
    if (!inv) {
      return res.status(404).json({ error: 'Investigation not found' });
    }

    const saved = await database.saveEvidence({
      investigation_id: inv.db_id,
      investigation_db_id: inv.db_id,
      evidence_type: evidence_type || 'analyst_note',
      description: description || '',
      source_data: source_data || {}
    });

    res.status(201).json({
      message: 'Evidence recorded successfully',
      evidence: saved
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. AUTOMATED TRANSACTION SIMULATOR CONTROLS
apiRouter.get('/simulator/status', (req, res) => {
  res.json(simulator.getStatus());
});

apiRouter.post('/simulator/start', (req, res) => {
  const interval = Number(req.body?.intervalMs) || 4000;
  simulator.start(interval);
  res.json({ message: 'Transaction simulator started', status: simulator.getStatus() });
});

apiRouter.post('/simulator/stop', (req, res) => {
  simulator.stop();
  res.json({ message: 'Transaction simulator stopped', status: simulator.getStatus() });
});

apiRouter.post('/simulator/trigger', async (req, res) => {
  try {
    const type = req.body?.type; // 'normal', 'high_value', 'mule', 'structuring'
    const result = await simulator.generateTransaction(type);
    res.json({
      message: 'Simulated transaction triggered',
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. REAL-TIME SERVER-SENT EVENTS (SSE) STREAM
apiRouter.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });

  res.write(`data: ${JSON.stringify({ type: 'connected', time: new Date().toISOString() })}\n\n`);

  // Cloud proxy keepalive heartbeat
  const heartbeat = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 12000);

  const removeListener = simulator.addListener((event, payload) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
  });

  req.on('close', () => {
    clearInterval(heartbeat);
    removeListener();
  });
});

// Mount the API Router on both '/api' and '/'
app.use('/api', apiRouter);
app.use('/', apiRouter);

// -------------------------------------------------------------
// 7. FRONTEND STATIC ASSETS SERVING (Local Standalone Server)
// -------------------------------------------------------------
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/health') && !req.path.startsWith('/stream')) {
      return res.sendFile(path.join(frontendDist, 'index.html'));
    }
    next();
  });
}

// -------------------------------------------------------------
// 8. INITIALIZE AND START STANDALONE SERVER
// -------------------------------------------------------------
const PORT = process.env.PORT || 3000;

async function bootstrap() {
  console.log('--- Initializing Sentinel Backend ---');
  await database.loadInitialData();

  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Sentinel Fraud Detection API is running on port ${PORT}`);
    console.log(` Web App & Dashboard: http://localhost:${PORT}`);
    console.log(` Endpoints:`);
    console.log(`   Health:         GET  http://localhost:${PORT}/api/health`);
    console.log(`   Stats:          GET  http://localhost:${PORT}/api/stats`);
    console.log(`   Transactions:   GET  http://localhost:${PORT}/api/transactions`);
    console.log(`   Submit TX:      POST http://localhost:${PORT}/api/transactions`);
    console.log(`   Alerts:         GET  http://localhost:${PORT}/api/alerts`);
    console.log(`   Investigations: GET  http://localhost:${PORT}/api/investigations`);
    console.log(`   Realtime SSE:   GET  http://localhost:${PORT}/api/stream`);
    console.log(`   Simulator:      POST http://localhost:${PORT}/api/simulator/start`);
    console.log(`=======================================================`);

    // Automatically start the transaction simulator in standalone mode!
    simulator.start(4000);
  });
}

if (require.main === module) {
  bootstrap().catch(err => {
    console.error('Fatal initialization error:', err);
  });
}

// Export for Vercel Serverless Functions
module.exports = app;
