import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

const AIRPORTS = { Brussels:{km:95,earned:90.58}, Charleroi:{km:226,earned:145.18}, Eindhoven:{km:170,earned:140} };
const FUEL_PER_KM = 0.111408;
const RATE_CHANGE_DATE = new Date("2025-09-01");

function fmtDate(d) {
  const date = new Date(d);
  const weekday = date.toLocaleDateString("en-GB",{weekday:"long"});
  const day = String(date.getDate()).padStart(2,"0");
  const month = String(date.getMonth()+1).padStart(2,"0");
  const year = date.getFullYear();
  return `${weekday} - ${day}/${month}/${year}`;
}
function fmtEuro(n) { return "€"+Number(n).toFixed(2); }
function rateForDate(d) { return d && new Date(d)>=RATE_CHANGE_DATE?20:15; }
function today() { return new Date().toISOString().split("T")[0]; }

async function loadCol(name) { const s=await getDocs(collection(db,name)); return s.docs.map(d=>({id:d.id,...d.data()})); }
async function addItem(col,data) { const r=await addDoc(collection(db,col),data); return {id:r.id,...data}; }
async function updateItem(col,id,data) { await updateDoc(doc(db,col,id),data); }
async function deleteItem_db(col,id) { await deleteDoc(doc(db,col,id)); }

const DogSVG=({size=32,style={}})=>(<svg width={size} height={size} viewBox="0 0 64 64" style={style}><ellipse cx="32" cy="40" rx="16" ry="13" fill="#3d2545"/><ellipse cx="32" cy="26" rx="13" ry="12" fill="#3d2545"/><ellipse cx="21" cy="18" rx="6" ry="9" fill="#3d2545" transform="rotate(-15 21 18)"/><ellipse cx="43" cy="18" rx="6" ry="9" fill="#3d2545" transform="rotate(15 43 18)"/><circle cx="27" cy="25" r="2.5" fill="#3a2a2a"/><circle cx="37" cy="25" r="2.5" fill="#3a2a2a"/><circle cx="27.8" cy="24.2" r=".9" fill="white"/><circle cx="37.8" cy="24.2" r=".9" fill="white"/><ellipse cx="32" cy="30" rx="4" ry="3" fill="#e88ba0"/><path d="M30 31 Q32 33.5 34 31" stroke="#c9607a" strokeWidth="1.2" fill="none" strokeLinecap="round"/><ellipse cx="32" cy="46" rx="7" ry="5" fill="#3d2545"/><ellipse cx="20" cy="50" rx="5" ry="3.5" fill="#3d2545"/><ellipse cx="44" cy="50" rx="5" ry="3.5" fill="#3d2545"/><path d="M38 47 Q45 43 50 46" stroke="#3d2545" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>);

