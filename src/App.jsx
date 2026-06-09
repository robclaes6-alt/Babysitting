import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore";

const AIRPORTS = { Brussels:{km:95,earned:90.58}, Charleroi:{km:226,earned:145.18}, Eindhoven:{km:170,earned:140} };
const FUEL_PER_KM = 0.111408;
const RATE_CHANGE_DATE = new Date("2025-09-01");

function fmtDate(d) { return new Date(d).toLocaleDateString("en-GB",{weekday:"short",day:"2-digit",month:"short",year:"numeric"}); }
function fmtEuro(n) { return "€"+Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,","); }
function rateForDate(d) { return new Date(d)>=RATE_CHANGE_DATE?20:15; }
function today() { return new Date().toISOString().split("T")[0]; }

async function loadCol(name) { const s=await getDocs(collection(db,name)); return s.docs.map(d=>({id:d.id,...d.data()})); }
async function addItem(col,data) { const r=await addDoc(collection(db,col),data); return {id:r.id,...data}; }
async function updateItem(col,id,data) { await updateDoc(doc(db,col,id),data); }
async function deleteItem_db(col,id) { await deleteDoc(doc(db,col,id)); }

const DogSVG=({size=32,style={}})=>(<svg width={size} height={size} viewBox="0 0 64 64" style={style}><ellipse cx="32" cy="40" rx="16" ry="13" fill="#f9c8d4"/><ellipse cx="32" cy="26" rx="13" ry="12" fill="#f9c8d4"/><ellipse cx="21" cy="18" rx="6" ry="9" fill="#f4a7bb" transform="rotate(-15 21 18)"/><ellipse cx="43" cy="18" rx="6" ry="9" fill="#f4a7bb" transform="rotate(15 43 18)"/><circle cx="27" cy="25" r="2.5" fill="#3a2a2a"/><circle cx="37" cy="25" r="2.5" fill="#3a2a2a"/><circle cx="27.8" cy="24.2" r=".9" fill="white"/><circle cx="37.8" cy="24.2" r=".9" fill="white"/><ellipse cx="32" cy="30" rx="4" ry="3" fill="#e88ba0"/><path d="M30 31 Q32 33.5 34 31" stroke="#c9607a" strokeWidth="1.2" fill="none" strokeLinecap="round"/><ellipse cx="32" cy="46" rx="7" ry="5" fill="#f4a7bb"/><ellipse cx="20" cy="50" rx="5" ry="3.5" fill="#f9c8d4"/><ellipse cx="44" cy="50" rx="5" ry="3.5" fill="#f9c8d4"/><path d="M38 47 Q45 43 50 46" stroke="#f4a7bb" strokeWidth="2.5" strokeLinecap="round" fill="none"/></svg>);

