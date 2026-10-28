import React,{useMemo,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {AreaChart,Area,BarChart,Bar,XAxis,YAxis,CartesianGrid,Tooltip,ResponsiveContainer} from 'recharts';
import {ArrowUpRight,ArrowRight,Search,Eye,AlertTriangle,ShieldAlert,CheckCircle2,Clock3,Wallet,Activity as ActivityIcon,FolderSearch,ClipboardCheck,Network,FileText,BrainCircuit,SlidersHorizontal,Zap} from 'lucide-react';
import {transactions as demoTransactions,alerts as demoAlerts,activity as demoActivity,money,when} from '../data/demoData.js';

const riskClass=s=>s==='Critical'?'critical':s==='High'?'high':s==='Medium'?'medium':'low';
const Badge=({children,kind='neutral'})=><span className={'badge '+kind}>{children}</span>;
const Heading=({eyebrow,title,subtitle,isLive=false})=><div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div><Badge kind={isLive ? "teal" : "demo"}>{isLive ? "● LIVE SENTINEL ENGINE" : "SYNTHETIC DEMO DATA"}</Badge></div>;
const Card=({label,value,icon:Icon,accent,sub})=><div className="metric"><div className="metric-top"><span>{label}</span><span className={'metric-icon '+(accent||'')}><Icon size={20}/></span></div><strong>{value}</strong><small>{sub}</small></div>;
const Empty=({message='No matching records found.'})=><div className="empty">{message}</div>;
const ChartTip=({active,payload,label})=>active&&payload?.length?<div className="chart-tooltip"><strong>{label}</strong>{payload.map(p=><div key={p.name}>{p.name}: {p.value}</div>)}</div>:null;

export function Dashboard({cases, transactions: txProp, alerts: alProp, activity: actProp, isLive}){
  const transactions = txProp || demoTransactions;
  const alerts = alProp || demoAlerts;
  const activity = actProp || demoActivity;
  const active=alerts.filter(a=>a.status!=='Closed').length;

  return <>
    <Heading isLive={isLive} eyebrow="OVERVIEW / OPERATIONS" title="Fraud Intelligence Overview" subtitle="Monitor real-time simulated financial activity and manage investigations with evidence-led review."/>
    <div className="metric-grid">
      <Card label="Transactions" value={transactions.length} icon={Wallet} sub="Total ingested records"/>
      <Card label="Active Alerts" value={active} icon={ShieldAlert} accent="red" sub="Flagged for analyst attention"/>
      <Card label="Open Investigations" value={cases.filter(c=>c.status!=='Closed').length} icon={FolderSearch} accent="blue" sub="Cases in progress"/>
      <Card label="Awaiting Review" value={cases.filter(c=>c.status==='Awaiting review').length} icon={Clock3} accent="amber" sub="Human decision required"/>
    </div>
    <div className="two-cols">
      <section className="panel chart-panel">
        <div className="panel-header"><div><h2>Transaction Activity</h2><p>Daily volume</p></div><Badge kind={isLive ? "teal" : "neutral"}>{isLive ? "LIVE" : "DEMO"}</Badge></div>
        <div className="chart-area">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activity}>
              <defs>
                <linearGradient id="fillTxn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4f8cff" stopOpacity={.35}/>
                  <stop offset="100%" stopColor="#4f8cff" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#26344b" vertical={false}/>
              <XAxis dataKey="day" stroke="#8d9db4" tickLine={false} axisLine={false}/>
              <YAxis stroke="#8d9db4" tickLine={false} axisLine={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Area dataKey="transactions" name="Transactions" stroke="#4f8cff" strokeWidth={3} fill="url(#fillTxn)"/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel chart-panel">
        <div className="panel-header"><div><h2>Alerts Over Time</h2><p>Flagged suspicious activity</p></div><Badge kind={isLive ? "teal" : "neutral"}>{isLive ? "LIVE" : "DEMO"}</Badge></div>
        <div className="chart-area">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activity}>
              <CartesianGrid stroke="#26344b" vertical={false}/>
              <XAxis dataKey="day" stroke="#8d9db4" tickLine={false} axisLine={false}/>
              <YAxis stroke="#8d9db4" tickLine={false} axisLine={false}/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="alerts" name="Alerts" fill="#25d0c2" radius={[5,5,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
    <section className="panel">
      <div className="panel-header">
        <div><h2>Recent Flagged Transactions</h2><p>Real-time heuristic fraud detection</p></div>
        <Link className="text-link" to="/transactions">View all <ArrowRight size={16}/></Link>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Transaction</th><th>From → To</th><th>Amount</th><th>Channel</th><th>Alert</th></tr></thead>
          <tbody>
            {transactions.filter(t=>t.alertId).slice(0, 8).map(t=><tr key={t.id}>
              <td><Link to="/transactions" className="id-link">{t.id}</Link></td>
              <td>{t.sender} → {t.receiver}</td>
              <td className="money">{money(t.amount)}</td>
              <td>{t.channel}</td>
              <td><Link to={'/alerts/'+t.alertId}><Badge kind="critical">Flagged</Badge></Link></td>
            </tr>)}
          </tbody>
        </table>
      </div>
    </section>
  </>;
}

export function Transactions({ transactions: txProp, isLive }){
  const transactions = txProp || demoTransactions;
  const [q,setQ]=useState(''),[status,setStatus]=useState('all'),[channel,setChannel]=useState('all'),[min,setMin]=useState(''),[max,setMax]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[sort,setSort]=useState('newest'),[selected,setSelected]=useState(null),[page,setPage]=useState(1);
  const reset=()=>setPage(1);

  const filtered=useMemo(()=>transactions.filter(t=>(t.id+' '+t.sender+' '+t.receiver).toLowerCase().includes(q.toLowerCase())&&(status==='all'||(status==='flagged')===Boolean(t.alertId))&&(channel==='all'||t.channel===channel)&&(!min||t.amount>=Number(min))&&(!max||t.amount<=Number(max))&&(!from||t.date.slice(0,10)>=from)&&(!to||t.date.slice(0,10)<=to)).sort((a,b)=>sort==='amount-desc'?b.amount-a.amount:sort==='amount-asc'?a.amount-b.amount:sort==='oldest'?a.date.localeCompare(b.date):b.date.localeCompare(a.date)),[transactions,q,status,channel,min,max,from,to,sort]);
  
  const pages=Math.max(1,Math.ceil(filtered.length/10));
  const current=Math.min(page,pages);

  return <>
    <Heading isLive={isLive} eyebrow="MONITORING / TRANSACTIONS" title="Transaction Explorer" subtitle="Search, filter and inspect live streaming transaction records."/>
    <div className="metric-grid three">
      <Card label="Total Records" value={transactions.length} icon={Wallet} sub="Ingested transfers"/>
      <Card label="Flagged" value={transactions.filter(t=>t.alertId).length} icon={ShieldAlert} accent="red" sub="Associated alerts"/>
      <Card label="Not Flagged" value={transactions.filter(t=>!t.alertId).length} icon={CheckCircle2} accent="teal" sub="Cleared legitimate"/>
    </div>
    <section className="panel">
      <div className="panel-header"><div><h2>All Transactions</h2><p>Filter by account, channel, date, amount and alert status</p></div><Badge>{filtered.length} records</Badge></div>
      <div className="filter-bar">
        <label className="search-field"><Search size={17}/><input aria-label="Search transaction or account" placeholder="Search transaction or account..." value={q} onChange={e=>{setQ(e.target.value);reset()}}/></label>
        <select aria-label="Alert filter" value={status} onChange={e=>{setStatus(e.target.value);reset()}}>
          <option value="all">All statuses</option>
          <option value="flagged">Flagged</option>
          <option value="normal">Not flagged</option>
        </select>
        <select aria-label="Channel filter" value={channel} onChange={e=>{setChannel(e.target.value);reset()}}>
          <option value="all">All channels</option>
          {['UPI','IMPS','NEFT','RTGS'].map(c=><option key={c}>{c}</option>)}
        </select>
        <select aria-label="Sort transactions" value={sort} onChange={e=>{setSort(e.target.value);reset()}}>
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="amount-desc">Amount: high to low</option>
          <option value="amount-asc">Amount: low to high</option>
        </select>
      </div>
      <div className="filter-bar secondary">
        <label>Min amount<input type="number" min="0" value={min} onChange={e=>{setMin(e.target.value);reset()}}/></label>
        <label>Max amount<input type="number" min="0" value={max} onChange={e=>{setMax(e.target.value);reset()}}/></label>
        <label>From<input type="date" value={from} onChange={e=>{setFrom(e.target.value);reset()}}/></label>
        <label>To<input type="date" value={to} onChange={e=>{setTo(e.target.value);reset()}}/></label>
        <button className="button ghost" onClick={()=>{setQ('');setStatus('all');setChannel('all');setMin('');setMax('');setFrom('');setTo('');setSort('newest');reset()}}>Clear filters</button>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Transaction ID</th><th>Sender</th><th>Receiver</th><th>Amount</th><th>Timestamp (IST)</th><th>Channel</th><th>Alert</th><th>Action</th></tr></thead>
          <tbody>
            {filtered.slice((current-1)*10,current*10).map(t=><tr key={t.id}>
              <td className="id-link">{t.id}</td>
              <td>{t.sender}</td>
              <td>{t.receiver}</td>
              <td className="money">{money(t.amount)}</td>
              <td>{when(t.date)}</td>
              <td>{t.channel}</td>
              <td><Badge kind={t.alertId?'critical':'teal'}>{t.alertId?'Flagged':'Not flagged'}</Badge></td>
              <td><button className="table-action" onClick={()=>setSelected(t)}><Eye size={15}/> View</button></td>
            </tr>)}
          </tbody>
        </table>
        {filtered.length===0&&<Empty/>}
      </div>
      <div className="pagination">
        <span>Showing {filtered.length?((current-1)*10+1):0}–{Math.min(current*10,filtered.length)} of {filtered.length}</span>
        <div>
          <button disabled={current===1} onClick={()=>setPage(current-1)}>Previous</button>
          <span>{current} / {pages}</span>
          <button disabled={current===pages} onClick={()=>setPage(current+1)}>Next</button>
        </div>
      </div>
    </section>

    {selected&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setSelected(null)}}>
      <section className="modal" role="dialog" aria-modal="true" aria-label="Transaction details">
        <div className="panel-header"><h2>Transaction Details</h2><button className="icon-button" onClick={()=>setSelected(null)} aria-label="Close">✕</button></div>
        {[['ID',selected.id],['Sender',selected.sender],['Receiver',selected.receiver],['Amount',money(selected.amount)],['Time (IST)',when(selected.date)],['Channel',selected.channel],['Alert',selected.alertId||'None']].map(([k,v])=><div className="detail-line" key={k}><span>{k}</span><strong>{v}</strong></div>)}
        <p className="note">An alert indicates an automated heuristic review is needed, not a confirmed fraud determination.</p>
        {selected.alertId&&<Link className="button primary" to={'/alerts/'+selected.alertId}>Open related alert <ArrowUpRight size={16}/></Link>}
      </section>
    </div>}
  </>;
}

