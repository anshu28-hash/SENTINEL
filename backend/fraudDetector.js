/**
 * Sentinel Fraud Detection Engine
 * Real-time heuristic & pattern analysis for financial transactions
 */

class FraudDetector {
  /**
   * Analyze transaction against historical transactions and rules
   * @param {Object} currentTx - { id, sender, receiver, amount, channel, date }
   * @param {Array} history - Array of recent transactions
   * @returns {Object} Evaluation result
   */
  evaluate(currentTx, history = []) {
    const amount = Number(currentTx.amount) || 0;
    const sender = (currentTx.sender || '').trim().toUpperCase();
    const receiver = (currentTx.receiver || '').trim().toUpperCase();
    const channel = (currentTx.channel || 'UPI').toUpperCase();
    const currentTime = new Date(currentTx.date || Date.now()).getTime();

    let riskScore = 5; // Clean baseline
    const triggeredRules = [];
    const evidenceList = [];

    evidenceList.push(
      `${currentTx.id || 'Transaction'} recorded: ₹${amount.toLocaleString('en-IN')} transferred from ${sender} to ${receiver} via ${channel}.`
    );

    // 1. High-Value Anomaly Rule
    if (amount >= 500000) {
      riskScore += 75;
      triggeredRules.push(`Critical high-value transfer: ₹${amount.toLocaleString('en-IN')} exceeds standard institutional monitoring threshold.`);
      evidenceList.push(`Transfer amount ₹${amount.toLocaleString('en-IN')} exceeds ₹5,00,000 compliance threshold.`);
    } else if (amount >= 200000) {
      riskScore += 55;
      triggeredRules.push(`High-value anomaly: Transfer of ₹${amount.toLocaleString('en-IN')} is unusually large for channel ${channel}.`);
      evidenceList.push(`Transfer amount ₹${amount.toLocaleString('en-IN')} is significantly above typical retail volume.`);
    } else if (amount >= 100000 && channel === 'UPI') {
      riskScore += 40;
      triggeredRules.push(`Large retail payment: ₹${amount.toLocaleString('en-IN')} UPI transfer nearing daily retail limit.`);
    } else if (amount >= 50000 && channel === 'UPI') {
      riskScore += 10;
    }

    // 2. Velocity / Rapid Burst Rule (High frequency in short interval: 2+ prior transfers within 2 minutes)
    const recentSenderTxs = history.filter(t => {
      if (t.id === currentTx.id) return false;
      if ((t.sender || '').toUpperCase() !== sender) return false;
      const txTime = new Date(t.date).getTime();
      return currentTime - txTime > 0 && currentTime - txTime <= 2 * 60 * 1000;
    });

    if (recentSenderTxs.length >= 3) {
      riskScore += 50;
      const priorRefs = recentSenderTxs.map(t => t.id).join(', ');
      triggeredRules.push(`Velocity alert: ${recentSenderTxs.length + 1} rapid transfers initiated by ${sender} within 2 minutes.`);
      evidenceList.push(`Velocity anomaly: Rapid automated burst (${priorRefs}) in a tight 2-minute window.`);
    } else if (recentSenderTxs.length >= 2) {
      riskScore += 35;
      const priorRefs = recentSenderTxs.map(t => t.id).join(', ');
      triggeredRules.push(`Velocity alert: Multiple rapid transfers (${priorRefs}) initiated by ${sender} within 2 minutes.`);
      evidenceList.push(`Velocity warning: Account ${sender} has completed ${recentSenderTxs.length + 1} transactions in under 2 minutes.`);
    }

    // 3. Money Mule / Rapid Onward Transfer (Layering) Rule
    // Sender recently received a substantial amount, and is now transferring out ~80-105% of it
    const recentIncoming = history.find(t => {
      if (t.id === currentTx.id) return false;
      if ((t.receiver || '').toUpperCase() !== sender) return false;
      const txTime = new Date(t.date).getTime();
      const timeDiff = currentTime - txTime;
      // Within 15 minutes, significant amount (> ₹50,000) and similar amount (within 25% margin)
      return timeDiff > 0 && timeDiff <= 15 * 60 * 1000 && t.amount >= 50000 && Math.abs(t.amount - amount) <= 0.25 * t.amount;
    });

    if (recentIncoming) {
      riskScore += 55;
      const minutesAgo = Math.max(1, Math.round((currentTime - new Date(recentIncoming.date).getTime()) / 60000));
      triggeredRules.push(`Rapid onward transfer: Account ${sender} received ₹${recentIncoming.amount.toLocaleString('en-IN')} and routed ₹${amount.toLocaleString('en-IN')} onward ${minutesAgo} minute(s) later.`);
      evidenceList.push(`Pass-through flow: Inflow of ₹${recentIncoming.amount.toLocaleString('en-IN')} on ${recentIncoming.id} was immediately forwarded onward.`);
    }

    // 4. Structuring / Smurfing Rule (Just below common regulatory limits)
    const isStructuring = (amount >= 48500 && amount <= 49999) ||
                          (amount >= 98000 && amount <= 99999) ||
                          (amount >= 195000 && amount <= 199999);
    if (isStructuring) {
      riskScore += 45;
      triggeredRules.push(`Structuring indicator: Transfer amount of ₹${amount.toLocaleString('en-IN')} deliberately avoids standard reporting ceilings.`);
      evidenceList.push(`Amount ₹${amount.toLocaleString('en-IN')} matches documented structuring evasion profile.`);
    }

    // 5. Nocturnal / Off-Peak Hours Anomaly (1:00 AM - 4:30 AM IST for large amounts)
    const txDate = new Date(currentTx.date || Date.now());
    const utcHours = txDate.getUTCHours();
    const utcMinutes = txDate.getUTCMinutes();
    const istHours = (utcHours + 5 + Math.floor((utcMinutes + 30) / 60)) % 24;
    if (istHours >= 1 && istHours <= 4 && amount >= 50000) {
      riskScore += 15;
      triggeredRules.push(`Temporal risk: Off-peak transfer initiated during anomalous nocturnal hours (${istHours}:00 IST).`);
    }

    // 6. Circular Fund Flow (Large amounts moving in cycles)
    const circular = history.find(t => {
      if (t.id === currentTx.id) return false;
      const txTime = new Date(t.date).getTime();
      return (t.sender || '').toUpperCase() === receiver &&
             (t.receiver || '').toUpperCase() === sender &&
             amount > 20000 &&
             (currentTime - txTime <= 30 * 60 * 1000);
    });
    if (circular) {
      riskScore += 40;
      triggeredRules.push(`Circular flow: Cyclical transaction pattern detected between ${sender} and ${receiver}.`);
      evidenceList.push(`Counterparty ${receiver} previously sent funds to ${sender} within the last 30 minutes (${circular.id}).`);
    }

    // Cap score at 99
    riskScore = Math.min(99, riskScore);

    // Classification
    let severity = 'Low';
    let isFraud = false;
    let primaryReason = 'Standard transfer conforming to typical behavioral patterns.';

    if (riskScore >= 75) {
      severity = 'Critical';
      isFraud = true;
      primaryReason = triggeredRules.join(' ') || 'Critical multi-indicator anomalous activity detected.';
    } else if (riskScore >= 55) {
      severity = 'High';
      isFraud = true;
      primaryReason = triggeredRules.join(' ') || 'Elevated risk detected across transaction parameters.';
    } else if (riskScore >= 40) {
      severity = 'Medium';
      isFraud = true;
      primaryReason = triggeredRules.join(' ') || 'Transfer triggered velocity or pattern monitoring rules.';
    } else {
      severity = 'Low';
      isFraud = false;
    }

    const aiSummary = this.generateAiSummary(currentTx, riskScore, severity, triggeredRules, evidenceList);

    return {
      is_fraud: isFraud,
      risk_score: riskScore,
      severity,
      reason: primaryReason,
      triggered_rules: triggeredRules,
      evidence: evidenceList,
      ai_summary: aiSummary
    };
  }