export default function App() {
  const [sessions,setSessions]=useState([]);
  const [airports,setAirports]=useState([]);
  const [payments,setPayments]=useState([]);
  const [activities,setActivities]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("hours");
  const [showHistory,setShowHistory]=useState(false);
  const [editingSession,setEditingSession]=useState(null);
  const [editingAirport,setEditingAirport]=useState(null);
  const [editingPayment,setEditingPayment]=useState(null);
  const [editingActivity,setEditingActivity]=useState(null);
  const [quickLog,setQuickLog]=useState(null);
  const [showFeedback,setShowFeedback]=useState(false);
  const [feedbackNotes,setFeedbackNotes]=useState([]);
  const [toast,setToast]=useState(null);
  function showToast(msg,color="#5db887"){setToast({msg,color});setTimeout(()=>setToast(null),2500);}

  const [newSession,setNewSession]=useState({date:today(),startTime:"",endTime:"",parking:0,other:0});
  const [newAirport,setNewAirport]=useState({date:today(),airport:"Brussels",parking:0});
  const [newPayment,setNewPayment]=useState({date:today(),amount:""});
  const [newActivity,setNewActivity]=useState({description:"",amount:"",excludeFromOwed:false,dateFrom:"",dateTo:""});

  useEffect(()=>{
    async function load(){
      try{
        const[s,a,p,act]=await Promise.all([loadCol("sessions"),loadCol("airports"),loadCol("payments"),loadCol("activities")]);
        setSessions(s.sort((a,b)=>a.date.localeCompare(b.date)));
        setAirports(a.sort((a,b)=>a.date.localeCompare(b.date)));
        setPayments(p.sort((a,b)=>a.date.localeCompare(b.date)));
        setActivities(act.sort((a,b)=>(a.dateFrom||"").localeCompare(b.dateFrom||"")));
      }catch(e){console.error(e);}
      setLoading(false);
    }
    load();
  },[]);

  // All activities in totalEarned
  const totalEarned=sessions.reduce((s,x)=>s+x.earned,0)+airports.reduce((s,x)=>s+x.earned,0)+activities.reduce((s,x)=>s+(x.amount||0),0);
  const totalExpenses=sessions.reduce((s,x)=>s+(x.gas||0)+(x.parking||0)+(x.other||0),0)+airports.reduce((s,x)=>s+(x.gas||0)+(x.parking||0),0);
  const totalPaid=payments.reduce((s,x)=>s+x.amount,0);
  // balance only counts non-excluded activities
  const balanceEarned=sessions.reduce((s,x)=>s+x.earned,0)+airports.reduce((s,x)=>s+x.earned,0)+activities.filter(a=>!a.excludeFromOwed).reduce((s,x)=>s+(x.amount||0),0);
  const balance=balanceEarned+totalExpenses-totalPaid;

  async function addSession(){
    const[sh,sm]=newSession.startTime.split(":").map(Number);
    const[eh,em]=newSession.endTime.split(":").map(Number);
    const hrs=((eh*60+em)-(sh*60+sm))/60;
    if(hrs<=0)return;
    const rate=rateForDate(newSession.date);
    const data={date:newSession.date,startTime:newSession.startTime,endTime:newSession.endTime,hours:+hrs.toFixed(4),km:0,gas:0,parking:+newSession.parking,other:+newSession.other,earned:+(hrs*rate).toFixed(4),rate};
    const item=await addItem("sessions",data);
    setSessions(prev=>[...prev,item].sort((a,b)=>a.date.localeCompare(b.date)));
    setNewSession({date:today(),startTime:"",endTime:"",parking:0,other:0});
    showToast("✅ Session added!");
  }
  async function saveEdit(updated){const{id,...data}=updated;await updateItem("sessions",id,data);setSessions(prev=>prev.map(x=>x.id===id?updated:x).sort((a,b)=>a.date.localeCompare(b.date)));setEditingSession(null);}

  async function addAirport(){
    const info=AIRPORTS[newAirport.airport]||AIRPORTS.Brussels;
    const data={date:newAirport.date,airport:newAirport.airport,parking:+newAirport.parking,gas:+(info.km*FUEL_PER_KM).toFixed(4),earned:info.earned};
    const item=await addItem("airports",data);
    setAirports(prev=>[...prev,item].sort((a,b)=>a.date.localeCompare(b.date)));
    setNewAirport(p=>({...p,date:today(),parking:0}));
    showToast("✅ Airport trip added!");
  }
  async function saveAirportEdit(updated){const{id,...data}=updated;await updateItem("airports",id,data);setAirports(prev=>prev.map(x=>x.id===id?updated:x).sort((a,b)=>a.date.localeCompare(b.date)));setEditingAirport(null);}

  async function addPayment(){
    if(!newPayment.amount)return;
    const data={date:newPayment.date,amount:+newPayment.amount};
    const item=await addItem("payments",data);
    setPayments(prev=>[...prev,item].sort((a,b)=>a.date.localeCompare(b.date)));
    setNewPayment(p=>({...p,date:today(),amount:""}));
    showToast("✅ Payment added!","#6b48d4");
  }
  async function savePaymentEdit(updated){
    const{id,...data}=updated;
    await updateItem("payments",id,data);
    setPayments(prev=>prev.map(x=>x.id===id?updated:x).sort((a,b)=>a.date.localeCompare(b.date)));
    setEditingPayment(null);
  }

  async function addActivity(){
    if(!newActivity.description||!newActivity.amount)return;
    const data={description:newActivity.description,amount:+newActivity.amount,excludeFromOwed:!!newActivity.excludeFromOwed,dateFrom:newActivity.dateFrom||"",dateTo:newActivity.dateTo||""};
    const item=await addItem("activities",data);
    setActivities(prev=>[...prev,item].sort((a,b)=>(a.dateFrom||"").localeCompare(b.dateFrom||"")));
    setNewActivity({description:"",amount:"",excludeFromOwed:false,dateFrom:"",dateTo:""});
    showToast("✅ Activity added!","#a78bfa");
  }
  async function saveActivityEdit(updated){
    const{id,...data}=updated;
    await updateItem("activities",id,data);
    setActivities(prev=>prev.map(x=>x.id===id?updated:x));
    setEditingActivity(null);
  }

  async function deleteItem(type,id){
    const col=type==="session"?"sessions":type==="airport"?"airports":type==="payment"?"payments":"activities";
    await deleteItem_db(col,id);
    if(type==="session")setSessions(p=>p.filter(x=>x.id!==id));
    if(type==="airport")setAirports(p=>p.filter(x=>x.id!==id));
    if(type==="payment")setPayments(p=>p.filter(x=>x.id!==id));
    if(type==="activity")setActivities(p=>p.filter(x=>x.id!==id));
  }

  const recentSessions=[...sessions].reverse().slice(0,10);
  const recentAirports=[...airports].reverse().slice(0,10);
  const allPayments=[...payments].reverse();

  // Tabs: Hours first, then Summary, Payment, Airport, Activity, Analytics
  const tabs=[["hours","⏰"],["dashboard","📋"],["payment","💰"],["services","✈️"],["analytics","📊"]];
  const tabLabels={hours:"Hours",dashboard:"Summary",payment:"Payment",services:"Services",analytics:"Analytics"};

  if(loading)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#12121a",flexDirection:"column",gap:16}}>
      <DogSVG size={64} style={{animation:"spin 2s linear infinite"}}/>
      <p style={{color:"#6b6b80",fontFamily:"DM Sans,sans-serif",fontSize:15}}>Loading... 🐾</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return(
    <div style={S.root}>
      <DogSVG size={30} style={{position:"fixed",top:10,right:10,opacity:0.15,transform:"rotate(10deg)",pointerEvents:"none"}}/>

      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <img src="/dog.png" alt="dog" style={{width:42,height:42,borderRadius:"50%",objectFit:"cover",objectPosition:"center top",border:"2px solid #fce7f0"}}/>
            <div style={S.logo}>Yarden 🐾</div>
          </div>
          {/* Quick action buttons in header */}
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button style={S.headerActionBtn} onClick={()=>setQuickLog("hours")} title="Log hours">⏰ Log Hours</button>
            <button style={{...S.headerActionBtn,background:"#1e1a2e",color:"#a78bfa"}} onClick={()=>setQuickLog("payment")} title="Log payment">💰 Payment</button>
          </div>
        </div>
      </header>

      <main style={S.main}>
        {tab==="dashboard"&&<Dashboard sessions={sessions} airports={airports} payments={payments} activities={activities} totalEarned={totalEarned} totalExpenses={totalExpenses} totalPaid={totalPaid} balance={balance} recentSessions={recentSessions} recentAirports={recentAirports} allPayments={allPayments} showHistory={showHistory} setShowHistory={setShowHistory} deleteItem={deleteItem} setEditingSession={setEditingSession} setEditingAirport={setEditingAirport} setEditingPayment={setEditingPayment} setEditingActivity={setEditingActivity}/>}
        {tab==="hours"&&<LogHours newSession={newSession} setNewSession={setNewSession} addSession={addSession} recentSessions={recentSessions} allSessions={sessions} deleteItem={deleteItem} setEditingSession={setEditingSession}/>}
        {tab==="payment"&&<LogPayment newPayment={newPayment} setNewPayment={setNewPayment} addPayment={addPayment} allPayments={allPayments} deleteItem={deleteItem} setEditingPayment={setEditingPayment}/>}
        {tab==="services"&&<LogServices newAirport={newAirport} setNewAirport={setNewAirport} addAirport={addAirport} recentAirports={recentAirports} allAirports={airports} deleteItem={deleteItem} setEditingAirport={setEditingAirport} newActivity={newActivity} setNewActivity={setNewActivity} addActivity={addActivity} activities={activities} setEditingActivity={setEditingActivity}/>}
        {tab==="analytics"&&<Analytics sessions={sessions} airports={airports} payments={payments} activities={activities} totalEarned={totalEarned} totalExpenses={totalExpenses} totalPaid={totalPaid}/>}
      </main>

      <nav style={S.bottomNav}>
        {tabs.map(([id,icon])=>(
          <button key={id} style={{...S.bottomNavBtn,...(tab===id?S.bottomNavActive:{})}} onClick={()=>setTab(id)}>
            <span style={{fontSize:18}}>{icon}</span>
            <span style={{fontSize:9,fontWeight:600}}>{tabLabels[id]}</span>
          </button>
        ))}
      </nav>

      {/* Quick log modals */}
      {quickLog==="hours"&&<QuickLogHours newSession={newSession} setNewSession={setNewSession} addSession={async()=>{await addSession();setQuickLog(null);}} onClose={()=>setQuickLog(null)}/>}
      {quickLog==="payment"&&<QuickLogPayment newPayment={newPayment} setNewPayment={setNewPayment} addPayment={async()=>{await addPayment();setQuickLog(null);}} onClose={()=>setQuickLog(null)}/>}

      {toast&&(
        <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:toast.color,color:"white",padding:"10px 22px",borderRadius:20,fontWeight:700,fontSize:14,zIndex:2000,boxShadow:"0 4px 20px rgba(0,0,0,0.2)",whiteSpace:"nowrap",animation:"fadein .2s ease"}}>
          {toast.msg}
        </div>
      )}
      <style>{`@keyframes fadein{from{opacity:0;transform:translateX(-50%) translateY(10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}} * { box-sizing: border-box; } body, html { margin: 0; padding: 0; background: #0f0f13; }`}</style>
      {editingSession&&<EditModal session={editingSession} onSave={saveEdit} onClose={()=>setEditingSession(null)}/>}
      {editingAirport&&<EditAirportModal airport={editingAirport} onSave={saveAirportEdit} onClose={()=>setEditingAirport(null)}/>}
      {editingPayment&&<EditPaymentModal payment={editingPayment} onSave={savePaymentEdit} onClose={()=>setEditingPayment(null)}/>}
      {editingActivity&&<EditActivityModal activity={editingActivity} onSave={saveActivityEdit} onClose={()=>setEditingActivity(null)}/>}
    </div>
  );
}