export function Alerts({ alerts: alProp, isLive }){
  const alerts = alProp || demoAlerts;
  const [q,setQ]=useState(''),[severity,setSeverity]=useState('all'),[sort,setSort]=useState('newest');
  const list=alerts.filter(a=>(a.id+' '+(a.transactionId||'')+' '+(a.reason||'')).toLowerCase().includes(q.toLowerCase())&&(severity==='all'||a.severity===severity)).sort((a,b)=>sort==='score'?b.score-a.score:(b.created||'').localeCompare(a.created||''));

  return <>
    <Heading isLive={isLive} eyebrow="MONITORING / ALERTS" title="Detection Alerts" subtitle="Review algorithmic rule-triggered activity with real-time risk scoring."/>
    <section className="panel">
      <div className="panel-header"><h2>Alert Registry</h2><Badge>{list.length} alerts</Badge></div>
      <div className="filter-bar">
        <label className="search-field"><Search size={17}/><input aria-label="Search alerts" placeholder="Search alerts or transactions" value={q} onChange={e=>setQ(e.target.value)}/></label>
        <select aria-label="Severity" value={severity} onChange={e=>setSeverity(e.target.value)}>
          <option value="all">All severity</option>
          {['Critical','High','Medium'].map(s=><option key={s}>{s}</option>)}
        </select>
        <select aria-label="Sort alerts" value={sort} onChange={e=>setSort(e.target.value)}>
          <option value="newest">Newest first</option>
          <option value="score">Highest score</option>
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Alert</th><th>Transaction</th><th>Risk Score</th><th>Severity</th><th>Detection Reason</th><th>Review Status</th><th></th></tr></thead>
          <tbody>
            {list.map(a=><tr key={a.id}>
              <td className="id-link">{a.id}</td>
              <td>{a.transactionId}</td>
              <td><strong>{a.score || a.risk_score}/100</strong></td>
              <td><Badge kind={riskClass(a.severity)}>{a.severity}</Badge></td>
              <td className="reason-cell">{a.reason}</td>
              <td><Badge>{a.status}</Badge></td>
              <td><Link className="table-action" to={'/alerts/'+a.id}>Details <ArrowRight size={15}/></Link></td>
            </tr>)}
          </tbody>
        </table>
        {!list.length&&<Empty/>}
      </div>
    </section>
  </>;
}