  generateAiSummary(tx, score, severity, rules, evidence) {
    const formattedAmount = `₹${Number(tx.amount).toLocaleString('en-IN')}`;
    const dateStr = new Date(tx.date || Date.now()).toISOString();

    return `### 1. Observed Facts
*   **Transaction ID:** ${tx.id || 'N/A'}.
*   **Accounts:** Sender ${tx.sender} → Receiver ${tx.receiver}.
*   **Amount:** ${formattedAmount} (${tx.channel || 'UPI'}).
*   **Timestamp:** ${dateStr}.
*   **Risk Evaluation:** Calculated risk score of **${score}/100** (${severity} severity).

### 2. Suspicious Indicators
${rules.length > 0 ? rules.map(r => `*   **Indicator:** ${r}`).join('\n') : '*   No anomalous indicators detected; transaction falls within expected parameters.'}

### 3. Plausible Alternative Explanations
*   **Legitimate High-Volume User:** Account holder may be conducting scheduled vendor disbursements or emergency personal fund movement.
*   **Business Operations:** Transaction batching or merchant supplier settlements.
*   **User Retrial:** Intermittent network connectivity may have caused user to retry payment sequence.

### 4. Missing Evidence
*   **KYC / Beneficiary Relationship:** Historical relationship between ${tx.sender} and ${tx.receiver}.
*   **Device Fingerprinting:** IP address, geolocation, and device hardware hashes.
*   **Account Age & Velocity History:** Median 90-day balance and standard transaction distribution.

### 5. Recommended Analyst Checks
*   Review beneficiary account creation date and verify if receiver has existing fraud tags.
*   Check whether funds received by ${tx.receiver} are immediately liquidated via ATM withdrawal or crypto exchange.
*   Perform direct customer outreach if risk score exceeds 75.

### 6. Uncertainty and Limitations
*   Score reflects automated heuristic rule triggers; human analyst discretion is required before account restriction.`;
  }
}

module.exports = new FraudDetector();