// ── Quick log modals ──────────────────────────────────────────────────────────
function QuickLogHours({newSession,setNewSession,addSession,onClose}){
  function calcHrs(s,e){if(!s||!e)return 0;const[sh,sm]=s.split(":").map(Number);const[eh,em]=e.split(":").map(Number);return Math.max(0,((eh*60+em)-(sh*60+sm))/60);}
  const hrs=calcHrs(newSession.startTime,newSession.endTime);
  const rate=rateForDate(newSession.date);
  return(
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={S.modal}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,color:"#f472a0",fontSize:16,fontWeight:800}}>⏰ Log Working Hours</h3>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newSession.date} onChange={e=>setNewSession(p=>({...p,date:e.target.value}))}/></Field>
          <Field label="💰 Expenses (€)"><input style={S.input} type="number" min="0" step="0.01" value={newSession.other} onChange={e=>setNewSession(p=>({...p,other:e.target.value}))}/></Field>
          <Field label="🕐 Start"><input style={S.input} type="time" value={newSession.startTime} onChange={e=>setNewSession(p=>({...p,startTime:e.target.value}))}/></Field>
          <Field label="🕔 End"><input style={S.input} type="time" value={newSession.endTime} onChange={e=>setNewSession(p=>({...p,endTime:e.target.value}))}/></Field>
        </div>
        {hrs>0&&<div style={S.preview}><span>{hrs.toFixed(2)} hrs × €{rate}/hr</span><span style={S.previewAmt}>{fmtEuro(hrs*rate)}</span></div>}
        <button style={{...S.primaryBtn,opacity:hrs>0?1:0.5}} onClick={addSession} disabled={hrs<=0}>+ Log</button>
      </div>
    </div>
  );
}

