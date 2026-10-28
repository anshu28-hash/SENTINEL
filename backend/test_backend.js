require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const database = require('./database');
const fraudDetector = require('./fraudDetector');
const simulator = require('./simulator');

async function runTests() {
  console.log('==============================================');
  console.log('   Sentinel Backend Comprehensive Test Suite  ');
  console.log('==============================================\n');

  // Test 1: Load DB
  console.log('Test 1: Initializing database service...');
  await database.loadInitialData();
  const stats = database.getStats();
  console.log('Stats loaded:', {
    totalTransactions: stats.totalTransactions,
    flagged: stats.flaggedTransactions,
    alerts: stats.totalAlerts
  });
  console.log('✓ Test 1 Passed\n');

  // Test 2: Fraud Detection Engine Rules
  console.log('Test 2: Testing Fraud Detection Rules...');

  // 2a. Normal transaction
  const normalTx = {
    id: 'TXN-TEST-NORMAL',
    sender: 'ACC-0018',
    receiver: 'ACC-0921',
    amount: 1500,
    channel: 'UPI',
    date: new Date().toISOString()
  };
  const evalNormal = fraudDetector.evaluate(normalTx, []);
  console.log(`Normal TX Evaluation: Score=${evalNormal.risk_score}, Severity=${evalNormal.severity}, IsFraud=${evalNormal.is_fraud}`);
  if (evalNormal.is_fraud) throw new Error('Normal TX was incorrectly marked as fraud!');
  console.log('✓ Normal transaction check passed');

  // 2b. High-value transaction
  const highValueTx = {
    id: 'TXN-TEST-HIGH',
    sender: 'ACC-0120',
    receiver: 'ACC-0351',
    amount: 350000,
    channel: 'IMPS',
    date: new Date().toISOString()
  };
  const evalHigh = fraudDetector.evaluate(highValueTx, []);
  console.log(`High-Value TX Evaluation: Score=${evalHigh.risk_score}, Severity=${evalHigh.severity}, IsFraud=${evalHigh.is_fraud}`);
  if (!evalHigh.is_fraud || evalHigh.risk_score < 40) throw new Error('High value transaction failed to flag fraud!');
  console.log('✓ High value anomaly check passed');

  // 2c. Money Mule / Rapid Onward Transfer
  const now = Date.now();
  const priorInflow = {
    id: 'TXN-PRIOR-INFLOW',
    sender: 'ACC-0018',
    receiver: 'ACC-0921',
    amount: 250000,
    channel: 'IMPS',
    date: new Date(now - 2 * 60 * 1000).toISOString()
  };
  const muleOutflow = {
    id: 'TXN-MULE-OUTFLOW',
    sender: 'ACC-0921',
    receiver: 'ACC-0420',
    amount: 242000,
    channel: 'UPI',
    date: new Date(now).toISOString()
  };
  const evalMule = fraudDetector.evaluate(muleOutflow, [priorInflow]);
  console.log(`Mule TX Evaluation: Score=${evalMule.risk_score}, Severity=${evalMule.severity}, IsFraud=${evalMule.is_fraud}`);
  console.log('Rules triggered:', evalMule.triggered_rules);
  if (!evalMule.is_fraud || !evalMule.triggered_rules.some(r => r.includes('Rapid onward transfer'))) {
    throw new Error('Money mule pattern failed to trigger rapid onward transfer rule!');
  }
  console.log('✓ Money mule detection check passed');

  // 2d. Velocity burst
  const burstTxs = [
    { id: 'T1', sender: 'ACC-0814', receiver: 'ACC-0502', amount: 5000, channel: 'UPI', date: new Date(now - 60000).toISOString() },
    { id: 'T2', sender: 'ACC-0814', receiver: 'ACC-0731', amount: 8000, channel: 'UPI', date: new Date(now - 30000).toISOString() }
  ];
  const rapidTx = {
    id: 'T3',
    sender: 'ACC-0814',
    receiver: 'ACC-0311',
    amount: 9000,
    channel: 'UPI',
    date: new Date(now).toISOString()
  };
  const evalVelocity = fraudDetector.evaluate(rapidTx, burstTxs);
  console.log(`Velocity TX Evaluation: Score=${evalVelocity.risk_score}, Rules:`, evalVelocity.triggered_rules);
  if (!evalVelocity.triggered_rules.some(r => r.includes('Velocity alert'))) {
    throw new Error('Velocity rule failed to trigger!');
  }
  console.log('✓ Velocity monitoring check passed\n');

  // Test 3: Simulator Generation
  console.log('Test 3: Testing Automated Simulator Generation...');
  const simulatedEvent = await simulator.generateTransaction('mule');
  console.log('Generated simulated mule transaction:', {
    id: simulatedEvent.transaction.id,
    amount: simulatedEvent.transaction.amount,
    is_fraud: simulatedEvent.evaluation.is_fraud,
    risk_score: simulatedEvent.evaluation.risk_score,
    alert_created: Boolean(simulatedEvent.alert),
    investigation_created: Boolean(simulatedEvent.investigation)
  });
  if (!simulatedEvent.alert || !simulatedEvent.investigation) {
    throw new Error('Simulated fraudulent transaction failed to generate Alert and Investigation!');
  }
  console.log('✓ Test 3 Passed: Automatic transaction generation & detection verified!\n');

  // Test 4: Query APIs check
  console.log('Test 4: Checking Database Queries...');
  const txList = database.getTransactions({ limit: 5 });
  console.log(`Transactions retrieved: ${txList.data.length} of ${txList.total}`);
  const alertsList = database.getAlerts({ limit: 5 });
  console.log(`Alerts retrieved: ${alertsList.length}`);
  const casesList = database.getInvestigations({ limit: 5 });
  console.log(`Investigations retrieved: ${casesList.length}`);
  console.log('✓ Test 4 Passed\n');

  console.log('==============================================');
  console.log('   ALL BACKEND TESTS PASSED SUCCESSFULLY!    ');
  console.log('==============================================');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