export default function App() {
  const [sessions,setSessions]=useState([]);
  const [airports,setAirports]=useState([]);
  const [payments,setPayments]=useState([]);
  const [loading,setLoading]=useState(true);
  const [tab,setTab]=useState("dashboard");
  const [showHistory,setShowHistory]=useState(false);
  const [editingSession,setEditingSession]=useState(null);
  const [editingAirport,setEditingAirport]=useState(null);
  const [editingPayment,setEditingPayment]=useState(null);
  const [quickLog,setQuickLog]=useState(null);
  const [showFeedback,setShowFeedback]=useState(false);
  const [feedbackNotes,setFeedbackNotes]=useState([]);
  const [clockedIn,setClockedIn]=useState(()=>{try{return JSON.parse(localStorage.getItem("yarden_clockin")||"null")}catch{return null}});
  const [newSession,setNewSession]=useState({date:today(),startTime:"16:30",endTime:"20:00",parking:0,other:0});
  const [newAirport,setNewAirport]=useState({date:today(),airport:"Brussels",parking:0});
  const [newPayment,setNewPayment]=useState({date:today(),amount:""});

  useEffect(()=>{
    async function load(){
      try{
        const[s,a,p]=await Promise.all([loadCol("sessions"),loadCol("airports"),loadCol("payments")]);
        setSessions(s.sort((a,b)=>a.date.localeCompare(b.date)));
        setAirports(a.sort((a,b)=>a.date.localeCompare(b.date)));
        setPayments(p.sort((a,b)=>a.date.localeCompare(b.date)));
        // load feedback
        const fb=await loadCol("feedback");
        if(fb.length>0){
          const notes=fb[0].notes||[];
          setFeedbackNotes(notes);
        }
      }catch(e){console.error(e);}
      setLoading(false);
    }
    load();
  },[]);

  const totalEarned=sessions.reduce((s,x)=>s+x.earned,0)+airports.reduce((s,x)=>s+x.earned,0);
  const totalExpenses=sessions.reduce((s,x)=>s+(x.gas||0)+(x.parking||0)+(x.other||0),0)+airports.reduce((s,x)=>s+(x.gas||0)+(x.parking||0),0);
  const totalPaid=payments.reduce((s,x)=>s+x.amount,0);
  const balance=totalEarned+totalExpenses-totalPaid;

  async function saveFeedback(notes){
    setFeedbackNotes(notes);
    try{
      await setDoc(doc(db,"feedback","main"),{notes});
    }catch(e){console.error(e);}
  }

  function clockIn(){
    const now=new Date();
    const hh=String(now.getHours()).padStart(2,"0");
    const mm=String(now.getMinutes()).padStart(2,"0");
    const d=now.toISOString().split("T")[0];
    const ci={date:d,startTime:`${hh}:${mm}`};
    setClockedIn(ci);
    localStorage.setItem("yarden_clockin",JSON.stringify(ci));
    setNewSession(p=>({...p,date:d,startTime:`${hh}:${mm}`,endTime:""}));
    setTab("hours");
  }

  function clockOut(){
    const now=new Date();
    const hh=String(now.getHours()).padStart(2,"0");
    const mm=String(now.getMinutes()).padStart(2,"0");
    setNewSession(p=>({...p,endTime:`${hh}:${mm}`}));
    setClockedIn(null);
    localStorage.removeItem("yarden_clockin");
    setTab("hours");
  }

  async function addSession(){
    const[sh,sm]=newSession.startTime.split(":").map(Number);
    const[eh,em]=newSession.endTime.split(":").map(Number);
    const hrs=((eh*60+em)-(sh*60+sm))/60;
    if(hrs<=0)return;
    const rate=rateForDate(newSession.date);
    const data={date:newSession.date,startTime:newSession.startTime,endTime:newSession.endTime,hours:+hrs.toFixed(4),km:0,gas:0,parking:+newSession.parking,other:+newSession.other,earned:+(hrs*rate).toFixed(4),rate};
    const item=await addItem("sessions",data);
    setSessions(prev=>[...prev,item].sort((a,b)=>a.date.localeCompare(b.date)));
    setNewSession(p=>({...p,date:today(),parking:0,other:0,endTime:"20:00"}));
  }

  async function saveEdit(updated){const{id,...data}=updated;await updateItem("sessions",id,data);setSessions(prev=>prev.map(x=>x.id===id?updated:x).sort((a,b)=>a.date.localeCompare(b.date)));setEditingSession(null);}
  async function saveAirportEdit(updated){const{id,...data}=updated;await updateItem("airports",id,data);setAirports(prev=>prev.map(x=>x.id===id?updated:x).sort((a,b)=>a.date.localeCompare(b.date)));setEditingAirport(null);}
  async function savePaymentEdit(updated){const{id,...data}=updated;await updateItem("payments",id,data);setPayments(prev=>prev.map(x=>x.id===id?updated:x).sort((a,b)=>a.date.localeCompare(b.date)));setEditingPayment(null);}

  async function addAirport(){
    const info=AIRPORTS[newAirport.airport]||AIRPORTS.Brussels;
    const data={date:newAirport.date,airport:newAirport.airport,parking:+newAirport.parking,gas:+(info.km*FUEL_PER_KM).toFixed(4),earned:info.earned};
    const item=await addItem("airports",data);
    setAirports(prev=>[...prev,item].sort((a,b)=>a.date.localeCompare(b.date)));
    setNewAirport(p=>({...p,date:today(),parking:0}));
  }

  async function addPayment(){
    if(!newPayment.amount)return;
    const data={date:newPayment.date,amount:+newPayment.amount};
    const item=await addItem("payments",data);
    setPayments(prev=>[...prev,item].sort((a,b)=>a.date.localeCompare(b.date)));
    setNewPayment(p=>({...p,date:today(),amount:""}));
  }

  async function deleteItem(type,id){
    const col=type==="session"?"sessions":type==="airport"?"airports":"payments";
    await deleteItem_db(col,id);
    if(type==="session")setSessions(p=>p.filter(x=>x.id!==id));
    if(type==="airport")setAirports(p=>p.filter(x=>x.id!==id));
    if(type==="payment")setPayments(p=>p.filter(x=>x.id!==id));
  }

  const recentSessions=[...sessions].reverse().slice(0,10);
  const recentAirports=[...airports].reverse().slice(0,10);
  const allPayments=[...payments].reverse();
  const tabs=[["dashboard","🏠"],["hours","⏰"],["airport","✈️"],["payment","💰"],["analytics","📊"]];
  const tabLabels={dashboard:"Home",hours:"Hours",airport:"Airport",payment:"Payment",analytics:"Analytics"};

  if(loading)return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#fdf5f8",flexDirection:"column",gap:16}}>
      <DogSVG size={64} style={{animation:"spin 2s linear infinite"}}/>
      <p style={{color:"#c9a0b0",fontFamily:"DM Sans,sans-serif",fontSize:15}}>Loading... 🐾</p>
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
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <button style={S.feedbackBtn} onClick={()=>setShowFeedback(true)}>💬</button>
          </div>
        </div>
      </header>

      {clockedIn&&<ClockBanner clockedIn={clockedIn} clockOut={clockOut} onReset={()=>{setClockedIn(null);localStorage.removeItem("yarden_clockin");}}/>}

      <main style={S.main}>
        {tab==="dashboard"&&<Dashboard sessions={sessions} airports={airports} payments={payments} totalEarned={totalEarned} totalExpenses={totalExpenses} totalPaid={totalPaid} balance={balance} recentSessions={recentSessions} recentAirports={recentAirports} allPayments={allPayments} showHistory={showHistory} setShowHistory={setShowHistory} deleteItem={deleteItem} setEditingSession={setEditingSession} setEditingAirport={setEditingAirport} setEditingPayment={setEditingPayment}/>}
        {tab==="hours"&&<LogHours newSession={newSession} setNewSession={setNewSession} addSession={addSession} recentSessions={recentSessions} allSessions={sessions} deleteItem={deleteItem} setEditingSession={setEditingSession} clockedIn={clockedIn} clockIn={clockIn} clockOut={clockOut}/>}
        {tab==="airport"&&<LogAirport newAirport={newAirport} setNewAirport={setNewAirport} addAirport={addAirport} recentAirports={recentAirports} allAirports={airports} deleteItem={deleteItem} setEditingAirport={setEditingAirport}/>}
        {tab==="payment"&&<LogPayment newPayment={newPayment} setNewPayment={setNewPayment} addPayment={addPayment} allPayments={allPayments} deleteItem={deleteItem} setEditingPayment={setEditingPayment}/>}
        {tab==="analytics"&&<Analytics sessions={sessions} airports={airports} payments={payments} totalEarned={totalEarned} totalExpenses={totalExpenses} totalPaid={totalPaid}/>}
      </main>

      {/* bottom nav */}
      <nav style={S.bottomNav}>
        {tabs.map(([id,icon])=>(
          <button key={id} style={{...S.bottomNavBtn,...(tab===id?S.bottomNavActive:{})}} onClick={()=>setTab(id)}>
            <span style={{fontSize:20}}>{icon}</span>
            <span style={{fontSize:10,fontWeight:600}}>{tabLabels[id]}</span>
          </button>
        ))}
      </nav>

      <QuickLogFAB quickLog={quickLog} setQuickLog={setQuickLog} newSession={newSession} setNewSession={setNewSession} addSession={async()=>{await addSession();setQuickLog(null);}} newAirport={newAirport} setNewAirport={setNewAirport} addAirport={async()=>{await addAirport();setQuickLog(null);}} clockedIn={clockedIn} clockIn={clockIn} clockOut={clockOut} setClockedIn={setClockedIn}/>

      {editingSession&&<EditModal session={editingSession} onSave={saveEdit} onClose={()=>setEditingSession(null)}/>}
      {editingAirport&&<EditAirportModal airport={editingAirport} onSave={saveAirportEdit} onClose={()=>setEditingAirport(null)}/>}
      {editingPayment&&<EditPaymentModal payment={editingPayment} onSave={savePaymentEdit} onClose={()=>setEditingPayment(null)}/>}
      {showFeedback&&<FeedbackModal notes={feedbackNotes} onSave={saveFeedback} onClose={()=>setShowFeedback(false)}/>}
    </div>
  );
}

function ClockBanner({clockedIn,clockOut,onReset}){
  const[elapsed,setElapsed]=useState("");
  useEffect(()=>{
    function tick(){const[h,m]=clockedIn.startTime.split(":").map(Number);const start=new Date();start.setHours(h,m,0,0);const diff=Math.max(0,Math.floor((new Date()-start)/1000));const hh=String(Math.floor(diff/3600)).padStart(2,"0");const mm=String(Math.floor((diff%3600)/60)).padStart(2,"0");const ss=String(diff%60).padStart(2,"0");setElapsed(`${hh}:${mm}:${ss}`);}
    tick();const id=setInterval(tick,1000);return()=>clearInterval(id);
  },[clockedIn]);
  return(
    <div style={{background:"linear-gradient(135deg,#5db887,#a8d4f5)",padding:"10px 16px",display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:6}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{fontSize:20}}>⏱</span>
        <div><div style={{color:"white",fontWeight:800,fontSize:14}}>Working since {clockedIn.startTime}</div><div style={{color:"rgba(255,255,255,0.85)",fontSize:12,fontFamily:"monospace"}}>{elapsed}</div></div>
      </div>
      <div style={{display:"flex",gap:6}}>
        <button style={{background:"white",color:"#5db887",border:"none",borderRadius:8,padding:"6px 14px",fontWeight:800,fontSize:13,cursor:"pointer"}} onClick={clockOut}>⏹ Clock out</button>
        <button style={{background:"rgba(255,255,255,0.25)",color:"white",border:"1px solid rgba(255,255,255,0.4)",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}} onClick={onReset}>Reset</button>
      </div>
    </div>
  );
}