export function AlertDetail({ alerts: alProp, transactions: txProp }){
  const {id}=useParams();
  const alerts = alProp || demoAlerts;
  const transactions = txProp || demoTransactions;
  const a=alerts.find(a=>a.id===id || a.alert_ref===id || a.db_id===id);
  if(!a)return <Empty message="Alert not found"/>;
  const t=transactions.find(t=>t.id===a.transactionId || t.alertId===a.id || t.db_id===a.transaction_id);

  return <>
    <Heading eyebrow={'ALERTS / '+id} title={'Alert '+id} subtitle="Detection explanation and associated transaction"/>
    <div className="two-cols">
      <section className="panel padded">
        <h2>Alert Summary</h2>
        <div className="detail-line"><span>Risk score</span><strong>{(a.score || a.risk_score)}/100</strong></div>
        <div className="detail-line"><span>Severity</span><Badge kind={riskClass(a.severity)}>{a.severity}</Badge></div>
        <div className="detail-line"><span>Status</span><strong>{a.status}</strong></div>
        <div className="detail-line"><span>Created (IST)</span><strong>{when(a.created || a.created_at)}</strong></div>
        <h3>Triggered Rule Explanation</h3>
        <p>{a.reason}</p>
        <p className="note">Risk scores are heuristic assessment indicators for prioritized human review.</p>
      </section>
      <section className="panel padded">
        <h2>Related Transaction</h2>
        {t&&[['Transaction',t.id],['Sender',t.sender],['Receiver',t.receiver],['Amount',money(t.amount)],['Channel',t.channel],['Time',when(t.date)]].map(([k,v])=><div className="detail-line" key={k}><span>{k}</span><strong>{v}</strong></div>)}
        <Link className="button primary" style={{marginTop:'1.5rem'}} to="/investigations">View investigations <ArrowRight size={16}/></Link>
      </section>
    </div>
  </>;
}

