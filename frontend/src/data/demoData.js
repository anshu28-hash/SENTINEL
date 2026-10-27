// All records are fictional and exist only in demo mode.
export const transactions = [
 {id:'TXN-1048',sender:'ACC-0018',receiver:'ACC-0921',amount:248000,channel:'IMPS',date:'2026-10-27T11:24:00+05:30',alertId:'ALT-001'},
 {id:'TXN-1047',sender:'ACC-0921',receiver:'ACC-0420',amount:241000,channel:'UPI',date:'2026-10-27T11:27:00+05:30',alertId:'ALT-002'},
 {id:'TXN-1046',sender:'ACC-0311',receiver:'ACC-0814',amount:5400,channel:'UPI',date:'2026-10-27T10:48:00+05:30',alertId:null},
 {id:'TXN-1045',sender:'ACC-0502',receiver:'ACC-0731',amount:180000,channel:'NEFT',date:'2026-10-26T18:10:00+05:30',alertId:'ALT-003'},
 {id:'TXN-1044',sender:'ACC-0814',receiver:'ACC-0502',amount:12000,channel:'UPI',date:'2026-10-26T14:02:00+05:30',alertId:null},
 {id:'TXN-1043',sender:'ACC-0120',receiver:'ACC-0351',amount:97000,channel:'RTGS',date:'2026-10-25T16:40:00+05:30',alertId:'ALT-004'},
 {id:'TXN-1042',sender:'ACC-0120',receiver:'ACC-0311',amount:3500,channel:'UPI',date:'2026-10-25T12:20:00+05:30',alertId:null},
 {id:'TXN-1041',sender:'ACC-0311',receiver:'ACC-0351',amount:45000,channel:'NEFT',date:'2026-10-24T09:11:00+05:30',alertId:null}
];
export const alerts = [
 {id:'ALT-001',transactionId:'TXN-1048',score:92,severity:'Critical',status:'Under review',reason:'Multiple high-value transfers within a short time window.',created:'2026-10-27T11:25:00+05:30'},
 {id:'ALT-002',transactionId:'TXN-1047',score:86,severity:'High',status:'Open',reason:'Rapid onward transfer after receipt of funds.',created:'2026-10-27T11:28:00+05:30'},
 {id:'ALT-003',transactionId:'TXN-1045',score:74,severity:'High',status:'Open',reason:'Unusually large transfer relative to simulated account history.',created:'2026-10-26T18:12:00+05:30'},
 {id:'ALT-004',transactionId:'TXN-1043',score:61,severity:'Medium',status:'Closed',reason:'Transfer pattern triggered a velocity monitoring rule.',created:'2026-10-25T16:42:00+05:30'}
];
export const initialCases = [
 {id:'CASE-001',alertId:'ALT-001',priority:'Critical',status:'Awaiting review',analyst:'Analyst A',created:'2026-10-27T11:32:00+05:30',updated:'2026-10-27T12:10:00+05:30',evidence:['TXN-1048 transferred ₹2,48,000 from ACC-0018 to ACC-0921.','TXN-1047 transferred ₹2,41,000 from ACC-0921 to ACC-0420 three minutes later.'],summary:'Demo interpretation: a rapid sequence of transfers may warrant closer examination. The transfers alone do not establish fraud.',outcome:null},
 {id:'CASE-002',alertId:'ALT-003',priority:'High',status:'Investigating',analyst:'Analyst B',created:'2026-10-26T18:20:00+05:30',updated:'2026-10-27T09:00:00+05:30',evidence:['TXN-1045 transferred ₹1,80,000 from ACC-0502 to ACC-0731.'],summary:null,outcome:null},
 {id:'CASE-003',alertId:'ALT-004',priority:'Medium',status:'Closed',analyst:'Analyst A',created:'2026-10-25T17:00:00+05:30',updated:'2026-10-26T10:30:00+05:30',evidence:['TXN-1043 transferred ₹97,000 from ACC-0120 to ACC-0351.'],summary:'Demo interpretation: activity was reviewed.',outcome:'legitimate'}
];
export const activity = [
 {day:'22 Oct',transactions:20,alerts:2},{day:'23 Oct',transactions:29,alerts:4},{day:'24 Oct',transactions:25,alerts:3},{day:'25 Oct',transactions:42,alerts:7},{day:'26 Oct',transactions:38,alerts:5},{day:'27 Oct',transactions:51,alerts:9}
];
export const money = (n)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
export const when = (d)=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(d));
