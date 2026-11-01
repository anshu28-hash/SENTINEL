import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter, NavLink, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, ShieldAlert, FolderSearch, ClipboardCheck, ChartNoAxesCombined, Settings, ShieldCheck, Bell, Menu, X } from 'lucide-react';
import { Dashboard, Transactions, Alerts, AlertDetail, Investigations, CaseDetail, ReviewQueue, Analytics, SettingsPage } from './pages/Pages.jsx';
import { initialCases, transactions as demoTransactions, alerts as demoAlerts, activity as demoActivity } from './data/demoData.js';
import { fetchTransactions, fetchAlerts, fetchInvestigations, fetchStats, saveAnalystDecision, triggerSimulatedTx, subscribeToLiveStream } from './data/api.js';
import { clientSimulator } from './data/fraudSimulator.js';
import './App.css';

const navigation = [
  ['Dashboard', '/dashboard', LayoutDashboard],
  ['Transactions', '/transactions', ArrowLeftRight],
  ['Alerts', '/alerts', ShieldAlert],
  ['Investigations', '/investigations', FolderSearch],
  ['Review Queue', '/review-queue', ClipboardCheck],
  ['Analytics', '/analytics', ChartNoAxesCombined],
  ['Settings', '/settings', Settings]
];

function Shell() {
  const [transactions, setTransactions] = useState(demoTransactions);
  const [alerts, setAlerts] = useState(demoAlerts);
  const [cases, setCases] = useState(initialCases);
  const [activity, setActivity] = useState(demoActivity);
  const [backendOnline, setBackendOnline] = useState(false);
  const [stats, setStats] = useState(null);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const transactionsRef = useRef(transactions);
  useEffect(() => {
    transactionsRef.current = transactions;
  }, [transactions]);

  const title = navigation.find(([name, path]) => location.pathname.startsWith(path))?.[0] || 'Investigation Platform';

  // Apply new transaction / alert / investigation event to state
  const applyNewEvent = (streamEvent) => {
    if (!streamEvent || !streamEvent.transaction) return;
    const { transaction, alert, investigation } = streamEvent;

    setTransactions((prev) => {
      if (prev.some((t) => t.id === transaction.id)) return prev;
      return [transaction, ...prev];
    });

    if (alert) {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === alert.id)) return prev;
        return [alert, ...prev];
      });
    }

    if (investigation) {
      setCases((prev) => {
        if (prev.some((c) => c.id === investigation.id)) return prev;
        return [investigation, ...prev];
      });
    }

    // Update real-time activity metrics for charts
    setActivity((prev) => {
      if (!prev || prev.length === 0) return prev;
      const copy = [...prev];
      const lastIndex = copy.length - 1;
      const last = copy[lastIndex];
      copy[lastIndex] = {
        ...last,
        transactions: (last.transactions || 0) + 1,
        alerts: alert ? (last.alerts || 0) + 1 : (last.alerts || 0)
      };
      return copy;
    });
  };

  // 1. Initial Load from Backend API
  useEffect(() => {
    let mounted = true;
    let lastEventTimestamp = 0;

    async function loadData() {
      try {
        const [txRes, alRes, invRes, statRes] = await Promise.all([
          fetchTransactions({ limit: 100 }),
          fetchAlerts({ limit: 50 }),
          fetchInvestigations({ limit: 50 }),
          fetchStats()
        ]);

        if (!mounted) return;

        if (txRes && txRes.data && txRes.data.length > 0) {
          setTransactions(txRes.data);
          setBackendOnline(true);
        }
        if (alRes && alRes.length > 0) {
          setAlerts(alRes);
        }
        if (invRes && invRes.length > 0) {
          setCases(invRes);
        }
        if (statRes) {
          setStats(statRes);
          if (statRes.activity && statRes.activity.length > 0) {
            setActivity(statRes.activity);
          }
        }
      } catch (err) {
        console.warn('Backend offline or initializing; using local state:', err.message);
      }
    }

    loadData();

    // 2. Real-Time SSE Stream subscription
    const unsubscribe = subscribeToLiveStream(
      (streamEvent) => {
        if (!mounted) return;
        lastEventTimestamp = Date.now();
        setBackendOnline(true);
        applyNewEvent(streamEvent);
      },
      (isOnline) => {
        if (mounted && isOnline) setBackendOnline(true);
      }
    );

    // 3. Automated Continuous Simulation Heartbeat (Runs reliably on ALL devices!)
    // When deployed on serverless environments (Vercel) where SSE streams close
    // or servers have no persistent background timers, this heartbeat ensures
    // random payments and fraud detection flow non-stop on any phone, tablet, or PC.
    const simulationInterval = setInterval(async () => {
      if (!mounted) return;

      // If an SSE event arrived recently within 3.5s, skip to avoid duplicates
      if (Date.now() - lastEventTimestamp < 3500) {
        return;
      }

      // Try generating via backend serverless API
      try {
        const serverEvent = await triggerSimulatedTx();
        if (serverEvent && serverEvent.transaction) {
          if (!mounted) return;
          lastEventTimestamp = Date.now();
          setBackendOnline(true);
          applyNewEvent(serverEvent);
          return;
        }
      } catch (err) {
        // Backend not reachable, fall through to client engine
      }

      // Resilient fallback: use client fraud detection engine
      if (!mounted) return;
      lastEventTimestamp = Date.now();
      const clientEvent = clientSimulator.generateTransaction(null, transactionsRef.current);
      applyNewEvent(clientEvent);
    }, 3800);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(simulationInterval);
    };
  }, []);

  // Save Analyst Decision to Backend DB and update React state
  const saveDecision = async (id, outcome, notes) => {
    // Optimistic local update
    setCases((old) =>
      old.map((c) =>
        c.id === id
          ? {
              ...c,
              outcome,
              notes,
              status: 'Closed',
              updated: new Date().toISOString()
            }
          : c
      )
    );

    // Persist to backend DB if reachable
    await saveAnalystDecision(id, outcome, notes);
  };

  const handleTrigger = async (type) => {
    let res = await triggerSimulatedTx(type);
    if (!res || !res.transaction) {
      // Fallback to client simulator if backend trigger is unavailable
      res = clientSimulator.generateTransaction(type, transactionsRef.current);
    }
    if (res && res.transaction) {
      applyNewEvent(res);
    }
    return res;
  };

  return (
    <div className="shell">
      <aside className={'sidebar ' + (open ? 'sidebar-open' : '')}>
        <div className="brand">
          <span className="brand-mark">
            <ShieldCheck size={23} />
          </span>
          <div>
            <strong>
              SENTINEL<span className="brand-dot">.</span>
            </strong>
            <small>FINANCIAL INTELLIGENCE</small>
          </div>
          <button className="mobile-close" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {navigation.map(([name, path, Icon]) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setOpen(false)}
              className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}
            >
              <Icon size={18} />
              {name}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" style={{ background: backendOnline ? '#25d0c2' : '#f59e0b' }} />
          {backendOnline ? 'Live Sentinel Engine' : 'Autonomous Engine'}
          <small>{backendOnline ? 'Auto-Streaming Transactions' : 'Streaming Real-Time Transactions'}</small>
        </div>
      </aside>

      {open && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setOpen(false)} />}

      <div className="main-area">
        <header className="topbar">
          <div className="top-left">
            <button className="menu-button" aria-label="Open menu" onClick={() => setOpen(true)}>
              <Menu size={22} />
            </button>
            <span className="top-location">
              Workspace <span>/</span> <b>{title}</b>
            </span>
          </div>
          <div className="top-actions">
            <span
              className="demo-pill"
              style={{
                borderColor: backendOnline ? '#25d0c2' : '#25d0c2',
                color: backendOnline ? '#25d0c2' : '#25d0c2'
              }}
            >
              ● {backendOnline ? 'LIVE SENTINEL ENGINE' : 'LIVE STREAM ACTIVE'}
            </span>
            <Bell size={19} />
            <div className="avatar" title="Lead Fraud Analyst">FA</div>
          </div>
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <Dashboard
                  cases={cases}
                  transactions={transactions}
                  alerts={alerts}
                  activity={activity}
                  isLive={true}
                />
              }
            />
            <Route
              path="/transactions"
              element={<Transactions transactions={transactions} isLive={true} />}
            />
            <Route
              path="/alerts"
              element={<Alerts alerts={alerts} isLive={true} />}
            />
            <Route
              path="/alerts/:id"
              element={<AlertDetail alerts={alerts} transactions={transactions} />}
            />
            <Route
              path="/investigations"
              element={<Investigations cases={cases} isLive={true} />}
            />
            <Route
              path="/investigations/:id"
              element={
                <CaseDetail
                  cases={cases}
                  alerts={alerts}
                  transactions={transactions}
                  onSave={saveDecision}
                />
              }
            />
            <Route
              path="/review-queue"
              element={<ReviewQueue cases={cases} isLive={true} />}
            />
            <Route
              path="/analytics"
              element={
                <Analytics
                  cases={cases}
                  alerts={alerts}
                  activity={activity}
                  isLive={true}
                />
              }
            />
            <Route
              path="/settings"
              element={
                <SettingsPage
                  backendOnline={backendOnline}
                  stats={stats}
                  onTriggerTx={handleTrigger}
                />
              }
            />
            <Route path="*" element={<div className="panel">Page not found.</div>} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