export function Investigations({cases, isLive}){
  const [q,setQ]=useState(''),[filter,setFilter]=useState('all');
  const list=cases.filter(c=>(c.id+' '+(c.alertId||'')+' '+(c.analyst||'')).toLowerCase().includes(q.toLowerCase())&&(filter==='all'||c.status===filter));

  return <>
    <Heading isLive={isLive} eyebrow="CASE MANAGEMENT" title="Investigations" subtitle="Track cases from automated detection through human analyst review."/>
    <section className="panel">
      <div className="panel-header"><h2>Case Workspace</h2><Badge>{list.length} cases</Badge></div>
      <div className="filter-bar">
        <label className="search-field"><Search size={17}/><input aria-label="Search cases" placeholder="Search case, alert or analyst" value={q} onChange={e=>setQ(e.target.value)}/></label>
        <select aria-label="Case status" value={filter} onChange={e=>setFilter(e.target.value)}>
          <option value="all">All statuses</option>
          {['Open','Investigating','Awaiting review','Closed'].map(s=><option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="table-scroll">
        <table>
          <thead><tr><th>Case ID</th><th>Alert</th><th>Priority</th><th>Status</th><th>Assigned</th><th>Last Updated</th><th></th></tr></thead>
          <tbody>
            {list.map(c=><tr key={c.id}>
              <td className="id-link">{c.id}</td>
              <td>{c.alertId}</td>
              <td><Badge kind={riskClass(c.priority)}>{c.priority}</Badge></td>
              <td><Badge kind={c.status==='Closed'?'teal':'neutral'}>{c.status}</Badge></td>
              <td>{c.analyst}</td>
              <td>{when(c.updated || c.created)}</td>
              <td><Link className="table-action" to={'/investigations/'+c.id}>Open case <ArrowRight size={15}/></Link></td>
            </tr>)}
          </tbody>
        </table>
        {!list.length&&<Empty/>}
      </div>
    </section>
  </>;
}

export function CaseDetail({cases, alerts: alProp, transactions: txProp, onSave}){
  const {id}=useParams();
  const alerts = alProp || demoAlerts;
  const transactions = txProp || demoTransactions;
  const c=cases.find(c=>c.id===id || c.db_id===id);
  const [outcome,setOutcome]=useState('confirmed_fraud'),[notes,setNotes]=useState(''),[confirm,setConfirm]=useState(false);

  if(!c)return <Empty message="Case not found"/>;
  const alert=alerts.find(a=>a.id===c.alertId || a.alert_ref===c.alertId || a.db_id===c.alert_id);
  const related=transactions.filter(t=>t.alertId===c.alertId || (c.evidence&&c.evidence.some(e=>e.includes(t.id))));

  return <>
    <Heading eyebrow={'INVESTIGATIONS / '+id} title={'Investigation '+id} subtitle="Evidence-based case review and analyst decision"/>
    <div className="metric-grid three">
      <Card label="Priority" value={c.priority} icon={ShieldAlert} accent="red" sub="Assigned case priority"/>
      <Card label="Status" value={c.status} icon={ActivityIcon} accent="blue" sub="Current case stage"/>
      <Card label="Risk Score" value={alert?(alert.score||alert.risk_score)+'/100':'N/A'} icon={AlertTriangle} accent="amber" sub="Calculated risk score"/>
    </div>
    <div className="two-cols">
      <section className="panel padded">
        <h2>Case Overview</h2>
        {[['Case ID',c.id],['Related Alert',c.alertId],['Assigned Analyst',c.analyst],['Created',when(c.created)],['Updated',when(c.updated||c.created)]].map(([k,v])=><div className="detail-line" key={k}><span>{k}</span><strong>{v}</strong></div>)}
        <h3>Connected Accounts</h3>
        <div className="account-flow">
          {[...new Set(related.flatMap(t=>[t.sender,t.receiver]))].map(a=><span key={a}>{a}</span>)}
        </div>
      </section>
      <section className="panel padded">
        <h2><FileText size={19}/> Supporting Evidence</h2>
        {c.evidence&&c.evidence.map((e,i)=><div className="evidence" key={i}>
          <span className="evidence-number">{i+1}</span>
          <div><strong>Observed system record</strong><p>{e}</p></div>
        </div>)}
      </section>
      <section className="panel padded">
        <h2><BrainCircuit size={19}/> Investigation Summary</h2>
        {(c.summary || c.ai_summary)?<>
          <Badge kind="teal">AUTOMATED REPORT</Badge>
          <div className="summary-text" style={{whiteSpace:'pre-line',fontSize:'0.88rem',lineHeight:'1.5'}}>{c.summary || c.ai_summary}</div>
        </>:<Empty message="No investigation summary available."/>}
      </section>
      <section className="panel padded">
        <h2><ClipboardCheck size={19}/> Analyst Decision</h2>
        {c.outcome?<>
          <Badge kind="teal">Decision Saved to Database</Badge>
          <p className="summary-text">Outcome: <strong>{c.outcome.replace('_',' ').toUpperCase()}</strong></p>
          {c.notes&&<p>Notes: {c.notes}</p>}
        </>:<>
          <label className="form-label">Decision
            <select value={outcome} onChange={e=>setOutcome(e.target.value)}>
              <option value="confirmed_fraud">Confirmed fraud</option>
              <option value="legitimate">Legitimate</option>
              <option value="inconclusive">Inconclusive</option>
            </select>
          </label>
          <label className="form-label">Reviewer notes
            <textarea rows="4" placeholder="Explain your decision using the available evidence..." value={notes} onChange={e=>setNotes(e.target.value)}/>
          </label>
          <button className="button primary" disabled={!notes.trim()} onClick={()=>setConfirm(true)}>Record decision</button>
        </>}
      </section>
    </div>

    {confirm&&<div className="modal-backdrop">
      <section className="modal" role="dialog" aria-modal="true" aria-label="Confirm decision">
        <h2>Confirm analyst decision</h2>
        <p>Record <strong>{outcome.replace('_',' ')}</strong> for {c.id}? This will persist the decision and close the investigation.</p>
        <div className="modal-actions">
          <button className="button ghost" onClick={()=>setConfirm(false)}>Cancel</button>
          <button className="button primary" onClick={()=>{onSave(c.id,outcome,notes);setConfirm(false)}}>Confirm and save</button>
        </div>
      </section>
    </div>}
  </>;
}

export function ReviewQueue({cases, isLive}){
  const [priority,setPriority]=useState('all');
  const list=cases.filter(c=>c.status==='Awaiting review'&&(priority==='all'||c.priority===priority));

  return <>
    <Heading isLive={isLive} eyebrow="HUMAN REVIEW" title="Review Queue" subtitle="Investigations awaiting an analyst's evidence-based decision."/>
    <section className="panel">
      <div className="panel-header">
        <h2>Awaiting Review</h2>
        <select aria-label="Priority filter" value={priority} onChange={e=>setPriority(e.target.value)}>
          <option value="all">All priorities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
        </select>
      </div>
      {list.map(c=><div className="queue-item" key={c.id}>
        <div>
          <div className="queue-title"><strong>{c.id}</strong><Badge kind={riskClass(c.priority)}>{c.priority}</Badge></div>
          <p>{c.evidence?.[0] || 'Investigation pending review.'}</p>
          <small>Created {when(c.created)} · Alert {c.alertId}</small>
        </div>
        <Link className="button primary" to={'/investigations/'+c.id}>Review case <ArrowRight size={16}/></Link>
      </div>)}
      {!list.length&&<Empty message="No cases currently await review."/>}
    </section>
  </>;
}

export function Analytics({cases, alerts: alProp, activity: actProp, isLive}){
  const alerts = alProp || demoAlerts;
  const activity = actProp || demoActivity;
  const confirmed=cases.filter(c=>c.outcome==='confirmed_fraud').length;
  const legitimate=cases.filter(c=>c.outcome==='legitimate').length;
  const inconclusive=cases.filter(c=>c.outcome==='inconclusive').length;

  return <>
    <Heading isLive={isLive} eyebrow="INSIGHTS / ANALYTICS" title="Investigation Analytics" subtitle="Operational metrics and volume analytics."/>
    <div className="metric-grid">
      <Card label="Total Alerts" value={alerts.length} icon={ShieldAlert} sub="Algorithmic flags"/>
      <Card label="Confirmed Fraud" value={confirmed} icon={AlertTriangle} accent="red" sub="Analyst determinations"/>
      <Card label="Legitimate" value={legitimate} icon={CheckCircle2} accent="teal" sub="Analyst determinations"/>
      <Card label="Inconclusive" value={inconclusive} icon={Clock3} accent="amber" sub="Analyst determinations"/>
    </div>
    <div className="two-cols">
      <section className="panel chart-panel">
        <div className="panel-header"><h2>Alert Volume</h2></div>
        <div className="chart-area">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activity}>
              <CartesianGrid stroke="#26344b" vertical={false}/>
              <XAxis dataKey="day" stroke="#8d9db4"/>
              <YAxis stroke="#8d9db4"/>
              <Tooltip content={<ChartTip/>}/>
              <Bar dataKey="alerts" fill="#4f8cff" radius={[5,5,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="panel padded">
        <h2>Evaluation Metrics</h2>
        <div className="detail-line"><span>Detection engine</span><strong>Multi-Indicator Real-time Heuristic</strong></div>
        <div className="detail-line"><span>Automated Simulator</span><strong>Active (Continuous Streaming)</strong></div>
        <div className="detail-line"><span>Active Investigation Queue</span><strong>{cases.filter(c=>c.status!=='Closed').length} cases</strong></div>
        <div className="detail-line"><span>Decisions Recorded</span><strong>{confirmed + legitimate + inconclusive} cases</strong></div>
      </section>
    </div>
  </>;
}

export function SettingsPage({ backendOnline, stats, onTriggerTx }){
  const [triggering, setTriggering] = useState(false);
  const [lastMsg, setLastMsg] = useState(null);

  const handleTrigger = async (type) => {
    setTriggering(true);
    if (onTriggerTx) {
      const res = await onTriggerTx(type);
      setLastMsg(res ? `Generated ${res.transaction?.id} (Risk: ${res.evaluation?.risk_score}/100, ${res.evaluation?.is_fraud ? '🚨 FLAGGED' : '✓ OK'})` : 'Trigger failed');
    }
    setTriggering(false);
  };

  return <>
    <Heading eyebrow="SYSTEM / CONFIGURATION" title="System Status" subtitle="Sentinel Backend & Detection Engine Status." isLive={backendOnline}/>
    <section className="panel padded settings-panel">
      <h2>Environment & Integration</h2>
      <div className="detail-line">
        <span>Backend API Status</span>
        <Badge kind={backendOnline ? "teal" : "demo"}>{backendOnline ? "Online (Connected on port 3000)" : "Offline (Using demo data)"}</Badge>
      </div>
      <div className="detail-line">
        <span>Supabase Integration</span>
        <Badge kind={backendOnline ? "teal" : "neutral"}>{backendOnline ? "Connected & Synchronized" : "Standby"}</Badge>
      </div>
      <div className="detail-line">
        <span>Automatic Transaction Simulator</span>
        <Badge kind={backendOnline ? "teal" : "neutral"}>{backendOnline ? "Running (Streaming every 4s)" : "Paused"}</Badge>
      </div>
      <div className="detail-line">
        <span>Real-time Stream (SSE)</span>
        <Badge kind={backendOnline ? "teal" : "neutral"}>{backendOnline ? "Active" : "Not connected"}</Badge>
      </div>

      <h3 style={{marginTop:'2rem'}}>Live Transaction Trigger Test</h3>
      <p>Inject specific simulated transactions into the live detection pipeline on demand:</p>
      <div style={{display:'flex',gap:'0.75rem',marginTop:'1rem',flexWrap:'wrap'}}>
        <button className="button primary" disabled={triggering} onClick={()=>handleTrigger('normal')}>
          <Zap size={15}/> Normal UPI (₹1,500)
        </button>
        <button className="button primary" style={{background:'#e05656'}} disabled={triggering} onClick={()=>handleTrigger('high_value')}>
          <AlertTriangle size={15}/> High Value Spike (₹3.5L)
        </button>
        <button className="button primary" style={{background:'#c2410c'}} disabled={triggering} onClick={()=>handleTrigger('mule')}>
          <Network size={15}/> Money Mule Chain (Layering)
        </button>
      </div>
      {lastMsg && <p style={{marginTop:'1rem',color:'#25d0c2',fontWeight:'bold'}}>{lastMsg}</p>}
    </section>
  </>;
}