function QuickLogPayment({newPayment,setNewPayment,addPayment,onClose}){
  return(
    <div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={S.modal}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <h3 style={{margin:0,color:"#a78bfa",fontSize:16,fontWeight:800}}>💰 Register Payment</h3>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newPayment.date} onChange={e=>setNewPayment(p=>({...p,date:e.target.value}))}/></Field>
          <Field label="💶 Amount (€)"><input style={S.input} type="number" min="0" step="0.01" value={newPayment.amount} placeholder="0.00" onChange={e=>setNewPayment(p=>({...p,amount:e.target.value}))}/></Field>
        </div>
        <button style={{...S.primaryBtn,background:"linear-gradient(135deg,#7c3aed,#3b82f6)"}} onClick={addPayment}>Add Payment 🐾</button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
function Dashboard({sessions,airports,payments,activities,totalEarned,totalExpenses,totalPaid,balance,recentSessions,recentAirports,allPayments,showHistory,setShowHistory,deleteItem,setEditingSession,setEditingAirport,setEditingPayment,setEditingActivity}){
  const now=new Date();
  const thisMonthKey=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const lastMonthDate=new Date(now.getFullYear(),now.getMonth()-1,1);
  const lastMonthKey=`${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,"0")}`;
  function monthNet(k){
    const se=sessions.filter(s=>s.date.startsWith(k)).reduce((s,x)=>s+(x.earned||0)+(x.gas||0)+(x.parking||0)+(x.other||0),0);
    const ae=airports.filter(a=>a.date.startsWith(k)).reduce((s,x)=>s+(x.earned||0)+(x.gas||0)+(x.parking||0),0);
    const acte=activities.filter(a=>a.dateFrom&&a.dateFrom.startsWith(k)).reduce((s,x)=>s+(x.amount||0),0);
    return se+ae+acte;
  }
  function monthHours(k){return sessions.filter(s=>s.date.startsWith(k)).reduce((s,x)=>s+x.hours,0);}
  const allMonthKeys=[...new Set([...sessions.map(s=>s.date.slice(0,7)),...airports.map(a=>a.date.slice(0,7)),...activities.filter(a=>a.dateFrom).map(a=>a.dateFrom.slice(0,7))])].sort();
  const completeKeys=allMonthKeys.filter(k=>k<thisMonthKey);
  const last3=completeKeys.slice(-3);
  const avg3=last3.length?last3.reduce((s,k)=>s+monthNet(k),0)/last3.length:0;
  const earnedThis=monthNet(thisMonthKey),hoursThis=monthHours(thisMonthKey);
  const earnedLast=monthNet(lastMonthKey),hoursLast=monthHours(lastMonthKey);
  const avgHours3=last3.length?last3.reduce((s,k)=>s+monthHours(k),0)/last3.length:0;
  const lastPayment=allPayments.length>0?allPayments[0]:null;
  return(
    <div>
      {/* Still owed + last payment - side by side */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
        <div style={{background:"#1a1a24",borderRadius:14,padding:"12px 14px",border:`1px solid ${balance<0?"#3a2a10":"#2a2a3a"}`}}>
          <span style={{fontSize:10,color:"#6b6b80",textTransform:"uppercase",letterSpacing:.5,fontWeight:700,display:"block",marginBottom:4}}>{balance<0?"Overpaid":"Still owed"}</span>
          {balance<0&&<div style={{fontSize:9,color:"#f0a830",marginBottom:2}}>Too much paid</div>}
          <span style={{fontSize:20,fontWeight:800,color:balance<0?"#f0a830":balance>50?"#f472a0":"#34d399"}}>{fmtEuro(Math.abs(balance))}</span>
        </div>
        <div style={{background:"#1e1a2e",borderRadius:14,padding:"12px 14px",border:"1px solid #2a2a4a"}}>
          <span style={{fontSize:10,color:"#a78bfa",textTransform:"uppercase",letterSpacing:.5,fontWeight:700,display:"block",marginBottom:4}}>Last payment</span>
          {lastPayment?(
            <>
              <span style={{fontSize:20,fontWeight:800,color:"#a78bfa"}}>{fmtEuro(lastPayment.amount)}</span>
              <div style={{fontSize:9,color:"#6b6b80",marginTop:2}}>{fmtDate(new Date(lastPayment.date))}</div>
            </>
          ):<span style={{fontSize:13,color:"#6b6b80"}}>No payments yet</span>}
        </div>
      </div>
      {/* Month stats */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        <MonthCard label="This month" value={fmtEuro(earnedThis)} sub={`${hoursThis.toFixed(1)}h`} accent={C.pink}/>
        <MonthCard label="Last month" value={fmtEuro(earnedLast)} sub={`${hoursLast.toFixed(1)}h`} accent={C.blue}/>
        <MonthCard label="Avg 3m" value={fmtEuro(avg3)} sub={`${avgHours3.toFixed(1)}h avg`} accent={C.green}/>
      </div>
      <Sect title="📋 Recent Activity">
        <RecentActivity sessions={recentSessions} airports={recentAirports} payments={allPayments.slice(0,5)} activities={activities} deleteItem={deleteItem} setEditingSession={setEditingSession} setEditingAirport={setEditingAirport} setEditingPayment={setEditingPayment} setEditingActivity={setEditingActivity}/>
      </Sect>
    </div>
  );
}

function MonthCard({label,value,sub,accent}){
  return(
    <div style={{background:"#1a1a24",borderRadius:12,padding:"12px 10px",border:`1.5px solid ${accent}33`,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent}}/>
      <div style={{fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
      <div style={{fontSize:16,fontWeight:800,color:accent,lineHeight:1.2}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:"#bbb",marginTop:3}}>{sub}</div>}
    </div>
  );
}

function weekStart(dateStr){
  const d=new Date(dateStr);const day=d.getDay();const diff=day===0?-6:1-day;
  const mon=new Date(d);mon.setDate(d.getDate()+diff);return mon.toISOString().split("T")[0];
}
function WeekDivider({label}){
  return(
    <div style={{display:"flex",alignItems:"center",gap:8,margin:"6px 0 2px"}}>
      <div style={{flex:1,height:1,background:"#2a2a3a"}}/>
      <span style={{fontSize:10,color:"#6b6b80",fontWeight:700,textTransform:"uppercase",letterSpacing:.5,whiteSpace:"nowrap"}}>📅 Week of {label}</span>
      <div style={{flex:1,height:1,background:"#2a2a3a"}}/>
    </div>
  );
}

function RecentActivity({sessions,airports,payments,activities,deleteItem,setEditingSession,setEditingAirport,setEditingPayment,setEditingActivity}){
  const items=[
    ...sessions.map(s=>({...s,_type:"session",_sortDate:s.date+(s.startTime||"")})),
    ...airports.map(a=>({...a,_type:"airport",_sortDate:a.date+"00:00"})),
    ...payments.map(p=>({...p,_type:"payment",_sortDate:p.date+"00:00"})),
    ...(activities||[]).map(a=>({...a,_type:"activity",_sortDate:(a.dateFrom||"2000-01-01")+"00:00",_date:a.dateFrom||""})),
  ].sort((a,b)=>b._sortDate.localeCompare(a._sortDate)).slice(0,15);
  if(!items.length)return<p style={S.empty}>No activity yet 🐾</p>;
  let lastWeek=null;
  return(
    <div style={S.list}>
      {items.map(item=>{
        const itemDate=item._date||item.date||"";
        const ws=itemDate?weekStart(itemDate):"";
        const showDivider=ws&&ws!==lastWeek;
        if(ws)lastWeek=ws;
        const weekLabel=ws?new Date(ws).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"";
        let card;
        if(item._type==="session"){
          const exp=[];if(item.other>0)exp.push(`💰 €${item.other.toFixed(2)}`);
          card=(
            <div key={item.id+"s"} style={{...S.listItem,borderLeft:"3px solid #f472a0"}}>
              <div style={{...S.listLeft,gap:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:10,background:"#2a2a3a",color:"#f472a0",borderRadius:6,padding:"1px 7px",fontWeight:700,letterSpacing:.3}}>⏰ Hours</span><span style={S.listDate}>{fmtDate(new Date(item.date))}</span></div>
                <span style={{fontSize:14,fontWeight:600,color:"#d0ccdc"}}>{item.startTime} – {item.endTime}</span><span style={{fontSize:11,color:"#6b6b80"}}>{item.hours.toFixed(2)}h worked</span>
                {exp.length>0&&<span style={{fontSize:10,color:"#6b6b80"}}>{exp.join("  ")}</span>}
              </div>
              <div style={S.listRight}><span style={{...S.listAmt,color:C.green}}>{fmtEuro(item.earned)}</span><button style={S.editBtn} onClick={()=>setEditingSession(item)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("session",item.id)}>✕</button></div>
            </div>
          );
        } else if(item._type==="airport"){
          card=(
            <div key={item.id+"a"} style={{...S.listItem,borderLeft:"3px solid #60a5fa"}}>
              <div style={{...S.listLeft,gap:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:10,background:"#1a2a3a",color:"#60a5fa",borderRadius:6,padding:"1px 7px",fontWeight:700,letterSpacing:.3}}>✈️ Airport</span><span style={S.listDate}>{fmtDate(new Date(item.date))}</span></div>
                <span style={S.listSub}>{item.airport}{item.parking>0?` · 🅿️ €${item.parking.toFixed(2)}`:""}</span>
              </div>
              <div style={S.listRight}><span style={{...S.listAmt,color:C.blue}}>{fmtEuro(item.earned)}</span><button style={S.editBtn} onClick={()=>setEditingAirport(item)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("airport",item.id)}>✕</button></div>
            </div>
          );
        } else if(item._type==="payment") {
          card=(
            <div key={item.id+"p"} style={{...S.listItem,background:"#1e1a2e",borderLeft:"3px solid #a78bfa"}}>
              <div style={{...S.listLeft,gap:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:10,background:"#1e1a2e",color:"#a78bfa",borderRadius:6,padding:"1px 7px",fontWeight:700,letterSpacing:.3}}>💰 Payment</span><span style={S.listDate}>{fmtDate(new Date(item.date))}</span></div>
                <span style={{...S.listSub,color:"#a78bfa"}}>Received from boss</span>
              </div>
              <div style={S.listRight}><span style={{...S.listAmt,color:"#a78bfa"}}>{fmtEuro(item.amount)}</span><button style={S.editBtn} onClick={()=>setEditingPayment(item)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("payment",item.id)}>✕</button></div>
            </div>
          );
        } else {
          // activity
          card=(
            <div key={item.id+"act"} style={{...S.listItem,background:item.excludeFromOwed?"#1e1a14":"#1e1a2e",borderLeft:`3px solid ${item.excludeFromOwed?"#f0a830":"#a78bfa"}`}}>
              <div style={{...S.listLeft,gap:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,background:"#1e1a2e",color:"#a78bfa",borderRadius:6,padding:"1px 7px",fontWeight:700,letterSpacing:.3}}>🎪 Activity</span>
                  <span style={S.listDate}>{item.description}</span>
                  {item.excludeFromOwed&&<span style={{fontSize:10,background:"#3a2a10",color:"#f0a830",borderRadius:6,padding:"1px 7px",fontWeight:700}}>Not in balance</span>}
                </div>
                {(item.dateFrom||item.dateTo)&&<span style={S.listSub}>{item.dateFrom?fmtDate(new Date(item.dateFrom)):""}{item.dateTo&&item.dateFrom?" → ":""}{item.dateTo?fmtDate(new Date(item.dateTo)):""}</span>}
              </div>
              <div style={S.listRight}><span style={{...S.listAmt,color:item.excludeFromOwed?"#f0a830":"#a78bfa"}}>{fmtEuro(item.amount)}</span><button style={S.editBtn} onClick={()=>setEditingActivity(item)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("activity",item.id)}>✕</button></div>
            </div>
          );
        }
        return <>{showDivider&&<WeekDivider key={"w"+ws} label={weekLabel}/>}{card}</>;
      })}
    </div>
  );
}

// ── Log Hours ─────────────────────────────────────────────────────────────────
function LogHours({newSession,setNewSession,addSession,recentSessions,allSessions,deleteItem,setEditingSession}){
  const[showAll,setShowAll]=useState(false);
  const[filterMonth,setFilterMonth]=useState("");
  const allReversed=[...allSessions].reverse();
  const months=[...new Set(allSessions.map(s=>s.date.slice(0,7)))].sort().reverse();
  const filtered=filterMonth?allReversed.filter(s=>s.date.startsWith(filterMonth)):allReversed;
  const displayed=showAll?filtered:recentSessions;
  function calcHrs(s,e){if(!s||!e)return 0;const[sh,sm]=s.split(":").map(Number);const[eh,em]=e.split(":").map(Number);return Math.max(0,((eh*60+em)-(sh*60+sm))/60);}
  const hrs=calcHrs(newSession.startTime,newSession.endTime);
  const rate=rateForDate(newSession.date);
  return(
    <div>
      <div style={S.card}>
        <div style={{marginBottom:16}}><h2 style={S.cardTitle}>Log Working Hours ⏰</h2></div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newSession.date} onChange={e=>setNewSession(p=>({...p,date:e.target.value}))}/></Field>
          <Field label="💰 Expenses (€)"><input style={S.input} type="number" min="0" step="0.01" value={newSession.other} onChange={e=>setNewSession(p=>({...p,other:e.target.value}))}/></Field>
          <Field label="🕐 Start"><input style={S.input} type="time" value={newSession.startTime} onChange={e=>setNewSession(p=>({...p,startTime:e.target.value}))}/></Field>
          <Field label="🕔 End"><input style={S.input} type="time" value={newSession.endTime} onChange={e=>setNewSession(p=>({...p,endTime:e.target.value}))}/></Field>
        </div>
        {hrs>0&&<div style={S.preview}><span>{hrs.toFixed(2)} hrs × €{rate}/hr</span><span style={S.previewAmt}>{fmtEuro(hrs*rate)}</span></div>}
        <button style={{...S.primaryBtn,opacity:hrs>0?1:0.5}} onClick={addSession} disabled={hrs<=0}>+ Log</button>
      </div>
      <Sect title={showAll?`All Sessions (${filtered.length})`:"Recent Sessions"}>
        <SessionList sessions={recentSessions} deleteItem={deleteItem} setEditingSession={setEditingSession}/>
      </Sect>
    </div>
  );
}

function LogServices({newAirport,setNewAirport,addAirport,recentAirports,allAirports,deleteItem,setEditingAirport,newActivity,setNewActivity,addActivity,activities,setEditingActivity}){
  const [subTab,setSubTab]=useState("airport");
  return(
    <div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <button onClick={()=>setSubTab("airport")} style={{flex:1,padding:"10px",borderRadius:12,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",background:subTab==="airport"?"linear-gradient(135deg,#1a3a5a,#2a4a6a)":"#12121a",color:subTab==="airport"?"#2a5c8a":"#6b6b80",boxShadow:subTab==="airport"?"0 3px 12px #a8d4f544":"none",border:subTab==="airport"?"none":"1.5px solid #fce7f0"}}>
          ✈️ Airport Trip
        </button>
        <button onClick={()=>setSubTab("activity")} style={{flex:1,padding:"10px",borderRadius:12,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit",background:subTab==="activity"?"linear-gradient(135deg,#2a1a4a,#3a2a5a)":"#12121a",color:subTab==="activity"?"#6b48d4":"#6b6b80",boxShadow:subTab==="activity"?"0 3px 12px #c4b0f544":"none",border:subTab==="activity"?"none":"1.5px solid #fce7f0"}}>
          🎪 Activity
        </button>
      </div>
      {subTab==="airport"&&<LogAirport newAirport={newAirport} setNewAirport={setNewAirport} addAirport={addAirport} recentAirports={recentAirports} allAirports={allAirports} deleteItem={deleteItem} setEditingAirport={setEditingAirport}/>}
      {subTab==="activity"&&<LogActivity newActivity={newActivity} setNewActivity={setNewActivity} addActivity={addActivity} activities={activities} deleteItem={deleteItem} setEditingActivity={setEditingActivity}/>}
    </div>
  );
}

function LogAirport({newAirport,setNewAirport,addAirport,recentAirports,allAirports,deleteItem,setEditingAirport}){
  const info=AIRPORTS[newAirport.airport]||AIRPORTS.Brussels;
  const[showAll,setShowAll]=useState(false);
  const displayed=showAll?[...allAirports].reverse():recentAirports;
  return(
    <div>
      <div style={S.card}>
        <div style={{marginBottom:16}}><h2 style={S.cardTitle}>Log Airport Trip ✈️</h2></div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newAirport.date} onChange={e=>setNewAirport(p=>({...p,date:e.target.value}))}/></Field>
          <Field label="🛫 Airport"><select style={S.input} value={newAirport.airport} onChange={e=>setNewAirport(p=>({...p,airport:e.target.value}))}>{Object.keys(AIRPORTS).map(a=><option key={a}>{a}</option>)}</select></Field>
          <Field label="💰 Expenses (€)"><input style={S.input} type="number" min="0" step="0.01" value={newAirport.parking} onChange={e=>setNewAirport(p=>({...p,parking:e.target.value}))}/></Field>
        </div>
        <div style={S.preview}><span>{newAirport.airport} Airport</span><span style={S.previewAmt}>{fmtEuro(info.earned)}</span></div>
        <button style={S.primaryBtn} onClick={addAirport}>Add Trip 🐾</button>
      </div>
      <Sect title={showAll?`All Trips (${allAirports.length})`:"Recent Trips"}>
        <button style={{...S.toggleBtn,...(showAll?{background:"#2a2a3a",color:"#f472a0",borderColor:"#3d2545"}:{})}} onClick={()=>setShowAll(p=>!p)}>
          {showAll?"▲ Recent only":`▼ All ${allAirports.length} trips`}
        </button>
        <AirportList airports={displayed} deleteItem={deleteItem} setEditingAirport={setEditingAirport}/>
      </Sect>
    </div>
  );
}

function LogPayment({newPayment,setNewPayment,addPayment,allPayments,deleteItem,setEditingPayment}){
  const[showHistory,setShowHistory]=useState(true);
  return(
    <div>
      <div style={S.card}>
        <div style={{marginBottom:16}}><h2 style={S.cardTitle}>Register Payment 💰</h2></div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newPayment.date} onChange={e=>setNewPayment(p=>({...p,date:e.target.value}))}/></Field>
          <Field label="💶 Amount (€)"><input style={S.input} type="number" min="0" step="0.01" value={newPayment.amount} placeholder="0.00" onChange={e=>setNewPayment(p=>({...p,amount:e.target.value}))}/></Field>
        </div>
        <button style={S.primaryBtn} onClick={addPayment}>Add Payment 🐾</button>
      </div>
      <Sect title="Payment History">
        <button style={S.toggleBtn} onClick={()=>setShowHistory(!showHistory)}>{showHistory?"▲ Hide":"▼ Show"} history</button>
        {showHistory&&<PaymentList payments={allPayments} deleteItem={deleteItem} setEditingPayment={setEditingPayment}/>}
      </Sect>
    </div>
  );
}

function LogActivity({newActivity,setNewActivity,addActivity,activities,deleteItem,setEditingActivity}){
  const allDesc=[...activities].reverse();
  return(
    <div>
      <div style={S.card}>
        <div style={{marginBottom:16}}><h2 style={S.cardTitle}>Log Activity 🎪</h2></div>
        <div style={S.formGrid}>
          <Field label="📝 Description"><input style={S.input} type="text" placeholder="e.g. Zomerkamp 2026" value={newActivity.description} onChange={e=>setNewActivity(p=>({...p,description:e.target.value}))}/></Field>
          <Field label="💶 Amount earned (€)"><input style={S.input} type="number" min="0" step="0.01" placeholder="0.00" value={newActivity.amount} onChange={e=>setNewActivity(p=>({...p,amount:e.target.value}))}/></Field>
          <Field label="📅 From date (optional)"><input style={S.input} type="date" value={newActivity.dateFrom} onChange={e=>setNewActivity(p=>({...p,dateFrom:e.target.value}))}/></Field>
          <Field label="📅 To date (optional)"><input style={S.input} type="date" value={newActivity.dateTo} onChange={e=>setNewActivity(p=>({...p,dateTo:e.target.value}))}/></Field>
        </div>
        <label style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,cursor:"pointer",padding:"10px 14px",background:newActivity.excludeFromOwed?"#1e1a14":"#12121a",borderRadius:10,border:`1.5px solid ${newActivity.excludeFromOwed?"#ffe0b0":"#2a2a3a"}`}}>
          <input type="checkbox" checked={!!newActivity.excludeFromOwed} onChange={e=>setNewActivity(p=>({...p,excludeFromOwed:e.target.checked}))} style={{width:18,height:18,accentColor:"#f0a830"}}/>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:newActivity.excludeFromOwed?"#f0a830":"#f0edf5"}}>Not paid by regular boss</div>
            <div style={{fontSize:11,color:"#6b6b80"}}>Excludes this from the "Still Owed" balance</div>
          </div>
        </label>
        <button style={{...S.primaryBtn,opacity:(newActivity.description&&newActivity.amount)?1:0.5}} onClick={addActivity} disabled={!newActivity.description||!newActivity.amount}>Add Activity 🐾</button>
      </div>
      <Sect title={`Activities (${activities.length})`}>
        {allDesc.length===0&&<p style={S.empty}>No activities yet 🎪</p>}
        <div style={S.list}>
          {allDesc.map(a=>(
            <div key={a.id} style={{...S.listItem,background:a.excludeFromOwed?"#1e1a14":"white",border:`1px solid ${a.excludeFromOwed?"#3a2a10":"#2a2a3a"}`,borderLeft:`3px solid ${a.excludeFromOwed?"#f0a830":"#a78bfa"}`}}>
              <div style={S.listLeft}>
                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                  <span style={{fontSize:10,background:a.excludeFromOwed?"#fff0d0":"#f0ecff",color:a.excludeFromOwed?"#f0a830":"#6b48d4",borderRadius:6,padding:"1px 7px",fontWeight:700}}>🎪 Activity</span>
                  <span style={S.listDate}>{a.description}</span>
                  {a.excludeFromOwed&&<span style={{fontSize:10,background:"#3a2a10",color:"#f0a830",borderRadius:6,padding:"1px 7px",fontWeight:700}}>Not in balance</span>}
                </div>
                {(a.dateFrom||a.dateTo)&&<span style={S.listSub}>{a.dateFrom?fmtDate(new Date(a.dateFrom)):""}{a.dateTo&&a.dateFrom?" → ":""}{a.dateTo?fmtDate(new Date(a.dateTo)):""}</span>}
              </div>
              <div style={S.listRight}>
                <span style={{...S.listAmt,color:a.excludeFromOwed?"#f0a830":"#a78bfa"}}>{fmtEuro(a.amount)}</span>
                <button style={S.editBtn} onClick={()=>setEditingActivity(a)}>✏️</button>
                <button style={S.deleteBtn} onClick={()=>deleteItem("activity",a.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
      </Sect>
    </div>
  );
}

// ── Analytics ─────────────────────────────────────────────────────────────────
function Analytics({sessions,airports,payments,activities,totalEarned,totalExpenses,totalPaid}){
  const[monthView,setMonthView]=useState("earned");
  const now=new Date();
  const thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  function mk(d){return d.slice(0,7);}
  const monthEarned={},monthHours={};
  sessions.forEach(s=>{const k=mk(s.date);monthEarned[k]=(monthEarned[k]||0)+(s.earned||0)+(s.gas||0)+(s.parking||0)+(s.other||0);monthHours[k]=(monthHours[k]||0)+s.hours;});
  airports.forEach(a=>{const k=mk(a.date);monthEarned[k]=(monthEarned[k]||0)+(a.earned||0)+(a.gas||0)+(a.parking||0);});
  activities.forEach(a=>{if(a.dateFrom){const k=mk(a.dateFrom);monthEarned[k]=(monthEarned[k]||0)+(a.amount||0);}});
  const allKeys=Object.keys(monthEarned).sort();
  const completeKeys=allKeys.filter(k=>k<thisMonth);
  function lm(k){const[y,m]=k.split("-");return new Date(+y,+m-1,1).toLocaleDateString("en",{month:"long",year:"numeric"});}
  function smy(k){const[y,m]=k.split("-");return new Date(+y,+m-1,1).toLocaleDateString("en",{month:"short",year:"2-digit"});}
  const bestKey=completeKeys.length?completeKeys.reduce((a,b)=>monthEarned[a]>monthEarned[b]?a:b):"";
  const worstKey=completeKeys.length?completeKeys.reduce((a,b)=>monthEarned[a]<monthEarned[b]?a:b):"";
  const mostHrsKey=completeKeys.length?completeKeys.reduce((a,b)=>(monthHours[a]||0)>(monthHours[b]||0)?a:b):"";
  function avgC(n){const l=completeKeys.slice(-n);return l.length?l.reduce((s,k)=>s+(monthEarned[k]||0),0)/l.length:0;}
  const earnedThis=monthEarned[thisMonth]||0,hoursThis=monthHours[thisMonth]||0;
  const avg3=avgC(3),avg6=avgC(6),avg12=avgC(12);
  const avgAll=completeKeys.length?completeKeys.reduce((s,k)=>s+(monthEarned[k]||0),0)/completeKeys.length:0;
  const sinceRaise=completeKeys.filter(k=>k>="2025-09");
  const avgRaise=sinceRaise.length?sinceRaise.reduce((s,k)=>s+(monthEarned[k]||0),0)/sinceRaise.length:0;
  const totalHours=sessions.reduce((s,x)=>s+x.hours,0);
  const sp=[...payments].sort((a,b)=>a.date.localeCompare(b.date));
  let avgGap=0;if(sp.length>1){const gaps=sp.slice(1).map((p,i)=>(new Date(p.date)-new Date(sp[i].date))/86400000);avgGap=gaps.reduce((a,b)=>a+b,0)/gaps.length;}
  const last6=completeKeys.slice(-6);
  const chartData=monthView==="earned"?monthEarned:monthHours;
  const maxVal=Math.max(...last6.map(k=>chartData[k]||0),1);
  const ts={border:"1px solid #fce7f0",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"};
  return(
    <div>
      <div style={{...S.card,background:"#1a1a24",border:"1.5px solid #f9c8d4"}}>
        <h2 style={{...S.cardTitle,color:"#f472a0",marginBottom:4}}>Earnings Stats 📊</h2>
        <p style={{color:"#a06080",fontSize:13,margin:"0 0 16px"}}>All the numbers! 🐾</p>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
          <MonthCard label="Total Earned" value={fmtEuro(totalEarned)} sub="all time" accent={C.green}/>
          <MonthCard label="Total Expenses" value={fmtEuro(totalExpenses)} sub="reimbursed" accent={C.blue}/>
          <MonthCard label="Total Paid out" value={fmtEuro(totalPaid)} sub="by boss" accent="#a78bfa"/>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
          <AnalCard label="This month" value={fmtEuro(earnedThis)} accent={C.pink} note={`${hoursThis.toFixed(1)}h worked`}/>
          <AnalCard label="Avg last 3 months" value={fmtEuro(avg3)} accent={C.blue} note="complete months"/>
          <AnalCard label="Avg last 6 months" value={fmtEuro(avg6)} accent={C.green} note="complete months"/>
          <AnalCard label="Avg last 12 months" value={fmtEuro(avg12)} accent={C.pink} note="complete months"/>
          <AnalCard label="All-time avg" value={fmtEuro(avgAll)} accent={C.blue} note="complete months"/>
          <AnalCard label="Avg since €20/hr" value={fmtEuro(avgRaise)} accent={C.green} note={`${sinceRaise.length} months`}/>
          <AnalCard label="Total hours" value={totalHours.toFixed(1)+"h"} accent={C.pink} note={`${sessions.length} sessions`}/>
          <AnalCard label="Airport trips" value={airports.length} accent={C.blue} note="total"/>
        </div>
        <div style={{background:"#1a1a24",borderRadius:14,padding:"14px",marginBottom:14,border:"1px solid #fce7f0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:11,color:"#a06080",fontWeight:700}}>LAST 6 COMPLETE MONTHS</span>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>setMonthView("earned")} style={{...ts,background:monthView==="earned"?"#3d2545":"transparent",color:monthView==="earned"?"#f472a0":"#6b6b80"}}>€</button>
              <button onClick={()=>setMonthView("hours")} style={{...ts,background:monthView==="hours"?"#c4dff5":"transparent",color:monthView==="hours"?"#2a5c8a":"#6b6b80"}}>⏱</button>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:90}}>
            {last6.map(k=>{const val=chartData[k]||0;const bh=Math.max(4,(val/maxVal)*70);const lbl=monthView==="earned"?fmtEuro(val):val.toFixed(1)+"h";return(<div key={k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:7,color:"#f472a0",fontWeight:700,textAlign:"center",lineHeight:1.2}}>{lbl}</span><div style={{width:"100%",background:monthView==="earned"?`linear-gradient(180deg,${C.pink},#f4a7bb)`:`linear-gradient(180deg,${C.blue},#a8d4f5)`,borderRadius:"4px 4px 0 0",height:bh}}/><span style={{fontSize:7,color:"#a06080",fontWeight:600,textAlign:"center"}}>{smy(k)}</span></div>);})}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          <FunFact icon="🏆" label="Best month" value={bestKey?lm(bestKey):"—"} sub={bestKey?fmtEuro(monthEarned[bestKey]):""}/>
          <FunFact icon="📉" label="Quietest" value={worstKey?lm(worstKey):"—"} sub={worstKey?fmtEuro(monthEarned[worstKey]):""}/>
          <FunFact icon="⏰" label="Most hours" value={mostHrsKey?lm(mostHrsKey):"—"} sub={mostHrsKey?(monthHours[mostHrsKey]||0).toFixed(1)+"h":""}/>
          <FunFact icon="💸" label="Avg pay gap" value={avgGap>0?`${avgGap.toFixed(0)} days`:"—"} sub="between payments"/>
        </div>
        <div style={{background:"#1a1a24",borderRadius:14,padding:14,border:"1px solid #fce7f0"}}>
          <div style={{fontSize:11,color:"#a06080",fontWeight:700,marginBottom:10}}>📋 MONTHLY OVERVIEW</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",fontSize:11,color:"#6b6b80",fontWeight:700,paddingBottom:6,borderBottom:"1px solid #2a2a3a",marginBottom:4}}>
            <span>Month</span><span style={{textAlign:"right"}}>Hours</span><span style={{textAlign:"right"}}>Earned</span>
          </div>
          <div style={{maxHeight:280,overflowY:"auto"}}>
            {[...allKeys].reverse().map(k=>{const isThis=k===thisMonth;return(<div key={k} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",padding:"5px 0",borderBottom:"1px solid #1e1e2a",background:isThis?"#1e1a24":"transparent"}}><span style={{fontSize:11,fontWeight:isThis?700:500,color:isThis?"#f472a0":"#f0edf5"}}>{lm(k)}{isThis?" ★":""}</span><span style={{fontSize:11,textAlign:"right",color:"#6b6b80"}}>{(monthHours[k]||0).toFixed(1)}h</span><span style={{fontSize:11,textAlign:"right",fontWeight:600,color:C.green}}>{fmtEuro(monthEarned[k]||0)}</span></div>);})}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Lists ─────────────────────────────────────────────────────────────────────
function SessionList({sessions,deleteItem,setEditingSession}){
  if(!sessions.length)return<p style={S.empty}>No sessions yet 🐾</p>;
  let lastWeek=null;
  return(<div style={S.list}>{sessions.map(s=>{
    const ws=weekStart(s.date);const showDivider=ws!==lastWeek;lastWeek=ws;
    const weekLabel=new Date(ws).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});
    const exp=[];if(s.other>0)exp.push(`💰 €${s.other.toFixed(2)}`);if(s.gas>0)exp.push(`⛽ €${s.gas.toFixed(2)}`);
    return(<>{showDivider&&<WeekDivider key={"w"+ws} label={weekLabel}/>}<div key={s.id} style={{...S.listItem,borderLeft:"3px solid #f472a0"}}><div style={S.listLeft}><span style={S.listDate}>{fmtDate(new Date(s.date))}</span><span style={{fontSize:14,fontWeight:600,color:"#d0ccdc"}}>{s.startTime} – {s.endTime}</span><span style={{fontSize:11,color:"#6b6b80"}}>{s.hours.toFixed(2)}h worked</span>{exp.length>0&&<span style={{fontSize:10,color:"#6b6b80",marginTop:1}}>{exp.join("  ")}</span>}</div><div style={S.listRight}><span style={{...S.listAmt,color:C.green}}>{fmtEuro(s.earned)}</span><button style={S.editBtn} onClick={()=>setEditingSession(s)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("session",s.id)}>✕</button></div></div></>);
  })}</div>);
}

function AirportList({airports,deleteItem,setEditingAirport}){
  if(!airports.length)return<p style={S.empty}>No trips yet 🛫</p>;
  return(<div style={S.list}>{airports.map(a=>(<div key={a.id} style={{...S.listItem,borderLeft:"3px solid #60a5fa"}}><div style={S.listLeft}><span style={S.listDate}>{fmtDate(new Date(a.date))}</span><span style={S.listSub}>{a.airport} Airport{a.parking>0?` · 🅿️ €${a.parking.toFixed(2)}`:""}</span></div><div style={S.listRight}><span style={{...S.listAmt,color:C.blue}}>{fmtEuro(a.earned)}</span><button style={S.editBtn} onClick={()=>setEditingAirport(a)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("airport",a.id)}>✕</button></div></div>))}</div>);
}

function PaymentList({payments,deleteItem,setEditingPayment}){
  if(!payments.length)return<p style={S.empty}>No payments yet 💸</p>;
  return(<div style={S.list}>{payments.map(p=>(<div key={p.id} style={{...S.listItem,background:"#1e1a2e",borderLeft:"3px solid #a78bfa"}}><div style={S.listLeft}><span style={S.listDate}>{fmtDate(new Date(p.date))}</span><span style={{...S.listSub,color:"#a78bfa"}}>Received from boss</span></div><div style={S.listRight}><span style={{...S.listAmt,color:"#a78bfa"}}>{fmtEuro(p.amount)}</span><button style={S.editBtn} onClick={()=>setEditingPayment(p)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("payment",p.id)}>✕</button></div></div>))}</div>);
}

// ── Modals ────────────────────────────────────────────────────────────────────
function EditModal({session,onSave,onClose}){
  const[form,setForm]=useState({...session});
  function ch(s,e){if(!s||!e)return 0;const[sh,sm]=s.split(":").map(Number);const[eh,em]=e.split(":").map(Number);return Math.max(0,((eh*60+em)-(sh*60+sm))/60);}
  const hrs=ch(form.startTime,form.endTime);const rate=rateForDate(form.date);
  return(<div style={S.overlay}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#f472a0",fontSize:16,fontWeight:800}}>✏️ Edit Session</h3><button style={S.closeBtn} onClick={onClose}>✕</button></div><div style={S.formGrid}><Field label="📅 Date"><input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></Field><Field label="💰 Expenses"><input style={S.input} type="number" min="0" step="0.01" value={form.other} onChange={e=>setForm(p=>({...p,other:+e.target.value}))}/></Field><Field label="🕐 Start"><input style={S.input} type="time" value={form.startTime} onChange={e=>setForm(p=>({...p,startTime:e.target.value}))}/></Field><Field label="🕔 End"><input style={S.input} type="time" value={form.endTime} onChange={e=>setForm(p=>({...p,endTime:e.target.value}))}/></Field></div><div style={S.preview}><span>{hrs.toFixed(2)} hrs × €{rate}/hr</span><span style={S.previewAmt}>{fmtEuro(hrs*rate)}</span></div><div style={{display:"flex",gap:8}}><button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button><button style={{...S.primaryBtn,flex:2}} onClick={()=>onSave({...form,hours:hrs,earned:+(hrs*rate).toFixed(4),rate})}>Save 🐾</button></div></div></div>);
}

function EditAirportModal({airport,onSave,onClose}){
  const[form,setForm]=useState({...airport});
  return(<div style={S.overlay}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#f472a0",fontSize:16,fontWeight:800}}>✏️ Edit Airport Trip</h3><button style={S.closeBtn} onClick={onClose}>✕</button></div><div style={S.formGrid}><Field label="📅 Date"><input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></Field><Field label="🛫 Airport"><select style={S.input} value={form.airport} onChange={e=>setForm(p=>({...p,airport:e.target.value}))}>{Object.keys(AIRPORTS).map(a=><option key={a}>{a}</option>)}</select></Field><Field label="💶 Earned"><input style={S.input} type="number" min="0" step="0.01" value={form.earned} onChange={e=>setForm(p=>({...p,earned:+e.target.value}))}/></Field></div><div style={S.preview}><span>{form.airport}</span><span style={S.previewAmt}>{fmtEuro((form.earned||0)+(form.parking||0))}</span></div><div style={{display:"flex",gap:8}}><button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button><button style={{...S.primaryBtn,flex:2}} onClick={()=>onSave(form)}>Save 🐾</button></div></div></div>);
}

function EditPaymentModal({payment,onSave,onClose}){
  const[form,setForm]=useState({...payment});
  return(<div style={S.overlay}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#a78bfa",fontSize:16,fontWeight:800}}>✏️ Edit Payment</h3><button style={S.closeBtn} onClick={onClose}>✕</button></div><div style={S.formGrid}><Field label="📅 Date"><input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></Field><Field label="💶 Amount"><input style={S.input} type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm(p=>({...p,amount:+e.target.value}))}/></Field></div><div style={{display:"flex",gap:8,marginTop:8}}><button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button><button style={{...S.primaryBtn,flex:2,background:"linear-gradient(135deg,#7c3aed,#3b82f6)"}} onClick={()=>onSave(form)}>Save 🐾</button></div></div></div>);
}

function EditActivityModal({activity,onSave,onClose}){
  const[form,setForm]=useState({...activity});
  return(<div style={S.overlay}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#f472a0",fontSize:16,fontWeight:800}}>✏️ Edit Activity</h3><button style={S.closeBtn} onClick={onClose}>✕</button></div><div style={S.formGrid}><Field label="📝 Description"><input style={S.input} type="text" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))}/></Field><Field label="💶 Amount (€)"><input style={S.input} type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm(p=>({...p,amount:+e.target.value}))}/></Field><Field label="📅 From date"><input style={S.input} type="date" value={form.dateFrom||""} onChange={e=>setForm(p=>({...p,dateFrom:e.target.value}))}/></Field><Field label="📅 To date"><input style={S.input} type="date" value={form.dateTo||""} onChange={e=>setForm(p=>({...p,dateTo:e.target.value}))}/></Field></div><label style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,cursor:"pointer",padding:"10px 14px",background:form.excludeFromOwed?"#1e1a14":"#12121a",borderRadius:10,border:`1.5px solid ${form.excludeFromOwed?"#ffe0b0":"#2a2a3a"}`}}><input type="checkbox" checked={!!form.excludeFromOwed} onChange={e=>setForm(p=>({...p,excludeFromOwed:e.target.checked}))} style={{width:18,height:18,accentColor:"#f0a830"}}/><div><div style={{fontSize:13,fontWeight:700,color:form.excludeFromOwed?"#f0a830":"#f0edf5"}}>Not paid by regular boss</div><div style={{fontSize:11,color:"#6b6b80"}}>Excludes from "Still Owed" balance</div></div></label><div style={{display:"flex",gap:8}}><button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button><button style={{...S.primaryBtn,flex:2}} onClick={()=>onSave(form)}>Save 🐾</button></div></div></div>);
}

// ── Shared small components ───────────────────────────────────────────────────
function Sect({title,children}){return<div style={{marginBottom:20}}><h3 style={S.sectTitle}>{title}</h3>{children}</div>;}
function Field({label,children}){return<label style={S.label}><span style={{marginBottom:4,display:"block"}}>{label}</span>{children}</label>;}
function FunFact({icon,label,value,sub}){return(<div style={{background:"#1e1a24",borderRadius:12,padding:"10px 12px",border:"1px solid #fce7f0",textAlign:"center"}}><div style={{fontSize:18,marginBottom:3}}>{icon}</div><div style={{fontSize:9,color:"#a06080",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{label}</div><div style={{fontSize:11,fontWeight:800,color:"#f472a0",marginTop:2,lineHeight:1.3}}>{value}</div>{sub&&<div style={{fontSize:10,color:C.green,fontWeight:700,marginTop:1}}>{sub}</div>}</div>);}
function AnalCard({label,value,accent,note}){return(<div style={{background:"#1a1a24",borderRadius:12,padding:"12px 14px",border:`1.5px solid ${accent}33`,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent}}/><div style={{fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{label}</div><div style={{fontSize:18,fontWeight:800,color:accent}}>{value}</div><div style={{fontSize:10,color:"#bbb",marginTop:1}}>{note}</div></div>);}

const C={pink:"#f472a0",blue:"#60a5fa",green:"#34d399"};
const S={
  root:{minHeight:"100vh",background:"#0f0f13",color:"#f0edf5",fontFamily:"'DM Sans','Segoe UI',sans-serif",paddingBottom:80,margin:0},
  header:{background:"#1a1a24",borderBottom:"1px solid #2a2a3a",padding:"10px 0",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 20px rgba(0,0,0,0.4)"},
  headerInner:{maxWidth:740,margin:"0 auto",padding:"0 12px",display:"flex",alignItems:"center",justifyContent:"space-between"},
  logo:{fontSize:18,fontWeight:800,color:"#f472a0",letterSpacing:.5},
  headerActionBtn:{background:"#1a1a2e",color:"#60a5fa",border:"1px solid #2a2a4a",borderRadius:10,padding:"9px 16px",fontSize:14,fontWeight:700,cursor:"pointer"},
  main:{maxWidth:740,margin:"0 auto",padding:"14px 12px 0"},
  card:{background:"#1a1a24",borderRadius:16,padding:16,marginBottom:16,border:"1px solid #2a2a3a",boxShadow:"0 4px 20px rgba(0,0,0,0.3)"},
  cardTitle:{margin:0,fontSize:16,fontWeight:800,color:"#f472a0"},
  sectTitle:{fontSize:12,fontWeight:700,color:"#6b6b80",textTransform:"uppercase",letterSpacing:1,margin:"0 0 8px"},
  formGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14},
  label:{fontSize:11,color:"#6b6b80",fontWeight:700,letterSpacing:.3},
  input:{background:"#12121a",border:"1px solid #2a2a3a",borderRadius:10,padding:"14px 14px",color:"#f0edf5",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit",WebkitAppearance:"none",minHeight:"52px"},
  preview:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#12121a",borderRadius:10,padding:"10px 14px",marginBottom:14,color:"#6b6b80",fontSize:13,border:"1px dashed #2a2a3a"},
  previewAmt:{fontSize:20,fontWeight:800,color:"#34d399"},
  primaryBtn:{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#f472a0,#60a5fa)",color:"white",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 3px 20px rgba(244,114,160,0.3)"},
  toggleBtn:{background:"transparent",border:"1px dashed #2a2a3a",borderRadius:10,color:"#6b6b80",padding:"7px 14px",fontSize:12,cursor:"pointer",marginBottom:10,fontFamily:"inherit"},
  list:{display:"flex",flexDirection:"column",gap:8},
  listItem:{background:"#1a1a24",borderRadius:12,padding:"12px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #2a2a3a"},
  listLeft:{display:"flex",flexDirection:"column",gap:2,flex:1,minWidth:0},
  listDate:{fontSize:13,fontWeight:700,color:"#f0edf5"},
  listSub:{fontSize:11,color:"#6b6b80"},
  listRight:{display:"flex",alignItems:"center",gap:6,flexShrink:0},
  listAmt:{fontSize:15,fontWeight:800},
  editBtn:{background:"transparent",border:"none",cursor:"pointer",fontSize:14,padding:"2px 4px"},
  deleteBtn:{background:"transparent",border:"none",color:"#4a3a4a",cursor:"pointer",fontSize:14,padding:"2px 4px"},
  empty:{color:"#4a4a5a",fontSize:13,fontStyle:"italic"},
  overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(8px)"},
  modal:{background:"#1a1a24",borderRadius:20,padding:20,width:"min(480px,95vw)",border:"1px solid #2a2a3a",boxShadow:"0 20px 60px rgba(0,0,0,0.5)",maxHeight:"90vh",overflowY:"auto"},
  closeBtn:{background:"#12121a",border:"1px solid #2a2a3a",borderRadius:8,cursor:"pointer",fontSize:14,color:"#6b6b80",padding:"4px 10px"},
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"#1a1a24",borderTop:"1px solid #2a2a3a",display:"flex",justifyContent:"space-around",padding:"6px 0 calc(6px + env(safe-area-inset-bottom))",zIndex:200,boxShadow:"0 -4px 20px rgba(0,0,0,0.4)"},
  bottomNavBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:1,padding:"2px 0",background:"transparent",border:"none",cursor:"pointer",color:"#4a4a5a",minWidth:0},
  bottomNavActive:{color:"#f472a0"},
};