function Dashboard({sessions,airports,payments,totalEarned,totalExpenses,totalPaid,balance,recentSessions,recentAirports,allPayments,showHistory,setShowHistory,deleteItem,setEditingSession,setEditingAirport,setEditingPayment}){
  // monthly calculations
  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth()-1, 1);
  const lastMonthKey = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth()+1).padStart(2,"0")}`;

  function monthNet(k) {
    const se = sessions.filter(s=>s.date.startsWith(k)).reduce((s,x)=>s+(x.earned||0)+(x.gas||0)+(x.parking||0)+(x.other||0),0);
    const ae = airports.filter(a=>a.date.startsWith(k)).reduce((s,x)=>s+(x.earned||0)+(x.gas||0)+(x.parking||0),0);
    return se+ae;
  }
  function monthHours(k) { return sessions.filter(s=>s.date.startsWith(k)).reduce((s,x)=>s+x.hours,0); }

  const allMonthKeys = [...new Set([...sessions.map(s=>s.date.slice(0,7)),...airports.map(a=>a.date.slice(0,7))])].sort();
  const completeKeys = allMonthKeys.filter(k=>k<thisMonthKey);
  const last3 = completeKeys.slice(-3);
  const avg3 = last3.length ? last3.reduce((s,k)=>s+monthNet(k),0)/last3.length : 0;

  const earnedThis = monthNet(thisMonthKey);
  const hoursThis = monthHours(thisMonthKey);
  const earnedLast = monthNet(lastMonthKey);
  const hoursLast = monthHours(lastMonthKey);
  const avgHours3 = last3.length ? last3.reduce((s,k)=>s+monthHours(k),0)/last3.length : 0;

  return(
    <div>
      <div style={{background:"white",borderRadius:14,padding:"12px 16px",marginBottom:14,border:`2px solid ${balance<0?"#ffe0b0":"#fce7f0"}`,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div>
          <span style={{fontSize:12,color:"#c9a0b0",textTransform:"uppercase",letterSpacing:1,fontWeight:700}}>{balance<0?"Overpaid":"Still owed"}</span>
          {balance<0&&<div style={{fontSize:11,color:"#b87a30",marginTop:2}}>Boss paid €{Math.abs(balance).toFixed(2)} too much</div>}
        </div>
        <span style={{fontSize:24,fontWeight:800,color:balance<0?"#b87a30":balance>50?"#e8527a":"#7ec8a0"}}>{fmtEuro(Math.abs(balance))}</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
        <MonthCard label="This month" value={fmtEuro(earnedThis)} sub={`${hoursThis.toFixed(1)}h worked`} accent={C.pink}/>
        <MonthCard label="Last month" value={fmtEuro(earnedLast)} sub={`${hoursLast.toFixed(1)}h worked`} accent={C.blue}/>
        <MonthCard label="Avg 3 months" value={fmtEuro(avg3)} sub={`avg ${avgHours3.toFixed(1)}h/month`} accent={C.green}/>
      </div>
      <Sect title="📋 Recent Activity">
        <RecentActivity sessions={recentSessions} airports={recentAirports} payments={allPayments.slice(0,5)} deleteItem={deleteItem} setEditingSession={setEditingSession} setEditingAirport={setEditingAirport} setEditingPayment={setEditingPayment}/>
      </Sect>
    </div>
  );
}

function MonthCard({label,value,sub,accent}){
  return(
    <div style={{background:"white",borderRadius:12,padding:"12px 10px",border:`1.5px solid ${accent}33`,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent}}/>
      <div style={{fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:.5,marginBottom:4}}>{label}</div>
      <div style={{fontSize:16,fontWeight:800,color:accent,lineHeight:1.2}}>{value}</div>
      {sub&&<div style={{fontSize:10,color:"#bbb",marginTop:3}}>{sub}</div>}
    </div>
  );
}

function RecentActivity({sessions,airports,payments,deleteItem,setEditingSession,setEditingAirport,setEditingPayment}){
  // merge and sort all by date descending, take 15 most recent
  const items = [
    ...sessions.map(s=>({...s,_type:"session",_sortDate:s.date+s.startTime})),
    ...airports.map(a=>({...a,_type:"airport",_sortDate:a.date+"00:00"})),
    ...payments.map(p=>({...p,_type:"payment",_sortDate:p.date+"00:00"})),
  ].sort((a,b)=>b._sortDate.localeCompare(a._sortDate)).slice(0,15);

  if(!items.length) return <p style={S.empty}>No activity yet 🐾</p>;

  return(
    <div style={S.list}>
      {items.map(item=>{
        if(item._type==="session"){
          const exp=[];
          if(item.parking>0)exp.push(`🅿️ €${item.parking.toFixed(2)}`);
          if(item.other>0)exp.push(`📦 €${item.other.toFixed(2)}`);
          return(
            <div key={item.id+"s"} style={S.listItem}>
              <div style={{...S.listLeft,gap:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,background:"#fce7f0",color:"#b5476a",borderRadius:6,padding:"1px 7px",fontWeight:700}}>Session</span><span style={S.listDate}>{fmtDate(new Date(item.date))}</span></div>
                <span style={S.listSub}>{item.startTime} – {item.endTime} · {item.hours.toFixed(2)}h</span>
                {exp.length>0&&<span style={{fontSize:10,color:"#c9a0b0"}}>{exp.join("  ")}</span>}
              </div>
              <div style={S.listRight}>
                <span style={{...S.listAmt,color:C.green}}>{fmtEuro(item.earned)}</span>
                <button style={S.editBtn} onClick={()=>setEditingSession(item)}>✏️</button>
                <button style={S.deleteBtn} onClick={()=>deleteItem("session",item.id)}>✕</button>
              </div>
            </div>
          );
        }
        if(item._type==="airport"){
          return(
            <div key={item.id+"a"} style={S.listItem}>
              <div style={{...S.listLeft,gap:1}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,background:"#e8f4ff",color:"#2a5c8a",borderRadius:6,padding:"1px 7px",fontWeight:700}}>Airport</span><span style={S.listDate}>{fmtDate(new Date(item.date))}</span></div>
                <span style={S.listSub}>{item.airport}{item.parking>0?` · 🅿️ €${item.parking.toFixed(2)}`:""}</span>
              </div>
              <div style={S.listRight}>
                <span style={{...S.listAmt,color:C.blue}}>{fmtEuro(item.earned)}</span>
                <button style={S.editBtn} onClick={()=>setEditingAirport(item)}>✏️</button>
                <button style={S.deleteBtn} onClick={()=>deleteItem("airport",item.id)}>✕</button>
              </div>
            </div>
          );
        }
        // payment
        return(
          <div key={item.id+"p"} style={S.listItem}>
            <div style={{...S.listLeft,gap:1}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{fontSize:11,background:"#f0ecff",color:"#6b48d4",borderRadius:6,padding:"1px 7px",fontWeight:700}}>Payment</span><span style={S.listDate}>{fmtDate(new Date(item.date))}</span></div>
            </div>
            <div style={S.listRight}>
              <span style={{...S.listAmt,color:"#a78bfa"}}>{fmtEuro(item.amount)}</span>
              <button style={S.editBtn} onClick={()=>setEditingPayment(item)}>✏️</button>
              <button style={S.deleteBtn} onClick={()=>deleteItem("payment",item.id)}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LogHours({newSession,setNewSession,addSession,recentSessions,allSessions,deleteItem,setEditingSession,clockedIn,clockIn,clockOut}){
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
        <div style={{marginBottom:16}}><h2 style={S.cardTitle}>Log Working Hours</h2></div>
        {!clockedIn?(
          <button style={{...S.primaryBtn,marginBottom:14,background:"linear-gradient(135deg,#f4a7bb,#f9c8d4)",fontSize:14}} onClick={clockIn}>⏱ Clock in — I'm starting work</button>
        ):(
          <div style={{marginBottom:14,display:"flex",flexDirection:"column",gap:8}}>
            <div style={{background:"#fff0f5",borderRadius:10,padding:"10px 14px",fontSize:13,color:"#b5476a",border:"1px solid #fce7f0"}}>✅ Clocked in at <strong>{clockedIn.startTime}</strong></div>
            <button style={{...S.primaryBtn,background:"linear-gradient(135deg,#5db887,#a8d4f5)",fontSize:14}} onClick={clockOut}>⏹ Clock out — fill end time</button>
          </div>
        )}
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newSession.date} onChange={e=>setNewSession(p=>({...p,date:e.target.value}))}/></Field>
          <Field label="🕐 Start"><input style={S.input} type="time" value={newSession.startTime} onChange={e=>setNewSession(p=>({...p,startTime:e.target.value}))}/></Field>
          <Field label="🕔 End"><input style={S.input} type="time" value={newSession.endTime} onChange={e=>setNewSession(p=>({...p,endTime:e.target.value}))}/></Field>
          <Field label="⏱ Hours"><div style={{...S.input,background:"#fce7f0",color:"#b5476a",fontWeight:700}}>{hrs>0?`${hrs.toFixed(2)} hrs`:"—"}</div></Field>
          <Field label="🅿️ Parking (€)"><input style={S.input} type="number" min="0" step="0.01" value={newSession.parking} onChange={e=>setNewSession(p=>({...p,parking:e.target.value}))}/></Field>
          <Field label="📦 Other (€)"><input style={S.input} type="number" min="0" step="0.01" value={newSession.other} onChange={e=>setNewSession(p=>({...p,other:e.target.value}))}/></Field>
        </div>
        <div style={S.preview}><span>{hrs.toFixed(2)} hrs × €{rate}/hr</span><span style={S.previewAmt}>{fmtEuro(hrs*rate)}</span></div>
        <button style={{...S.primaryBtn,opacity:hrs>0?1:0.5}} onClick={addSession} disabled={hrs<=0}>Add Session 🐾</button>
      </div>
      <Sect title={showAll?`All Sessions (${filtered.length})`:"Recent Sessions"}>
        <div style={{display:"flex",gap:8,alignItems:"center",marginBottom:10,flexWrap:"wrap"}}>
          <button style={{...S.toggleBtn,...(showAll?{background:"#fce7f0",color:"#b5476a",borderColor:"#f4a7bb"}:{})}} onClick={()=>{setShowAll(p=>!p);setFilterMonth("");}}>
            {showAll?"▲ Recent only":`▼ All ${allSessions.length} sessions`}
          </button>
          {showAll&&<select style={{...S.input,width:"auto",fontSize:12,padding:"6px 10px"}} value={filterMonth} onChange={e=>setFilterMonth(e.target.value)}><option value="">All months</option>{months.map(m=>{const[y,mo]=m.split("-");return<option key={m} value={m}>{new Date(+y,+mo-1,1).toLocaleDateString("en",{month:"long",year:"numeric"})}</option>;})}</select>}
        </div>
        <SessionList sessions={displayed} deleteItem={deleteItem} setEditingSession={setEditingSession}/>
      </Sect>
    </div>
  );
}

function LogAirport({newAirport,setNewAirport,addAirport,recentAirports,allAirports,deleteItem,setEditingAirport}){
  const info=AIRPORTS[newAirport.airport]||AIRPORTS.Brussels;
  const [showAll,setShowAll]=useState(false);
  const displayed=showAll?[...allAirports].reverse():recentAirports;
  return(
    <div>
      <div style={S.card}>
        <div style={{marginBottom:16}}><h2 style={S.cardTitle}>Log Airport Trip ✈️</h2></div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newAirport.date} onChange={e=>setNewAirport(p=>({...p,date:e.target.value}))}/></Field>
          <Field label="🛫 Airport"><select style={S.input} value={newAirport.airport} onChange={e=>setNewAirport(p=>({...p,airport:e.target.value}))}>{Object.keys(AIRPORTS).map(a=><option key={a}>{a}</option>)}</select></Field>
          <Field label="🅿️ Parking (€)"><input style={S.input} type="number" min="0" step="0.01" value={newAirport.parking} onChange={e=>setNewAirport(p=>({...p,parking:e.target.value}))}/></Field>
        </div>
        <div style={S.preview}><span>{newAirport.airport} Airport</span><span style={S.previewAmt}>{fmtEuro(info.earned)}</span></div>
        <button style={S.primaryBtn} onClick={addAirport}>Add Trip 🐾</button>
      </div>
      <Sect title={showAll?`All Trips (${allAirports.length})`:"Recent Trips"}>
        <button style={{...S.toggleBtn,...(showAll?{background:"#fce7f0",color:"#b5476a",borderColor:"#f4a7bb"}:{})}} onClick={()=>setShowAll(p=>!p)}>
          {showAll?"▲ Recent only":`▼ All ${allAirports.length} trips`}
        </button>
        <AirportList airports={displayed} deleteItem={deleteItem} setEditingAirport={setEditingAirport}/>
      </Sect>
    </div>
  );
}

function LogPayment({newPayment,setNewPayment,addPayment,allPayments,deleteItem,setEditingPayment}){
  const [showHistory, setShowHistory] = useState(true);
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

function Analytics({sessions,airports,payments,totalEarned,totalExpenses,totalPaid}){
  const[monthView,setMonthView]=useState("earned");
  const now=new Date();
  const thisMonth=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  function mk(d){return d.slice(0,7);}
  const monthEarned={},monthHours={};
  sessions.forEach(s=>{const k=mk(s.date);monthEarned[k]=(monthEarned[k]||0)+(s.earned||0)+(s.gas||0)+(s.parking||0)+(s.other||0);monthHours[k]=(monthHours[k]||0)+s.hours;});
  airports.forEach(a=>{const k=mk(a.date);monthEarned[k]=(monthEarned[k]||0)+(a.earned||0)+(a.gas||0)+(a.parking||0);});
  const allKeys=Object.keys(monthEarned).sort();
  const completeKeys=allKeys.filter(k=>k<thisMonth);
  function lm(k){const[y,m]=k.split("-");return new Date(+y,+m-1,1).toLocaleDateString("en",{month:"long",year:"numeric"});}
  function smy(k){const[y,m]=k.split("-");return new Date(+y,+m-1,1).toLocaleDateString("en",{month:"short",year:"2-digit"});}
  const bestKey=completeKeys.length?completeKeys.reduce((a,b)=>monthEarned[a]>monthEarned[b]?a:b):"";
  const worstKey=completeKeys.length?completeKeys.reduce((a,b)=>monthEarned[a]<monthEarned[b]?a:b):"";
  const mostHrsKey=completeKeys.length?completeKeys.reduce((a,b)=>(monthHours[a]||0)>(monthHours[b]||0)?a:b):"";
  const leastHrsKey=completeKeys.length?completeKeys.reduce((a,b)=>(monthHours[a]||0)<(monthHours[b]||0)?a:b):"";
  function avgC(n){const l=completeKeys.slice(-n);return l.length?l.reduce((s,k)=>s+(monthEarned[k]||0),0)/l.length:0;}
  const earnedThis=monthEarned[thisMonth]||0,hoursThis=monthHours[thisMonth]||0;
  const avg3=avgC(3),avg6=avgC(6),avg12=avgC(12);
  const avgAll=completeKeys.length?completeKeys.reduce((s,k)=>s+(monthEarned[k]||0),0)/completeKeys.length:0;
  const sinceRaise=completeKeys.filter(k=>k>="2025-09");
  const avgRaise=sinceRaise.length?sinceRaise.reduce((s,k)=>s+(monthEarned[k]||0),0)/sinceRaise.length:0;
  const totalHours=sessions.reduce((s,x)=>s+x.hours,0);
  const sp=[...payments].sort((a,b)=>a.date.localeCompare(b.date));
  let avgGap=0;if(sp.length>1){const gaps=sp.slice(1).map((p,i)=>(new Date(p.date)-new Date(sp[i].date))/86400000);avgGap=gaps.reduce((a,b)=>a+b,0)/gaps.length;}
  const wdc=[0,0,0,0,0,0,0];sessions.forEach(s=>{wdc[new Date(s.date).getDay()]++;});
  const busyDay=["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][wdc.indexOf(Math.max(...wdc))];
  const last6=completeKeys.slice(-6);
  const chartData=monthView==="earned"?monthEarned:monthHours;
  const maxVal=Math.max(...last6.map(k=>chartData[k]||0),1);
  const ts={border:"1px solid #fce7f0",borderRadius:8,padding:"4px 10px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"};
  return(
    <div>
      <div style={{...S.card,background:"linear-gradient(135deg,#fff0f5 0%,#f0f8ff 100%)",border:"1.5px solid #f9c8d4"}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}><h2 style={{...S.cardTitle,color:"#b5476a"}}>Earnings Stats 📊</h2></div>
        <p style={{color:"#c97a94",fontSize:13,margin:"0 0 16px"}}>All the numbers! 🐾</p>
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
        <div style={{background:"white",borderRadius:14,padding:"14px",marginBottom:14,border:"1px solid #fce7f0"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
            <span style={{fontSize:11,color:"#c97a94",fontWeight:700}}>LAST 6 COMPLETE MONTHS</span>
            <div style={{display:"flex",gap:4}}>
              <button onClick={()=>setMonthView("earned")} style={{...ts,background:monthView==="earned"?"#f9c8d4":"transparent",color:monthView==="earned"?"#b5476a":"#c9a0b0"}}>€</button>
              <button onClick={()=>setMonthView("hours")} style={{...ts,background:monthView==="hours"?"#c4dff5":"transparent",color:monthView==="hours"?"#2a5c8a":"#c9a0b0"}}>⏱</button>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"flex-end",gap:4,height:90}}>
            {last6.map(k=>{const val=chartData[k]||0;const bh=Math.max(4,(val/maxVal)*70);const lbl=monthView==="earned"?fmtEuro(val):val.toFixed(1)+"h";return(<div key={k} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2}}><span style={{fontSize:7,color:"#b5476a",fontWeight:700,textAlign:"center",lineHeight:1.2}}>{lbl}</span><div style={{width:"100%",background:monthView==="earned"?`linear-gradient(180deg,${C.pink},#f4a7bb)`:`linear-gradient(180deg,${C.blue},#a8d4f5)`,borderRadius:"4px 4px 0 0",height:bh}}/><span style={{fontSize:7,color:"#c97a94",fontWeight:600,textAlign:"center"}}>{smy(k)}</span></div>);})}
          </div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
          <FunFact icon="🏆" label="Best month" value={bestKey?lm(bestKey):"—"} sub={bestKey?fmtEuro(monthEarned[bestKey]):""}/>
          <FunFact icon="📉" label="Quietest" value={worstKey?lm(worstKey):"—"} sub={worstKey?fmtEuro(monthEarned[worstKey]):""}/>
          <FunFact icon="⏰" label="Most hours" value={mostHrsKey?lm(mostHrsKey):"—"} sub={mostHrsKey?(monthHours[mostHrsKey]||0).toFixed(1)+"h":""}/>
          <FunFact icon="📅" label="Busiest day" value={busyDay} sub="most sessions"/>
        </div>
        <div style={{background:"white",borderRadius:14,padding:14,border:"1px solid #fce7f0"}}>
          <div style={{fontSize:11,color:"#c97a94",fontWeight:700,marginBottom:10}}>📋 MONTHLY OVERVIEW</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",fontSize:11,color:"#c9a0b0",fontWeight:700,paddingBottom:6,borderBottom:"1px solid #fce7f0",marginBottom:4}}>
            <span>Month</span><span style={{textAlign:"right"}}>Hours</span><span style={{textAlign:"right"}}>Earned</span>
          </div>
          <div style={{maxHeight:280,overflowY:"auto"}}>
            {[...allKeys].reverse().map(k=>{const isThis=k===thisMonth;return(<div key={k} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",padding:"5px 0",borderBottom:"1px solid #fdf5f8",background:isThis?"#fff7fa":"transparent"}}><span style={{fontSize:11,fontWeight:isThis?700:500,color:isThis?"#b5476a":"#3a2a35"}}>{lm(k)}{isThis?" ★":""}</span><span style={{fontSize:11,textAlign:"right",color:"#7a6a70"}}>{(monthHours[k]||0).toFixed(1)}h</span><span style={{fontSize:11,textAlign:"right",fontWeight:600,color:C.green}}>{fmtEuro(monthEarned[k]||0)}</span></div>);})}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionList({sessions,deleteItem,setEditingSession}){
  if(!sessions.length)return<p style={S.empty}>No sessions yet 🐾</p>;
  return(<div style={S.list}>{sessions.map(s=>{const exp=[];if(s.parking>0)exp.push(`🅿️ €${s.parking.toFixed(2)}`);if(s.other>0)exp.push(`📦 €${s.other.toFixed(2)}`);if(s.gas>0)exp.push(`⛽ €${s.gas.toFixed(2)}`);return(<div key={s.id} style={S.listItem}><div style={S.listLeft}><span style={S.listDate}>{fmtDate(new Date(s.date))}</span><span style={S.listSub}>{s.startTime} – {s.endTime} · {s.hours.toFixed(2)}h</span>{exp.length>0&&<span style={{fontSize:10,color:"#c9a0b0",marginTop:1}}>{exp.join("  ")}</span>}</div><div style={S.listRight}><span style={{...S.listAmt,color:C.green}}>{fmtEuro(s.earned)}</span><button style={S.editBtn} onClick={()=>setEditingSession(s)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("session",s.id)}>✕</button></div></div>);})}</div>);
}

function AirportList({airports,deleteItem,setEditingAirport}){
  if(!airports.length)return<p style={S.empty}>No trips yet 🛫</p>;
  return(<div style={S.list}>{airports.map(a=>(<div key={a.id} style={S.listItem}><div style={S.listLeft}><span style={S.listDate}>{fmtDate(new Date(a.date))}</span><span style={S.listSub}>{a.airport} Airport{a.parking>0?` · 🅿️ €${a.parking.toFixed(2)}`:""}</span></div><div style={S.listRight}><span style={{...S.listAmt,color:C.blue}}>{fmtEuro(a.earned)}</span><button style={S.editBtn} onClick={()=>setEditingAirport(a)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("airport",a.id)}>✕</button></div></div>))}</div>);
}

function PaymentList({payments,deleteItem,setEditingPayment}){
  if(!payments.length)return<p style={S.empty}>No payments yet 💸</p>;
  return(<div style={S.list}>{payments.map(p=>(<div key={p.id} style={S.listItem}><div style={S.listLeft}><span style={S.listDate}>{fmtDate(new Date(p.date))}</span></div><div style={S.listRight}><span style={{...S.listAmt,color:C.blue}}>{fmtEuro(p.amount)}</span><button style={S.editBtn} onClick={()=>setEditingPayment(p)}>✏️</button><button style={S.deleteBtn} onClick={()=>deleteItem("payment",p.id)}>✕</button></div></div>))}</div>);
}

function EditModal({session,onSave,onClose}){
  const[form,setForm]=useState({...session});
  function ch(s,e){if(!s||!e)return 0;const[sh,sm]=s.split(":").map(Number);const[eh,em]=e.split(":").map(Number);return Math.max(0,((eh*60+em)-(sh*60+sm))/60);}
  const hrs=ch(form.startTime,form.endTime);const rate=rateForDate(form.date);
  return(<div style={S.overlay}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#b5476a",fontSize:16,fontWeight:800}}>✏️ Edit Session</h3><button style={S.closeBtn} onClick={onClose}>✕</button></div><div style={S.formGrid}><Field label="📅 Date"><input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></Field><Field label="🕐 Start"><input style={S.input} type="time" value={form.startTime} onChange={e=>setForm(p=>({...p,startTime:e.target.value}))}/></Field><Field label="🕔 End"><input style={S.input} type="time" value={form.endTime} onChange={e=>setForm(p=>({...p,endTime:e.target.value}))}/></Field><Field label="⏱ Hours"><div style={{...S.input,background:"#fce7f0",color:"#b5476a",fontWeight:700}}>{hrs>0?`${hrs.toFixed(2)} hrs`:"—"}</div></Field><Field label="🅿️ Parking"><input style={S.input} type="number" min="0" step="0.01" value={form.parking} onChange={e=>setForm(p=>({...p,parking:+e.target.value}))}/></Field><Field label="📦 Other"><input style={S.input} type="number" min="0" step="0.01" value={form.other} onChange={e=>setForm(p=>({...p,other:+e.target.value}))}/></Field></div><div style={S.preview}><span>{hrs.toFixed(2)} hrs × €{rate}/hr</span><span style={S.previewAmt}>{fmtEuro(hrs*rate)}</span></div><div style={{display:"flex",gap:8}}><button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button><button style={{...S.primaryBtn,flex:2}} onClick={()=>onSave({...form,hours:hrs,earned:+(hrs*rate).toFixed(4),rate})}>Save 🐾</button></div></div></div>);
}

function EditAirportModal({airport,onSave,onClose}){
  const[form,setForm]=useState({...airport});
  return(<div style={S.overlay}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#b5476a",fontSize:16,fontWeight:800}}>✏️ Edit Airport Trip</h3><button style={S.closeBtn} onClick={onClose}>✕</button></div><div style={S.formGrid}><Field label="📅 Date"><input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></Field><Field label="🛫 Airport"><select style={S.input} value={form.airport} onChange={e=>setForm(p=>({...p,airport:e.target.value}))}>{Object.keys(AIRPORTS).map(a=><option key={a}>{a}</option>)}</select></Field><Field label="🅿️ Parking"><input style={S.input} type="number" min="0" step="0.01" value={form.parking} onChange={e=>setForm(p=>({...p,parking:+e.target.value}))}/></Field><Field label="💶 Earned"><input style={S.input} type="number" min="0" step="0.01" value={form.earned} onChange={e=>setForm(p=>({...p,earned:+e.target.value}))}/></Field></div><div style={S.preview}><span>{form.airport}</span><span style={S.previewAmt}>{fmtEuro((form.earned||0)+(form.parking||0))}</span></div><div style={{display:"flex",gap:8}}><button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button><button style={{...S.primaryBtn,flex:2}} onClick={()=>onSave(form)}>Save 🐾</button></div></div></div>);
}

function EditPaymentModal({payment,onSave,onClose}){
  const[form,setForm]=useState({...payment});
  return(<div style={S.overlay}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#b5476a",fontSize:16,fontWeight:800}}>✏️ Edit Payment</h3><button style={S.closeBtn} onClick={onClose}>✕</button></div><div style={S.formGrid}><Field label="📅 Date"><input style={S.input} type="date" value={form.date} onChange={e=>setForm(p=>({...p,date:e.target.value}))}/></Field><Field label="💶 Amount"><input style={S.input} type="number" min="0" step="0.01" value={form.amount} onChange={e=>setForm(p=>({...p,amount:+e.target.value}))}/></Field></div><div style={{display:"flex",gap:8,marginTop:8}}><button style={{...S.primaryBtn,background:"#e8f5f0",color:"#3a8a6a",flex:1}} onClick={onClose}>Cancel</button><button style={{...S.primaryBtn,flex:2}} onClick={()=>onSave(form)}>Save 🐾</button></div></div></div>);
}

const STATUS_STYLES={open:{bg:"#fff7fa",color:"#b5476a",border:"#fce7f0",label:"Open"},done:{bg:"#f0fff4",color:"#3a8a6a",border:"#c6f0d8",label:"✅ Done"},wontdo:{bg:"#f5f5f5",color:"#888",border:"#ddd",label:"🚫 Won't do"},cancel:{bg:"#fff8f0",color:"#b87a30",border:"#ffe0b0",label:"❌ Cancelled"}};

function FeedbackModal({notes,onSave,onClose}){
  const[items,setItems]=useState(notes);
  const[newText,setNewText]=useState("");
  const[newAuthor,setNewAuthor]=useState("");
  function addNote(){if(!newText.trim())return;setItems(prev=>[...prev,{id:Date.now(),text:newText.trim(),author:newAuthor.trim()||"Anonymous",status:"open",date:new Date().toISOString().split("T")[0]}]);setNewText("");setNewAuthor("");}
  function setStatus(id,status){setItems(prev=>prev.map(x=>x.id===id?{...x,status}:x));}
  function deleteNote(id){setItems(prev=>prev.filter(x=>x.id!==id));}
  return(<div style={S.overlay}><div style={{...S.modal,width:"min(560px,95vw)",maxHeight:"85vh",display:"flex",flexDirection:"column"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#b5476a",fontSize:16,fontWeight:800}}>💬 Feedback & Ideas</h3><button style={S.closeBtn} onClick={()=>{onSave(items);onClose();}}>✕</button></div><div style={{background:"#fdf5f8",borderRadius:12,padding:12,marginBottom:14,border:"1px solid #fce7f0"}}><textarea style={{...S.input,minHeight:60,resize:"vertical",marginBottom:8}} placeholder="Describe your feedback..." value={newText} onChange={e=>setNewText(e.target.value)}/><div style={{display:"flex",gap:8}}><input style={{...S.input,flex:1}} placeholder="Your name (optional)" value={newAuthor} onChange={e=>setNewAuthor(e.target.value)}/><button style={{...S.primaryBtn,width:"auto",padding:"9px 16px",fontSize:13}} onClick={addNote}>Add</button></div></div><div style={{overflowY:"auto",flex:1,display:"flex",flexDirection:"column",gap:8}}>{items.length===0&&<p style={S.empty}>No feedback yet 🐾</p>}{[...items].reverse().map(item=>{const st=STATUS_STYLES[item.status]||STATUS_STYLES.open;return(<div key={item.id} style={{background:st.bg,borderRadius:10,padding:"10px 12px",border:`1px solid ${st.border}`}}><div style={{display:"flex",justifyContent:"space-between",gap:8}}><div style={{flex:1}}><p style={{margin:"0 0 4px",fontSize:13,color:"#3a2a35"}}>{item.text}</p><span style={{fontSize:10,color:"#c9a0b0"}}>{item.author} · {item.date}</span></div><button style={S.deleteBtn} onClick={()=>deleteNote(item.id)}>✕</button></div><div style={{display:"flex",gap:4,marginTop:8,flexWrap:"wrap"}}>{Object.entries(STATUS_STYLES).map(([key,val])=>(<button key={key} onClick={()=>setStatus(item.id,key)} style={{padding:"2px 8px",borderRadius:6,border:`1px solid ${val.border}`,background:item.status===key?val.bg:"white",color:item.status===key?val.color:"#aaa",fontSize:10,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>{val.label}</button>))}</div></div>);})}</div><button style={{...S.primaryBtn,marginTop:14}} onClick={()=>{onSave(items);onClose();}}>Save & Close 🐾</button></div></div>);
}

function QuickLogFAB({quickLog,setQuickLog,newSession,setNewSession,addSession,newAirport,setNewAirport,addAirport,clockedIn,clockIn,clockOut,setClockedIn}){
  if(quickLog==="hours"){
    const[sh,sm]=newSession.startTime.split(":").map(Number);const[eh,em]=(newSession.endTime||"00:00").split(":").map(Number);
    const hrs=Math.max(0,((eh*60+em)-(sh*60+sm))/60);const rate=rateForDate(newSession.date);
    return(<div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setQuickLog(null);}}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#b5476a",fontSize:16,fontWeight:800}}>⏰ Quick Log Hours</h3><button style={S.closeBtn} onClick={()=>setQuickLog(null)}>✕</button></div><div style={S.formGrid}><Field label="📅 Date"><input style={S.input} type="date" value={newSession.date} onChange={e=>setNewSession(p=>({...p,date:e.target.value}))}/></Field><Field label="🕐 Start"><input style={S.input} type="time" value={newSession.startTime} onChange={e=>setNewSession(p=>({...p,startTime:e.target.value}))}/></Field><Field label="🕔 End"><input style={S.input} type="time" value={newSession.endTime} onChange={e=>setNewSession(p=>({...p,endTime:e.target.value}))}/></Field><Field label="⏱ Hours"><div style={{...S.input,background:"#fce7f0",color:"#b5476a",fontWeight:700}}>{hrs>0?`${hrs.toFixed(2)} hrs`:"—"}</div></Field><Field label="🅿️ Parking"><input style={S.input} type="number" min="0" step="0.01" value={newSession.parking} onChange={e=>setNewSession(p=>({...p,parking:e.target.value}))}/></Field><Field label="📦 Other"><input style={S.input} type="number" min="0" step="0.01" value={newSession.other} onChange={e=>setNewSession(p=>({...p,other:e.target.value}))}/></Field></div><div style={S.preview}><span>{hrs.toFixed(2)} hrs × €{rate}/hr</span><span style={S.previewAmt}>{fmtEuro(hrs*rate)}</span></div><button style={S.primaryBtn} onClick={addSession}>Add Session 🐾</button></div></div>);
  }
  if(quickLog==="airport"){
    const info=AIRPORTS[newAirport.airport]||AIRPORTS.Brussels;
    return(<div style={S.overlay} onClick={e=>{if(e.target===e.currentTarget)setQuickLog(null);}}><div style={S.modal}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><h3 style={{margin:0,color:"#b5476a",fontSize:16,fontWeight:800}}>✈️ Quick Log Airport</h3><button style={S.closeBtn} onClick={()=>setQuickLog(null)}>✕</button></div><div style={S.formGrid}><Field label="📅 Date"><input style={S.input} type="date" value={newAirport.date} onChange={e=>setNewAirport(p=>({...p,date:e.target.value}))}/></Field><Field label="🛫 Airport"><select style={S.input} value={newAirport.airport} onChange={e=>setNewAirport(p=>({...p,airport:e.target.value}))}>{Object.keys(AIRPORTS).map(a=><option key={a}>{a}</option>)}</select></Field><Field label="🅿️ Parking"><input style={S.input} type="number" min="0" step="0.01" value={newAirport.parking} onChange={e=>setNewAirport(p=>({...p,parking:e.target.value}))}/></Field></div><div style={S.preview}><span>{newAirport.airport}</span><span style={S.previewAmt}>{fmtEuro(info.earned)}</span></div><button style={S.primaryBtn} onClick={addAirport}>Add Trip 🐾</button></div></div>);
  }
  return(<div style={{position:"fixed",bottom:90,right:16,display:"flex",flexDirection:"column",gap:8,zIndex:500}}>
    {!clockedIn?<button style={{...fabStyle("#5db887","white"),width:44,height:44,fontSize:18,boxShadow:"0 4px 16px rgba(93,184,135,0.5)"}} onClick={clockIn} title="Clock in">⏱</button>:<button style={{...fabStyle("#e8527a","white"),width:44,height:44,fontSize:18,boxShadow:"0 4px 16px rgba(232,82,122,0.5)"}} onClick={clockOut} title="Clock out">⏹</button>}
    <button style={{...fabStyle("#f4a7bb","#b5476a"),width:44,height:44,fontSize:18}} onClick={()=>setQuickLog("hours")} title="Log hours">⏰</button>
  </div>);
}
function fabStyle(bg,color){return{width:48,height:48,borderRadius:"50%",border:"none",background:bg,color,fontSize:20,cursor:"pointer",boxShadow:"0 4px 16px rgba(0,0,0,0.15)",display:"flex",alignItems:"center",justifyContent:"center"};}

function StatCard({label,value,accent,icon}){return(<div style={{...S.statCard,borderTop:`3px solid ${accent}`}}><div style={{fontSize:16,marginBottom:4}}>{icon}</div><div style={{fontSize:10,color:"#c9a0b0",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{label}</div><div style={{fontSize:16,fontWeight:800,color:accent}}>{value}</div></div>);}
function Sect({title,children}){return<div style={{marginBottom:20}}><h3 style={S.sectTitle}>{title}</h3>{children}</div>;}
function Field({label,children}){return<label style={S.label}><span style={{marginBottom:4,display:"block"}}>{label}</span>{children}</label>;}
function FunFact({icon,label,value,sub}){return(<div style={{background:"#fff7fa",borderRadius:12,padding:"10px 12px",border:"1px solid #fce7f0",textAlign:"center"}}><div style={{fontSize:18,marginBottom:3}}>{icon}</div><div style={{fontSize:9,color:"#c97a94",fontWeight:600,textTransform:"uppercase",letterSpacing:.5}}>{label}</div><div style={{fontSize:11,fontWeight:800,color:"#b5476a",marginTop:2,lineHeight:1.3}}>{value}</div>{sub&&<div style={{fontSize:10,color:C.green,fontWeight:700,marginTop:1}}>{sub}</div>}</div>);}
function AnalCard({label,value,accent,note}){return(<div style={{background:"white",borderRadius:12,padding:"12px 14px",border:`1.5px solid ${accent}33`,position:"relative",overflow:"hidden"}}><div style={{position:"absolute",top:0,left:0,right:0,height:3,background:accent}}/><div style={{fontSize:10,color:"#aaa",textTransform:"uppercase",letterSpacing:.5,marginBottom:3}}>{label}</div><div style={{fontSize:18,fontWeight:800,color:accent}}>{value}</div><div style={{fontSize:10,color:"#bbb",marginTop:1}}>{note}</div></div>);}

const C={pink:"#e8527a",blue:"#5b9bd5",green:"#5db887"};
const S={
  root:{minHeight:"100vh",background:"#fdf5f8",color:"#3a2a35",fontFamily:"'DM Sans','Segoe UI',sans-serif",paddingBottom:80},
  header:{background:"linear-gradient(135deg,#fff0f5,#ffe8f5)",borderBottom:"2px solid #fce7f0",padding:"12px 0",position:"sticky",top:0,zIndex:100,boxShadow:"0 2px 12px #f4a7bb22"},
  headerInner:{maxWidth:740,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between"},
  logo:{fontSize:20,fontWeight:800,color:"#b5476a",letterSpacing:.5},
  balancePill:{background:"white",borderRadius:12,padding:"8px 14px",textAlign:"right",border:"2px solid #fce7f0"},
  balanceLabel:{display:"block",fontSize:10,color:"#c9a0b0",letterSpacing:1,textTransform:"uppercase"},
  balanceAmount:{fontSize:18,fontWeight:800},
  main:{maxWidth:740,margin:"0 auto",padding:"16px 12px 0"},
  card:{background:"white",borderRadius:16,padding:16,marginBottom:16,border:"1.5px solid #fce7f0",boxShadow:"0 4px 20px #f4a7bb11"},
  cardTitle:{margin:0,fontSize:16,fontWeight:800,color:"#b5476a"},
  cardRow:{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginBottom:16},
  statCard:{background:"white",borderRadius:12,padding:"12px 10px",border:"1.5px solid #fce7f0"},
  sectTitle:{fontSize:12,fontWeight:700,color:"#c9a0b0",textTransform:"uppercase",letterSpacing:1,margin:"0 0 8px"},
  formGrid:{display:"grid",gridTemplateColumns:"1fr",gap:12,marginBottom:14},
  label:{fontSize:11,color:"#c9a0b0",fontWeight:700,letterSpacing:.3},
  input:{background:"#fdf5f8",border:"1.5px solid #fce7f0",borderRadius:10,padding:"12px 12px",color:"#3a2a35",fontSize:16,outline:"none",width:"100%",boxSizing:"border-box",fontFamily:"inherit",WebkitAppearance:"none"},
  preview:{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#fdf5f8",borderRadius:10,padding:"10px 14px",marginBottom:14,color:"#c9a0b0",fontSize:13,border:"1px dashed #fce7f0"},
  previewAmt:{fontSize:20,fontWeight:800,color:"#5db887"},
  primaryBtn:{width:"100%",padding:"13px",borderRadius:12,border:"none",background:"linear-gradient(135deg,#f4a7bb,#a8d4f5)",color:"white",fontSize:15,fontWeight:800,cursor:"pointer",boxShadow:"0 3px 12px #f4a7bb44"},
  toggleBtn:{background:"transparent",border:"1.5px dashed #fce7f0",borderRadius:10,color:"#c9a0b0",padding:"7px 14px",fontSize:12,cursor:"pointer",marginBottom:10,fontFamily:"inherit"},
  list:{display:"flex",flexDirection:"column",gap:8},
  listItem:{background:"#fdf5f8",borderRadius:12,padding:"12px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",border:"1px solid #fce7f0"},
  listLeft:{display:"flex",flexDirection:"column",gap:2,flex:1,minWidth:0},
  listDate:{fontSize:14,fontWeight:700,color:"#3a2a35"},
  listSub:{fontSize:11,color:"#c9a0b0"},
  listRight:{display:"flex",alignItems:"center",gap:6,flexShrink:0},
  listAmt:{fontSize:15,fontWeight:800},
  editBtn:{background:"transparent",border:"none",cursor:"pointer",fontSize:14,padding:"2px 4px"},
  deleteBtn:{background:"transparent",border:"none",color:"#e0b0be",cursor:"pointer",fontSize:14,padding:"2px 4px"},
  empty:{color:"#dbb0c0",fontSize:13,fontStyle:"italic"},
  overlay:{position:"fixed",inset:0,background:"rgba(180,100,130,0.18)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(4px)"},
  modal:{background:"white",borderRadius:20,padding:20,width:"min(480px,95vw)",border:"2px solid #fce7f0",boxShadow:"0 20px 60px #f4a7bb33",maxHeight:"90vh",overflowY:"auto"},
  closeBtn:{background:"#fdf5f8",border:"1px solid #fce7f0",borderRadius:8,cursor:"pointer",fontSize:14,color:"#c9a0b0",padding:"4px 10px"},
  feedbackBtn:{background:"white",border:"1.5px solid #fce7f0",borderRadius:10,padding:"6px 10px",fontSize:16,cursor:"pointer"},
  bottomNav:{position:"fixed",bottom:0,left:0,right:0,background:"white",borderTop:"1.5px solid #fce7f0",display:"flex",justifyContent:"space-around",padding:"8px 0 calc(8px + env(safe-area-inset-bottom))",zIndex:200,boxShadow:"0 -2px 12px #f4a7bb11"},
  bottomNavBtn:{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"4px 0",background:"transparent",border:"none",cursor:"pointer",color:"#c9a0b0"},
  bottomNavActive:{color:"#b5476a"},
};
