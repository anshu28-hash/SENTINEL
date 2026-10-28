const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

class DatabaseService {
  constructor() {
    this.supabase = null;
    this.isSupabaseConnected = false;
    this.memory = {
      accounts: new Map(),
      transactions: [],
      alerts: [],
      investigations: [],
      evidence: [],
      auditLogs: []
    };
    this.initClient();
  }

  initClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      try {
        this.supabase = createClient(url, key);
        this.isSupabaseConnected = true;
        console.log('✓ Supabase client initialized');
      } catch (err) {
        console.warn('! Supabase init warning:', err.message);
        this.isSupabaseConnected = false;
      }
    } else {
      console.warn('! Supabase credentials missing in .env, running in local in-memory fallback');
    }
  }

  async loadInitialData() {
    if (!this.supabase) {
      this.seedLocalFallback();
      return;
    }

    try {
      // 1. Load accounts
      const { data: accounts, error: accErr } = await this.supabase.from('accounts').select('*');
      if (!accErr && accounts) {
        for (const acc of accounts) {
          this.memory.accounts.set(acc.id, acc);
          this.memory.accounts.set(acc.account_ref, acc);
        }
      }

      // 2. Load alerts
      const { data: alerts } = await this.supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });

      // 3. Load investigations
      const { data: invs } = await this.supabase
        .from('investigations')
        .select('*')
        .order('created_at', { ascending: false });

      // 4. Load evidence
      const { data: evs } = await this.supabase
        .from('evidence')
        .select('*')
        .order('created_at', { ascending: false });

      // 5. Load transactions
      const { data: txs } = await this.supabase
        .from('transactions')
        .select('*')
        .order('occurred_at', { ascending: false });

      if (alerts) {
        this.memory.alerts = alerts.map(a => ({
          id: a.alert_ref || a.id,
          db_id: a.id,
          alert_ref: a.alert_ref,
          transaction_id: a.transaction_id,
          transactionId: a.transaction_id, // mapped below
          score: Number(a.risk_score),
          risk_score: Number(a.risk_score),
          severity: a.risk_score >= 80 ? 'Critical' : a.risk_score >= 60 ? 'High' : 'Medium',
          status: a.status === 'closed' ? 'Closed' : a.status === 'investigating' ? 'Under review' : 'Open',
          raw_status: a.status,
          reason: a.reason,
          created: a.created_at,
          created_at: a.created_at
        }));
      }

      if (txs) {
        this.memory.transactions = txs.map(t => {
          const sender = this.memory.accounts.get(t.sender_account_id)?.account_ref || 'ACC-0018';
          const receiver = this.memory.accounts.get(t.receiver_account_id)?.account_ref || 'ACC-0921';
          const matchedAlert = (this.memory.alerts || []).find(a => a.transaction_id === t.id);
          return {
            id: t.transaction_ref || `TXN-${t.id.slice(0, 4)}`,
            db_id: t.id,
            sender,
            receiver,
            sender_id: t.sender_account_id,
            receiver_id: t.receiver_account_id,
            amount: Number(t.amount),
            currency: t.currency || 'INR',
            channel: t.channel || (t.amount > 100000 ? 'IMPS' : 'UPI'),
            date: t.occurred_at || t.created_at,
            alertId: matchedAlert ? matchedAlert.id : null,
            created_at: t.created_at
          };
        });

        // Sync alert.transactionId to display friendly ref
        for (const a of this.memory.alerts) {
          const t = this.memory.transactions.find(tx => tx.db_id === a.transaction_id);
          if (t) {
            a.transactionId = t.id;
          }
        }
      }

      if (invs) {
        this.memory.investigations = invs.map(inv => {
          const matchedAlert = this.memory.alerts.find(a => a.db_id === inv.alert_id);
          const priority = matchedAlert ? matchedAlert.severity : 'High';
          let displayStatus = 'Awaiting review';
          if (inv.workflow_status === 'completed') displayStatus = 'Closed';
          else if (inv.workflow_status === 'processing') displayStatus = 'Investigating';

          return {
            id: `CASE-${inv.id.slice(0, 4).toUpperCase()}`,
            db_id: inv.id,
            alertId: matchedAlert ? matchedAlert.id : 'ALT-001',
            alert_id: inv.alert_id,
            priority,
            status: displayStatus,
            workflow_status: inv.workflow_status,
            analyst: 'AI Sentinel Agent',
            created: inv.created_at,
            updated: inv.updated_at,
            evidence: ['Observed high risk activity in transaction cluster.'],
            summary: inv.ai_summary,
            ai_summary: inv.ai_summary,
            outcome: inv.workflow_status === 'completed' ? 'confirmed_fraud' : null,
            notes: null
          };
        });
      }

      if (evs) this.memory.evidence = evs;

      console.log(`✓ Loaded from Supabase: ${this.memory.accounts.size / 2} accounts, ${this.memory.transactions.length} transactions, ${this.memory.alerts.length} alerts, ${this.memory.investigations.length} investigations`);
    } catch (err) {
      console.error('Error loading data from Supabase:', err.message);
      this.seedLocalFallback();
    }
  }

  seedLocalFallback() {
    const demoAccounts = ['ACC-0018', 'ACC-0921', 'ACC-0420', 'ACC-0311', 'ACC-0814', 'ACC-0502', 'ACC-0731', 'ACC-0120', 'ACC-0351'];
    demoAccounts.forEach(ref => {
      const id = crypto.randomUUID();
      const obj = { id, account_ref: ref, created_at: new Date().toISOString() };
      this.memory.accounts.set(id, obj);
      this.memory.accounts.set(ref, obj);
    });
  }

  async findOrCreateAccount(accountRef) {
    if (!accountRef) return null;
    const cleanRef = accountRef.trim().toUpperCase();

    if (this.memory.accounts.has(cleanRef)) {
      return this.memory.accounts.get(cleanRef);
    }

    if (this.supabase) {
      try {
        const { data: existing } = await this.supabase
          .from('accounts')
          .select('*')
          .eq('account_ref', cleanRef)
          .maybeSingle();

        if (existing) {
          this.memory.accounts.set(existing.id, existing);
          this.memory.accounts.set(existing.account_ref, existing);
          return existing;
        }

        const { data: created, error } = await this.supabase
          .from('accounts')
          .insert({ account_ref: cleanRef })
          .select()
          .single();

        if (!error && created) {
          this.memory.accounts.set(created.id, created);
          this.memory.accounts.set(created.account_ref, created);
          return created;
        }
      } catch (err) {
        console.error('findOrCreateAccount DB error:', err.message);
      }
    }

    const id = crypto.randomUUID();
    const newAcc = { id, account_ref: cleanRef, created_at: new Date().toISOString() };
    this.memory.accounts.set(id, newAcc);
    this.memory.accounts.set(cleanRef, newAcc);
    return newAcc;
  }

  async saveTransaction(txn) {
    const senderAcc = await this.findOrCreateAccount(txn.sender);
    const receiverAcc = await this.findOrCreateAccount(txn.receiver);

    const transaction_ref = txn.id || `TXN-${Math.floor(1000 + Math.random() * 9000)}`;
    const dbPayload = {
      transaction_ref,
      sender_account_id: senderAcc ? senderAcc.id : null,
      receiver_account_id: receiverAcc ? receiverAcc.id : null,
      amount: Number(txn.amount),
      currency: txn.currency || 'INR',
      occurred_at: txn.date || new Date().toISOString()
    };

    let savedDbRecord = null;
    if (this.supabase && dbPayload.sender_account_id && dbPayload.receiver_account_id) {
      try {
        const { data, error } = await this.supabase
          .from('transactions')
          .insert(dbPayload)
          .select()
          .single();

        if (!error && data) {
          savedDbRecord = data;
        } else if (error) {
          console.warn('Supabase insert transaction warning:', error.message);
        }
      } catch (err) {
        console.warn('Supabase transaction save error:', err.message);
      }
    }

    const memoryRecord = {
      id: transaction_ref,
      db_id: savedDbRecord ? savedDbRecord.id : crypto.randomUUID(),
      sender: txn.sender,
      receiver: txn.receiver,
      sender_id: senderAcc?.id,
      receiver_id: receiverAcc?.id,
      amount: Number(txn.amount),
      currency: txn.currency || 'INR',
      channel: txn.channel || 'UPI',
      date: dbPayload.occurred_at,
      alertId: txn.alertId || null,
      created_at: new Date().toISOString()
    };

    this.memory.transactions.unshift(memoryRecord);
    return memoryRecord;
  }

  normalizeAlertStatus(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('close')) return 'closed';
    if (s.includes('investigat') || s.includes('review') || s.includes('process')) return 'investigating';
    return 'open';
  }

  normalizeWorkflowStatus(status) {
    const s = (status || '').toLowerCase();
    if (s.includes('close') || s.includes('complet')) return 'completed';
    if (s.includes('fail')) return 'failed';
    if (s.includes('investigat') || s.includes('process')) return 'processing';
    return 'pending';
  }

  async saveAlert(alertData) {
    const alert_ref = alertData.alert_ref || `ALT-${Math.floor(100 + Math.random() * 900)}`;
    const dbStatus = this.normalizeAlertStatus(alertData.status);

    const dbPayload = {
      alert_ref,
      transaction_id: alertData.transaction_db_id || alertData.transaction_id,
      risk_score: alertData.risk_score || 0,
      reason: alertData.reason || '',
      status: dbStatus,
      created_at: alertData.created_at || new Date().toISOString()
    };

    let savedDbRecord = null;
    if (this.supabase && dbPayload.transaction_id) {
      try {
        const { data, error } = await this.supabase
          .from('alerts')
          .insert(dbPayload)
          .select()
          .single();

        if (!error && data) {
          savedDbRecord = data;
        } else if (error) {
          console.warn('Supabase insert alert warning:', error.message);
        }
      } catch (err) {
        console.warn('Supabase alert save error:', err.message);
      }
    }

    const memoryRecord = {
      id: alert_ref,
      db_id: savedDbRecord ? savedDbRecord.id : crypto.randomUUID(),
      alert_ref,
      transaction_id: dbPayload.transaction_id,
      transactionId: alertData.transaction_ref || alertData.transactionId,
      score: alertData.risk_score,
      risk_score: alertData.risk_score,
      severity: alertData.severity || (alertData.risk_score >= 80 ? 'Critical' : alertData.risk_score >= 60 ? 'High' : 'Medium'),
      status: dbStatus === 'closed' ? 'Closed' : dbStatus === 'investigating' ? 'Under review' : 'Open',
      raw_status: dbStatus,
      reason: dbPayload.reason,
      created: dbPayload.created_at,
      created_at: dbPayload.created_at
    };

    this.memory.alerts.unshift(memoryRecord);

    const tx = this.memory.transactions.find(t => t.id === memoryRecord.transactionId || t.db_id === memoryRecord.transaction_id);
    if (tx) {
      tx.alertId = alert_ref;
    }

    return memoryRecord;
  }

  async saveInvestigation(invData) {
    const case_ref = invData.id || `CASE-${Math.floor(100 + Math.random() * 900)}`;
    const dbStatus = this.normalizeWorkflowStatus(invData.workflow_status || invData.status);

    const dbPayload = {
      alert_id: invData.alert_db_id || invData.alert_id,
      workflow_status: dbStatus,
      ai_summary: invData.ai_summary || '',
      created_at: invData.created_at || new Date().toISOString(),
      updated_at: invData.updated_at || new Date().toISOString()
    };

    let savedDbRecord = null;
    if (this.supabase && dbPayload.alert_id) {
      try {
        const { data, error } = await this.supabase
          .from('investigations')
          .insert(dbPayload)
          .select()
          .single();

        if (!error && data) {
          savedDbRecord = data;
        } else if (error) {
          console.warn('Supabase insert investigation warning:', error.message);
        }
      } catch (err) {
        console.warn('Supabase investigation save error:', err.message);
      }
    }

    const memoryRecord = {
      id: case_ref,
      db_id: savedDbRecord ? savedDbRecord.id : crypto.randomUUID(),
      alertId: invData.alert_ref || invData.alertId,
      alert_id: dbPayload.alert_id,
      priority: invData.priority || 'High',
      status: dbStatus === 'completed' ? 'Closed' : dbStatus === 'processing' ? 'Investigating' : 'Awaiting review',
      workflow_status: dbStatus,
      analyst: invData.analyst || 'AI Sentinel Agent',
      created: dbPayload.created_at,
      updated: dbPayload.updated_at,
      evidence: invData.evidence || [],
      summary: dbPayload.ai_summary,
      ai_summary: dbPayload.ai_summary,
      outcome: invData.outcome || null,
      notes: invData.notes || null
    };

    this.memory.investigations.unshift(memoryRecord);
    return memoryRecord;
  }

  async saveEvidence(evidenceData) {
    const dbPayload = {
      investigation_id: evidenceData.investigation_db_id || evidenceData.investigation_id,
      evidence_type: evidenceData.evidence_type || 'transaction_review',
      description: evidenceData.description || '',
      source_data: evidenceData.source_data || {}
    };

    let savedDbRecord = null;
    if (this.supabase && dbPayload.investigation_id) {
      try {
        const { data, error } = await this.supabase
          .from('evidence')
          .insert(dbPayload)
          .select()
          .single();

        if (!error && data) {
          savedDbRecord = data;
        }
      } catch (err) {
        console.warn('Supabase evidence save error:', err.message);
      }
    }

    const memoryRecord = {
      id: savedDbRecord ? savedDbRecord.id : crypto.randomUUID(),
      ...dbPayload,
      created_at: new Date().toISOString()
    };
    this.memory.evidence.unshift(memoryRecord);
    return memoryRecord;
  }

  async updateInvestigation(idOrRef, updates) {
    const inv = this.memory.investigations.find(c => c.id === idOrRef || c.db_id === idOrRef);
    if (!inv) return null;

    if (updates.outcome !== undefined) {
      inv.outcome = updates.outcome;
      inv.status = 'Closed';
      inv.workflow_status = 'completed';
    }
    if (updates.notes !== undefined) inv.notes = updates.notes;
    if (updates.status !== undefined) inv.status = updates.status;
    if (updates.workflow_status !== undefined) {
      inv.workflow_status = this.normalizeWorkflowStatus(updates.workflow_status);
    }
    if (updates.ai_summary !== undefined) {
      inv.summary = updates.ai_summary;
      inv.ai_summary = updates.ai_summary;
    }
    inv.updated = new Date().toISOString();

    if (this.supabase && inv.db_id) {
      try {
        const patchData = {
          updated_at: inv.updated,
          workflow_status: inv.workflow_status
        };
        if (updates.ai_summary) patchData.ai_summary = updates.ai_summary;

        await this.supabase
          .from('investigations')
          .update(patchData)
          .eq('id', inv.db_id);

        await this.supabase
          .from('audit_logs')
          .insert({
            action: 'investigation_updated',
            entity_type: 'investigation',
            alert_id: inv.alert_id,
            investigation_id: inv.db_id,
            details: {
              outcome: inv.outcome,
              workflow_status: inv.workflow_status,
              notes: inv.notes
            }
          });
      } catch (err) {
        console.warn('Supabase update investigation error:', err.message);
      }
    }

    return inv;
  }

  getTransactions({ q, status, channel, min, max, from, to, sort = 'newest', page = 1, limit = 50 } = {}) {
    let list = [...this.memory.transactions];

    if (q) {
      const query = q.toLowerCase();
      list = list.filter(t => 
        (t.id + ' ' + t.sender + ' ' + t.receiver).toLowerCase().includes(query)
      );
    }

    if (status === 'flagged') {
      list = list.filter(t => Boolean(t.alertId));
    } else if (status === 'normal') {
      list = list.filter(t => !t.alertId);
    }

    if (channel && channel !== 'all') {
      list = list.filter(t => t.channel === channel);
    }

    if (min !== undefined && min !== '' && !isNaN(min)) {
      list = list.filter(t => t.amount >= Number(min));
    }

    if (max !== undefined && max !== '' && !isNaN(max)) {
      list = list.filter(t => t.amount <= Number(max));
    }

    if (from) {
      list = list.filter(t => t.date.slice(0, 10) >= from);
    }

    if (to) {
      list = list.filter(t => t.date.slice(0, 10) <= to);
    }

    // Sort
    list.sort((a, b) => {
      if (sort === 'amount-desc') return b.amount - a.amount;
      if (sort === 'amount-asc') return a.amount - b.amount;
      if (sort === 'oldest') return a.date.localeCompare(b.date);
      return b.date.localeCompare(a.date);
    });

    const total = list.length;
    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.max(1, parseInt(limit) || 50);
    const paginated = list.slice((pageNum - 1) * pageSize, pageNum * pageSize);

    return {
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize) || 1,
      data: paginated
    };
  }

  getTransactionById(idOrRef) {
    return this.memory.transactions.find(t => t.id === idOrRef || t.db_id === idOrRef) || null;
  }

  getAlerts({ q, severity, sort = 'newest', limit } = {}) {
    let list = [...this.memory.alerts];

    if (q) {
      const query = q.toLowerCase();
      list = list.filter(a => 
        (a.id + ' ' + a.alert_ref + ' ' + a.transactionId + ' ' + a.reason).toLowerCase().includes(query)
      );
    }

    if (severity && severity !== 'all') {
      list = list.filter(a => a.severity.toLowerCase() === severity.toLowerCase());
    }

    list.sort((a, b) => {
      if (sort === 'score') return b.score - a.score;
      return (b.created || '').localeCompare(a.created || '');
    });

    if (limit) {
      list = list.slice(0, parseInt(limit));
    }

    return list;
  }

  getAlertById(idOrRef) {
    return this.memory.alerts.find(a => a.id === idOrRef || a.alert_ref === idOrRef || a.db_id === idOrRef) || null;
  }

  getInvestigations({ q, filter, limit } = {}) {
    let list = [...this.memory.investigations];

    if (q) {
      const query = q.toLowerCase();
      list = list.filter(c => 
        (c.id + ' ' + c.alertId + ' ' + c.analyst).toLowerCase().includes(query)
      );
    }

    if (filter && filter !== 'all') {
      list = list.filter(c => c.status.toLowerCase() === filter.toLowerCase());
    }

    if (limit) {
      list = list.slice(0, parseInt(limit));
    }

    return list;
  }

  getInvestigationById(idOrRef) {
    return this.memory.investigations.find(c => c.id === idOrRef || c.db_id === idOrRef) || null;
  }

  getRecentTransactions(limit = 100) {
    return this.memory.transactions.slice(0, limit);
  }

  getStats() {
    const totalTransactions = this.memory.transactions.length;
    const flagged = this.memory.transactions.filter(t => t.alertId).length;
    const activeAlerts = this.memory.alerts.filter(a => a.status !== 'Closed').length;
    const openInvestigations = this.memory.investigations.filter(c => c.status !== 'Closed').length;
    const awaitingReview = this.memory.investigations.filter(c => c.status === 'Awaiting review').length;
    const confirmedFraud = this.memory.investigations.filter(c => c.outcome === 'confirmed_fraud').length;
    const legitimate = this.memory.investigations.filter(c => c.outcome === 'legitimate').length;
    const inconclusive = this.memory.investigations.filter(c => c.outcome === 'inconclusive').length;

    const dailyMap = {};
    for (const t of this.memory.transactions) {
      const day = t.date ? t.date.slice(5, 10) : 'Today';
      if (!dailyMap[day]) dailyMap[day] = { day, transactions: 0, alerts: 0 };
      dailyMap[day].transactions++;
      if (t.alertId) dailyMap[day].alerts++;
    }

    const activity = Object.values(dailyMap).slice(-7);

    return {
      totalTransactions,
      flaggedTransactions: flagged,
      notFlaggedTransactions: totalTransactions - flagged,
      activeAlerts,
      totalAlerts: this.memory.alerts.length,
      openInvestigations,
      awaitingReview,
      confirmedFraud,
      legitimate,
      inconclusive,
      activity: activity.length > 0 ? activity : [
        { day: '25 Oct', transactions: 42, alerts: 7 },
        { day: '26 Oct', transactions: 38, alerts: 5 },
        { day: '27 Oct', transactions: 51, alerts: 9 },
        { day: '28 Oct', transactions: totalTransactions, alerts: this.memory.alerts.length }
      ]
    };
  }
}

module.exports = new DatabaseService();
