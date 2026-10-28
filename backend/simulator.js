const database = require('./database');
const fraudDetector = require('./fraudDetector');

class TransactionSimulator {
  constructor() {
    this.timer = null;
    this.isRunning = false;
    this.intervalMs = 4000; // 4 seconds per transaction
    this.eventListeners = new Set();
    this.stats = {
      totalGenerated: 0,
      fraudDetected: 0,
      normalCount: 0,
      startedAt: null
    };

    // Realistic account pool
    this.accountPool = [
      'ACC-0018', 'ACC-0921', 'ACC-0420', 'ACC-0311',
      'ACC-0814', 'ACC-0502', 'ACC-0731', 'ACC-0120',
      'ACC-0351', 'ACC-1102', 'ACC-2299', 'ACC-4410',
      'ACC-5512', 'ACC-6634', 'ACC-7745', 'ACC-8856',
      'ACC-9967', 'ACC-1234', 'ACC-5678', 'ACC-9012'
    ];
    this.channels = ['UPI', 'UPI', 'UPI', 'IMPS', 'NEFT', 'RTGS'];

    this.pendingMuleChain = null;
  }

  addListener(callback) {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  broadcast(event, payload) {
    for (const listener of this.eventListeners) {
      try {
        listener(event, payload);
      } catch (err) {
        console.warn('Listener broadcast error:', err.message);
      }
    }
  }

  start(intervalMs = 4000) {
    if (this.isRunning) return;
    this.intervalMs = intervalMs;
    this.isRunning = true;
    this.stats.startedAt = new Date().toISOString();
    console.log(`[Simulator] Started automated transaction generator (Interval: ${this.intervalMs}ms)`);

    this.timer = setInterval(() => {
      this.generateTransaction().catch(err => {
        console.error('[Simulator] Generation error:', err.message);
      });
    }, this.intervalMs);
  }

  stop() {
    if (!this.isRunning) return;
    clearInterval(this.timer);
    this.timer = null;
    this.isRunning = false;
    console.log('[Simulator] Stopped automated transaction generator');
  }

  async generateTransaction(forcedType = null) {
    let sender, receiver, amount, channel;
    const rand = Math.random();

    // 1. Pending money mule step 2 (pass-through)
    if (!forcedType && this.pendingMuleChain && Date.now() - this.pendingMuleChain.time < 30000) {
      sender = this.pendingMuleChain.receiver;
      receiver = this.getRandomAccount([sender, this.pendingMuleChain.sender]);
      amount = Math.round(this.pendingMuleChain.amount * 0.95);
      channel = 'UPI';
      this.pendingMuleChain = null;
    } else if (forcedType === 'mule' || (!forcedType && rand < 0.12)) {
      // Step 1 of mule
      sender = this.getRandomAccount();
      receiver = this.getRandomAccount([sender]);
      amount = 240000 + Math.floor(Math.random() * 80000);
      channel = 'IMPS';
      this.pendingMuleChain = { sender, receiver, amount, time: Date.now() };
    } else if (forcedType === 'high_value' || (!forcedType && rand >= 0.12 && rand < 0.22)) {
      // High value anomaly
      sender = this.getRandomAccount();
      receiver = this.getRandomAccount([sender]);
      amount = 220000 + Math.floor(Math.random() * 300000); // 2.2L - 5.2L
      channel = ['IMPS', 'RTGS'][Math.floor(Math.random() * 2)];
    } else if (forcedType === 'structuring' || (!forcedType && rand >= 0.22 && rand < 0.28)) {
      // Structuring just below limits
      sender = this.getRandomAccount();
      receiver = this.getRandomAccount([sender]);
      const bases = [49200, 49700, 98800, 196000];
      amount = bases[Math.floor(Math.random() * bases.length)] + Math.floor(Math.random() * 200);
      channel = 'UPI';
    } else {
      // Standard everyday legitimate transaction (~72% of the time)
      sender = this.getRandomAccount();
      receiver = this.getRandomAccount([sender]);
      const normalAmounts = [
        250, 480, 850, 1400, 2600, 4800, 7500, 12000, 18500, 24000, 31000
      ];
      amount = normalAmounts[Math.floor(Math.random() * normalAmounts.length)];
      channel = this.channels[Math.floor(Math.random() * this.channels.length)];
    }

    const txId = `TXN-${Math.floor(1000 + Math.random() * 9000)}`;
    const txObj = {
      id: txId,
      sender,
      receiver,
      amount,
      channel,
      date: new Date().toISOString()
    };

    // Run Fraud Detection Engine
    const recentTxs = database.getRecentTransactions(50);
    const evaluation = fraudDetector.evaluate(txObj, recentTxs);

    let savedAlert = null;
    let savedInvestigation = null;

    let alertRef = null;
    if (evaluation.is_fraud) {
      alertRef = `ALT-${Math.floor(100 + Math.random() * 900)}`;
      txObj.alertId = alertRef;
    }

    // Save transaction
    const savedTx = await database.saveTransaction(txObj);

    if (evaluation.is_fraud) {
      this.stats.fraudDetected++;

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
        evidence_type: 'automated_rule_trigger',
        description: evaluation.reason,
        source_data: {
          transaction_ref: savedTx.id,
          amount: savedTx.amount,
          risk_score: evaluation.risk_score,
          triggered_rules: evaluation.triggered_rules
        }
      });
    } else {
      this.stats.normalCount++;
    }

    this.stats.totalGenerated++;

    const eventPayload = {
      transaction: savedTx,
      evaluation: {
        is_fraud: evaluation.is_fraud,
        risk_score: evaluation.risk_score,
        severity: evaluation.severity,
        reason: evaluation.reason
      },
      alert: savedAlert,
      investigation: savedInvestigation
    };

    this.broadcast('transaction', eventPayload);

    console.log(`[Simulator] ${savedTx.id}: ₹${savedTx.amount} (${savedTx.sender} → ${savedTx.receiver}) [${savedTx.channel}] | Risk: ${evaluation.risk_score}/100 (${evaluation.severity}) ${evaluation.is_fraud ? '🚨 FRAUD FLAGGED' : '✓ SAFE'}`);

    return eventPayload;
  }

  getRandomAccount(exclude = []) {
    const candidates = this.accountPool.filter(a => !exclude.includes(a));
    return candidates[Math.floor(Math.random() * candidates.length)] || 'ACC-9999';
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      intervalMs: this.intervalMs,
      stats: {
        ...this.stats,
        activeSubscribers: this.eventListeners.size
      }
    };
  }
}

module.exports = new TransactionSimulator();
