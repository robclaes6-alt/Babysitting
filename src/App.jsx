import { useState, useEffect } from "react";
import { db } from "./firebase.js";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";

// ── helpers ───────────────────────────────────────────────────────────────────
const AIRPORTS = { Brussels: { km: 95, earned: 80 }, Charleroi: { km: 226, earned: 120 }, Eindhoven: { km: 170, earned: 120 } };
const FUEL_PER_KM = 0.111408;
const RATE_CHANGE_DATE = new Date("2025-09-01");
const HOURLY_RATE_OLD = 15;
const HOURLY_RATE_NEW = 20;

function fmtDate(d) { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }
function fmtEuro(n) { return "€" + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function rateForDate(d) { return new Date(d) >= RATE_CHANGE_DATE ? HOURLY_RATE_NEW : HOURLY_RATE_OLD; }
function today() { return new Date().toISOString().split("T")[0]; }

async function loadCollection(name) {
  const snap = await getDocs(collection(db, name));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
async function addItem(col, data) {
  const ref = await addDoc(collection(db, col), data);
  return { id: ref.id, ...data };
}
async function updateItem(col, id, data) { await updateDoc(doc(db, col, id), data); }
async function deleteItem_db(col, id) { await deleteDoc(doc(db, col, id)); }

const DogSVG = ({ size = 32, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" style={style} xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="40" rx="16" ry="13" fill="#f9c8d4" />
    <ellipse cx="32" cy="26" rx="13" ry="12" fill="#f9c8d4" />
    <ellipse cx="21" cy="18" rx="6" ry="9" fill="#f4a7bb" transform="rotate(-15 21 18)" />
    <ellipse cx="43" cy="18" rx="6" ry="9" fill="#f4a7bb" transform="rotate(15 43 18)" />
    <circle cx="27" cy="25" r="2.5" fill="#3a2a2a" />
    <circle cx="37" cy="25" r="2.5" fill="#3a2a2a" />
    <circle cx="27.8" cy="24.2" r=".9" fill="white" />
    <circle cx="37.8" cy="24.2" r=".9" fill="white" />
    <ellipse cx="32" cy="30" rx="4" ry="3" fill="#e88ba0" />
    <path d="M30 31 Q32 33.5 34 31" stroke="#c9607a" strokeWidth="1.2" fill="none" strokeLinecap="round" />
    <ellipse cx="32" cy="46" rx="7" ry="5" fill="#f4a7bb" />
    <ellipse cx="20" cy="50" rx="5" ry="3.5" fill="#f9c8d4" />
    <ellipse cx="44" cy="50" rx="5" ry="3.5" fill="#f9c8d4" />
    <path d="M38 47 Q45 43 50 46" stroke="#f4a7bb" strokeWidth="2.5" strokeLinecap="round" fill="none" />
  </svg>
);

export default function App() {
  const [sessions, setSessions] = useState([]);
  const [airports, setAirports] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("dashboard");
  const [showHistory, setShowHistory] = useState(false);
  const [editingSession, setEditingSession] = useState(null);
  const [editingAirport, setEditingAirport] = useState(null);
  const [editingPayment, setEditingPayment] = useState(null);
  const [quickLog, setQuickLog] = useState(null);
  const [newSession, setNewSession] = useState({ date: today(), startTime: "16:30", endTime: "20:00", parking: 0, other: 0 });
  const [newAirport, setNewAirport] = useState({ date: today(), airport: "Brussels", parking: 0 });
  const [newPayment, setNewPayment] = useState({ date: today(), amount: "" });

  useEffect(() => {
    async function load() {
      try {
        const [s, a, p] = await Promise.all([loadCollection("sessions"), loadCollection("airports"), loadCollection("payments")]);
        setSessions(s.sort((a, b) => a.date.localeCompare(b.date)));
        setAirports(a.sort((a, b) => a.date.localeCompare(b.date)));
        setPayments(p.sort((a, b) => a.date.localeCompare(b.date)));
      } catch (e) { console.error(e); }
      setLoading(false);
    }
    load();
  }, []);

  const totalEarned = sessions.reduce((s, x) => s + x.earned, 0) + airports.reduce((s, x) => s + x.earned, 0);
  const totalExpenses = sessions.reduce((s, x) => s + (x.gas || 0) + (x.parking || 0) + (x.other || 0), 0) + airports.reduce((s, x) => s + (x.gas || 0) + (x.parking || 0), 0);
  const totalPaid = payments.reduce((s, x) => s + x.amount, 0);
  const balance = totalEarned + totalExpenses - totalPaid;

  async function addSession() {
    const [sh, sm] = newSession.startTime.split(":").map(Number);
    const [eh, em] = newSession.endTime.split(":").map(Number);
    const hrs = ((eh * 60 + em) - (sh * 60 + sm)) / 60;
    if (hrs <= 0) return;
    const rate = rateForDate(newSession.date);
    const data = { date: newSession.date, startTime: newSession.startTime, endTime: newSession.endTime, hours: +hrs.toFixed(4), km: 0, gas: 0, parking: +newSession.parking, other: +newSession.other, earned: +(hrs * rate).toFixed(4), rate };
    const item = await addItem("sessions", data);
    setSessions(prev => [...prev, item].sort((a, b) => a.date.localeCompare(b.date)));
    setNewSession(p => ({ ...p, date: today(), parking: 0, other: 0 }));
  }

  async function saveEdit(updated) {
    const { id, ...data } = updated;
    await updateItem("sessions", id, data);
    setSessions(prev => prev.map(x => x.id === id ? updated : x).sort((a, b) => a.date.localeCompare(b.date)));
    setEditingSession(null);
  }

  async function addAirport() {
    const info = AIRPORTS[newAirport.airport] || AIRPORTS.Brussels;
    const data = { date: newAirport.date, airport: newAirport.airport, parking: +newAirport.parking, gas: +(info.km * FUEL_PER_KM).toFixed(4), earned: info.earned };
    const item = await addItem("airports", data);
    setAirports(prev => [...prev, item].sort((a, b) => a.date.localeCompare(b.date)));
    setNewAirport(p => ({ ...p, date: today(), parking: 0 }));
  }

  async function saveAirportEdit(updated) {
    const { id, ...data } = updated;
    await updateItem("airports", id, data);
    setAirports(prev => prev.map(x => x.id === id ? updated : x).sort((a, b) => a.date.localeCompare(b.date)));
    setEditingAirport(null);
  }

  async function addPayment() {
    if (!newPayment.amount) return;
    const data = { date: newPayment.date, amount: +newPayment.amount };
    const item = await addItem("payments", data);
    setPayments(prev => [...prev, item].sort((a, b) => a.date.localeCompare(b.date)));
    setNewPayment(p => ({ ...p, date: today(), amount: "" }));
  }

  async function savePaymentEdit(updated) {
    const { id, ...data } = updated;
    await updateItem("payments", id, data);
    setPayments(prev => prev.map(x => x.id === id ? updated : x).sort((a, b) => a.date.localeCompare(b.date)));
    setEditingPayment(null);
  }

  async function deleteItem(type, id) {
    const col = type === "session" ? "sessions" : type === "airport" ? "airports" : "payments";
    await deleteItem_db(col, id);
    if (type === "session") setSessions(p => p.filter(x => x.id !== id));
    if (type === "airport") setAirports(p => p.filter(x => x.id !== id));
    if (type === "payment") setPayments(p => p.filter(x => x.id !== id));
  }

  const recentSessions = [...sessions].reverse().slice(0, 10);
  const recentAirports = [...airports].reverse().slice(0, 10);
  const allPayments = [...payments].reverse();
  const tabs = [["dashboard", "🏠 Home"], ["hours", "⏰ Hours"], ["airport", "✈️ Airport"], ["payment", "💰 Payment"], ["analytics", "📊 Analytics"]];

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fdf5f8", flexDirection: "column", gap: 16 }}>
      <DogSVG size={64} style={{ animation: "spin 2s linear infinite" }} />
      <p style={{ color: "#c9a0b0", fontFamily: "DM Sans, sans-serif", fontSize: 15 }}>Loading Yarden's data... 🐾</p>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  return (
    <div style={S.root}>
      <DogSVG size={38} style={{ position: "fixed", top: 12, right: 12, opacity: 0.18, transform: "rotate(10deg)", pointerEvents: "none" }} />
      <DogSVG size={28} style={{ position: "fixed", bottom: 60, left: 8, opacity: 0.13, transform: "rotate(-15deg) scaleX(-1)", pointerEvents: "none" }} />
      <DogSVG size={22} style={{ position: "fixed", top: "45%", right: 5, opacity: 0.1, transform: "rotate(5deg)", pointerEvents: "none" }} />
      <header style={S.header}>
        <div style={S.headerInner}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <DogSVG size={44} />
            <div><div style={S.logo}>Yarden 🐾</div><div style={S.logoSub}>Work Tracker</div></div>
          </div>
          <div style={S.balancePill}>
            <span style={S.balanceLabel}>Still owed</span>
            <span style={{ ...S.balanceAmount, color: balance > 50 ? "#e8527a" : "#7ec8a0" }}>{fmtEuro(Math.abs(balance))}</span>
          </div>
        </div>
      </header>
      <nav style={S.nav}>
        {tabs.map(([id, label]) => (
          <button key={id} style={{ ...S.navBtn, ...(tab === id ? S.navActive : {}) }} onClick={() => setTab(id)}>{label}</button>
        ))}
      </nav>
      <main style={S.main}>
        {tab === "dashboard" && <Dashboard sessions={sessions} airports={airports} payments={payments} totalEarned={totalEarned} totalExpenses={totalExpenses} totalPaid={totalPaid} balance={balance} recentSessions={recentSessions} recentAirports={recentAirports} allPayments={allPayments} showHistory={showHistory} setShowHistory={setShowHistory} deleteItem={deleteItem} setEditingSession={setEditingSession} setEditingAirport={setEditingAirport} setEditingPayment={setEditingPayment} />}
        {tab === "hours" && <LogHours newSession={newSession} setNewSession={setNewSession} addSession={addSession} recentSessions={recentSessions} allSessions={sessions} deleteItem={deleteItem} setEditingSession={setEditingSession} />}
        {tab === "airport" && <LogAirport newAirport={newAirport} setNewAirport={setNewAirport} addAirport={addAirport} recentAirports={recentAirports} deleteItem={deleteItem} setEditingAirport={setEditingAirport} />}
        {tab === "payment" && <LogPayment newPayment={newPayment} setNewPayment={setNewPayment} addPayment={addPayment} allPayments={allPayments} showHistory={showHistory} setShowHistory={setShowHistory} deleteItem={deleteItem} setEditingPayment={setEditingPayment} />}
        {tab === "analytics" && <Analytics sessions={sessions} airports={airports} payments={payments} />}
      </main>
      <QuickLogFAB quickLog={quickLog} setQuickLog={setQuickLog} newSession={newSession} setNewSession={setNewSession} addSession={async () => { await addSession(); setQuickLog(null); }} newAirport={newAirport} setNewAirport={setNewAirport} addAirport={async () => { await addAirport(); setQuickLog(null); }} />
      {editingSession && <EditModal session={editingSession} onSave={saveEdit} onClose={() => setEditingSession(null)} />}
      {editingAirport && <EditAirportModal airport={editingAirport} onSave={saveAirportEdit} onClose={() => setEditingAirport(null)} />}
      {editingPayment && <EditPaymentModal payment={editingPayment} onSave={savePaymentEdit} onClose={() => setEditingPayment(null)} />}
    </div>
  );
}

function Dashboard({ sessions, airports, payments, totalEarned, totalExpenses, totalPaid, balance, recentSessions, recentAirports, allPayments, showHistory, setShowHistory, deleteItem, setEditingSession, setEditingAirport, setEditingPayment }) {
  return (
    <div>
      <div style={S.cardRow}>
        <StatCard label="Total Earned" value={fmtEuro(totalEarned)} accent={C.green} icon="🌿" />
        <StatCard label="Total Expenses" value={fmtEuro(totalExpenses)} accent={C.blue} icon="🧾" />
        <StatCard label="Total Paid" value={fmtEuro(totalPaid)} accent="#a78bfa" icon="💙" />
        <StatCard label="Still Owed" value={fmtEuro(balance)} accent={balance > 50 ? C.pink : C.green} icon={balance > 50 ? "🐾" : "✨"} />
      </div>
      <Sect title="🐕 Recent Sessions"><SessionList sessions={recentSessions} deleteItem={deleteItem} setEditingSession={setEditingSession} /></Sect>
      <Sect title="✈️ Recent Airport Trips"><AirportList airports={recentAirports} deleteItem={deleteItem} setEditingAirport={setEditingAirport} /></Sect>
      <Sect title="💰 Payments">
        <button style={S.toggleBtn} onClick={() => setShowHistory(!showHistory)}>{showHistory ? "▲ Hide" : "▼ Show"} payment history</button>
        {showHistory && <PaymentList payments={allPayments} deleteItem={deleteItem} setEditingPayment={setEditingPayment} />}
      </Sect>
    </div>
  );
}

function LogHours({ newSession, setNewSession, addSession, recentSessions, allSessions, deleteItem, setEditingSession }) {
  const [showAll, setShowAll] = useState(false);
  const [filterMonth, setFilterMonth] = useState("");
  const allReversed = [...allSessions].reverse();
  const months = [...new Set(allSessions.map(s => s.date.slice(0, 7)))].sort().reverse();
  const filtered = filterMonth ? allReversed.filter(s => s.date.startsWith(filterMonth)) : allReversed;
  const displayed = showAll ? filtered : recentSessions;
  const [sh, sm] = newSession.startTime.split(":").map(Number);
  const [eh, em] = newSession.endTime.split(":").map(Number);
  const hrs = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
  const rate = rateForDate(newSession.date);
  return (
    <div>
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><DogSVG size={36} /><h2 style={S.cardTitle}>Log Working Hours</h2></div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newSession.date} onChange={e => setNewSession(p => ({ ...p, date: e.target.value }))} /></Field>
          <Field label="🕐 Start time"><input style={S.input} type="time" value={newSession.startTime} onChange={e => setNewSession(p => ({ ...p, startTime: e.target.value }))} /></Field>
          <Field label="🕔 End time"><input style={S.input} type="time" value={newSession.endTime} onChange={e => setNewSession(p => ({ ...p, endTime: e.target.value }))} /></Field>
          <Field label="⏱ Hours worked"><div style={{ ...S.input, background: "#fce7f0", color: "#b5476a", fontWeight: 700 }}>{hrs > 0 ? `${hrs.toFixed(2)} hrs` : "—"}</div></Field>
          <Field label="🅿️ Parking (€)"><input style={S.input} type="number" min="0" step="0.01" value={newSession.parking} onChange={e => setNewSession(p => ({ ...p, parking: e.target.value }))} /></Field>
          <Field label="📦 Other expenses (€)"><input style={S.input} type="number" min="0" step="0.01" value={newSession.other} onChange={e => setNewSession(p => ({ ...p, other: e.target.value }))} /></Field>
        </div>
        <div style={S.preview}><span>{hrs.toFixed(2)} hrs × €{rate}/hr</span><span style={S.previewAmt}>{fmtEuro(hrs * rate)}</span></div>
        <button style={S.primaryBtn} onClick={addSession}>Add Session 🐾</button>
      </div>
      <Sect title={showAll ? `All Sessions (${filtered.length}) 🐾` : "Recent Sessions"}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
          <button style={{ ...S.toggleBtn, ...(showAll ? { background: "#fce7f0", color: "#b5476a", borderColor: "#f4a7bb" } : {}) }} onClick={() => { setShowAll(p => !p); setFilterMonth(""); }}>
            {showAll ? "▲ Show recent only" : `▼ Show all ${allSessions.length} sessions`}
          </button>
          {showAll && (
            <select style={{ ...S.input, width: "auto", fontSize: 12, padding: "6px 10px" }} value={filterMonth} onChange={e => setFilterMonth(e.target.value)}>
              <option value="">All months</option>
              {months.map(m => { const [y, mo] = m.split("-"); const label = new Date(+y, +mo - 1, 1).toLocaleDateString("en", { month: "long", year: "numeric" }); return <option key={m} value={m}>{label}</option>; })}
            </select>
          )}
          {showAll && filterMonth && <span style={{ fontSize: 12, color: "#c9a0b0" }}>{fmtEuro(filtered.reduce((s, x) => s + x.earned + (x.other || 0), 0))} earned · {filtered.reduce((s, x) => s + x.hours, 0).toFixed(1)}h worked</span>}
        </div>
        <SessionList sessions={displayed} deleteItem={deleteItem} setEditingSession={setEditingSession} />
      </Sect>
    </div>
  );
}

function LogAirport({ newAirport, setNewAirport, addAirport, recentAirports, deleteItem, setEditingAirport }) {
  const info = AIRPORTS[newAirport.airport] || AIRPORTS.Brussels;
  return (
    <div>
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><DogSVG size={36} /><h2 style={S.cardTitle}>Log Airport Trip ✈️</h2></div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newAirport.date} onChange={e => setNewAirport(p => ({ ...p, date: e.target.value }))} /></Field>
          <Field label="🛫 Airport"><select style={S.input} value={newAirport.airport} onChange={e => setNewAirport(p => ({ ...p, airport: e.target.value }))}>{Object.keys(AIRPORTS).map(a => <option key={a}>{a}</option>)}</select></Field>
          <Field label="🅿️ Parking ticket (€)"><input style={S.input} type="number" min="0" step="0.01" value={newAirport.parking} onChange={e => setNewAirport(p => ({ ...p, parking: e.target.value }))} /></Field>
        </div>
        <div style={S.preview}><span>{newAirport.airport} Airport trip</span><span style={S.previewAmt}>{fmtEuro(info.earned)}</span></div>
        <button style={S.primaryBtn} onClick={addAirport}>Add Trip 🐾</button>
      </div>
      <Sect title="Recent Airport Trips"><AirportList airports={recentAirports} deleteItem={deleteItem} setEditingAirport={setEditingAirport} /></Sect>
    </div>
  );
}

function LogPayment({ newPayment, setNewPayment, addPayment, allPayments, showHistory, setShowHistory, deleteItem, setEditingPayment }) {
  return (
    <div>
      <div style={S.card}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}><DogSVG size={36} /><h2 style={S.cardTitle}>Register Payment 💰</h2></div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={newPayment.date} onChange={e => setNewPayment(p => ({ ...p, date: e.target.value }))} /></Field>
          <Field label="💶 Amount (€)"><input style={S.input} type="number" min="0" step="0.01" value={newPayment.amount} placeholder="0.00" onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))} /></Field>
        </div>
        <button style={S.primaryBtn} onClick={addPayment}>Add Payment 🐾</button>
      </div>
      <Sect title="Payment History">
        <button style={S.toggleBtn} onClick={() => setShowHistory(!showHistory)}>{showHistory ? "▲ Hide" : "▼ Show"} payment history</button>
        {showHistory && <PaymentList payments={allPayments} deleteItem={deleteItem} setEditingPayment={setEditingPayment} />}
      </Sect>
    </div>
  );
}

function Analytics({ sessions, airports, payments }) {
  const [monthView, setMonthView] = useState("earned");
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const RATE_CHANGE = "2025-09";
  function mk(d) { return d.slice(0, 7); }
  const monthEarned = {}, monthHours = {};
  sessions.forEach(s => { const k = mk(s.date); monthEarned[k] = (monthEarned[k] || 0) + (s.earned || 0) + (s.gas || 0) + (s.parking || 0) + (s.other || 0); monthHours[k] = (monthHours[k] || 0) + s.hours; });
  airports.forEach(a => { const k = mk(a.date); monthEarned[k] = (monthEarned[k] || 0) + (a.earned || 0) + (a.gas || 0) + (a.parking || 0); });
  const allKeys = Object.keys(monthEarned).sort();
  const completeKeys = allKeys.filter(k => k < thisMonth);
  function longMonth(k) { const [y, m] = k.split("-"); return new Date(+y, +m - 1, 1).toLocaleDateString("en", { month: "long", year: "numeric" }); }
  function shortMY(k) { const [y, m] = k.split("-"); return new Date(+y, +m - 1, 1).toLocaleDateString("en", { month: "short", year: "2-digit" }); }
  const bestKey = completeKeys.length ? completeKeys.reduce((a, b) => monthEarned[a] > monthEarned[b] ? a : b) : "";
  const worstKey = completeKeys.length ? completeKeys.reduce((a, b) => monthEarned[a] < monthEarned[b] ? a : b) : "";
  const mostHrsKey = completeKeys.length ? completeKeys.reduce((a, b) => (monthHours[a] || 0) > (monthHours[b] || 0) ? a : b) : "";
  const leastHrsKey = completeKeys.length ? completeKeys.reduce((a, b) => (monthHours[a] || 0) < (monthHours[b] || 0) ? a : b) : "";
  function avgC(n) { const l = completeKeys.slice(-n); return l.length ? l.reduce((s, k) => s + (monthEarned[k] || 0), 0) / l.length : 0; }
  const earnedThis = monthEarned[thisMonth] || 0, hoursThis = monthHours[thisMonth] || 0;
  const avg3 = avgC(3), avg6 = avgC(6), avg12 = avgC(12);
  const avgAll = completeKeys.length ? completeKeys.reduce((s, k) => s + (monthEarned[k] || 0), 0) / completeKeys.length : 0;
  const sinceRaise = completeKeys.filter(k => k >= RATE_CHANGE);
  const avgRaise = sinceRaise.length ? sinceRaise.reduce((s, k) => s + (monthEarned[k] || 0), 0) / sinceRaise.length : 0;
  const totalHours = sessions.reduce((s, x) => s + x.hours, 0);
  const sp = [...payments].sort((a, b) => a.date.localeCompare(b.date));
  let avgGap = 0; if (sp.length > 1) { const gaps = sp.slice(1).map((p, i) => (new Date(p.date) - new Date(sp[i].date)) / 86400000); avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length; }
  const wdc = [0, 0, 0, 0, 0, 0, 0]; sessions.forEach(s => { wdc[new Date(s.date).getDay()]++; });
  const busyDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][wdc.indexOf(Math.max(...wdc))];
  const last6 = completeKeys.slice(-6);
  const chartData = monthView === "earned" ? monthEarned : monthHours;
  const maxVal = Math.max(...last6.map(k => chartData[k] || 0), 1);
  const ts = { border: "1px solid #fce7f0", borderRadius: 8, padding: "4px 10px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
  return (
    <div>
      <div style={{ ...S.card, background: "linear-gradient(135deg,#fff0f5 0%,#f0f8ff 100%)", border: "1.5px solid #f9c8d4" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}><DogSVG size={34} /><h2 style={{ ...S.cardTitle, color: "#b5476a" }}>Yarden's Earnings Stats 📊</h2></div>
        <p style={{ color: "#c97a94", fontSize: 13, margin: "0 0 20px" }}>All the numbers about Yarden's hard work! 🐾</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          <AnalCard label="This month (so far)" value={fmtEuro(earnedThis)} accent={C.pink} note={`${hoursThis.toFixed(1)}h worked`} />
          <AnalCard label="Avg last 3 months" value={fmtEuro(avg3)} accent={C.blue} note="complete months only" />
          <AnalCard label="Avg last 6 months" value={fmtEuro(avg6)} accent={C.green} note="complete months only" />
          <AnalCard label="Avg last 12 months" value={fmtEuro(avg12)} accent={C.pink} note="complete months only" />
          <AnalCard label="All-time avg" value={fmtEuro(avgAll)} accent={C.blue} note="complete months" />
          <AnalCard label="Avg since €20/hr raise" value={fmtEuro(avgRaise)} accent={C.green} note={`Sep '25 → now (${sinceRaise.length} months)`} />
          <AnalCard label="Total hours worked" value={totalHours.toFixed(1) + "h"} accent={C.pink} note={`across ${sessions.length} sessions`} />
          <AnalCard label="Airport trips" value={airports.length} accent={C.blue} note="total trips" />
        </div>
        <div style={{ background: "white", borderRadius: 14, padding: "16px 16px 12px", marginBottom: 16, border: "1px solid #fce7f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: "#c97a94", fontWeight: 700, letterSpacing: .5 }}>LAST 6 COMPLETE MONTHS</span>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setMonthView("earned")} style={{ ...ts, background: monthView === "earned" ? "#f9c8d4" : "transparent", color: monthView === "earned" ? "#b5476a" : "#c9a0b0" }}>€ Earned</button>
              <button onClick={() => setMonthView("hours")} style={{ ...ts, background: monthView === "hours" ? "#c4dff5" : "transparent", color: monthView === "hours" ? "#2a5c8a" : "#c9a0b0" }}>⏱ Hours</button>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
            {last6.map(k => { const val = chartData[k] || 0; const bh = Math.max(4, (val / maxVal) * 80); const lbl = monthView === "earned" ? fmtEuro(val) : val.toFixed(1) + "h"; return (<div key={k} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}><span style={{ fontSize: 8, color: "#b5476a", fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>{lbl}</span><div style={{ width: "100%", background: monthView === "earned" ? `linear-gradient(180deg,${C.pink} 0%,#f4a7bb 100%)` : `linear-gradient(180deg,${C.blue} 0%,#a8d4f5 100%)`, borderRadius: "6px 6px 0 0", height: bh }} /><span style={{ fontSize: 8, color: "#c97a94", fontWeight: 600 }}>{shortMY(k)}</span></div>); })}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 20 }}>
          <FunFact icon="🏆" label="Best month" value={bestKey ? longMonth(bestKey) : "—"} sub={bestKey ? fmtEuro(monthEarned[bestKey]) : ""} />
          <FunFact icon="📉" label="Quietest month" value={worstKey ? longMonth(worstKey) : "—"} sub={worstKey ? fmtEuro(monthEarned[worstKey]) : ""} />
          <FunFact icon="⏰" label="Most hours" value={mostHrsKey ? longMonth(mostHrsKey) : "—"} sub={mostHrsKey ? (monthHours[mostHrsKey] || 0).toFixed(1) + "h" : ""} />
          <FunFact icon="😴" label="Fewest hours" value={leastHrsKey ? longMonth(leastHrsKey) : "—"} sub={leastHrsKey ? (monthHours[leastHrsKey] || 0).toFixed(1) + "h" : ""} />
          <FunFact icon="📅" label="Busiest weekday" value={busyDay} sub="most sessions" />
          <FunFact icon="💸" label="Avg pay gap" value={avgGap > 0 ? `${avgGap.toFixed(0)} days` : "—"} sub="between payments" />
        </div>
        <div style={{ background: "white", borderRadius: 14, padding: 16, border: "1px solid #fce7f0" }}>
          <div style={{ fontSize: 12, color: "#c97a94", fontWeight: 700, marginBottom: 12, letterSpacing: .5 }}>📋 MONTHLY OVERVIEW</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", fontSize: 11, color: "#c9a0b0", fontWeight: 700, paddingBottom: 6, borderBottom: "1px solid #fce7f0", marginBottom: 4 }}>
            <span>Month</span><span style={{ textAlign: "right" }}>Hours</span><span style={{ textAlign: "right" }}>Earned</span>
          </div>
          <div style={{ maxHeight: 320, overflowY: "auto" }}>
            {[...allKeys].reverse().map(k => { const isThis = k === thisMonth; return (<div key={k} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "6px 0", borderBottom: "1px solid #fdf5f8", background: isThis ? "#fff7fa" : "transparent" }}><span style={{ fontSize: 12, fontWeight: isThis ? 700 : 500, color: isThis ? "#b5476a" : "#3a2a35" }}>{longMonth(k)}{isThis ? " ★" : ""}</span><span style={{ fontSize: 12, textAlign: "right", color: "#7a6a70" }}>{(monthHours[k] || 0).toFixed(1)}h</span><span style={{ fontSize: 12, textAlign: "right", fontWeight: 600, color: C.green }}>{fmtEuro(monthEarned[k] || 0)}</span></div>); })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SessionList({ sessions, deleteItem, setEditingSession }) {
  if (!sessions.length) return <p style={S.empty}>No sessions yet 🐾</p>;
  return (
    <div style={S.list}>
      {sessions.map(s => {
        const exp = [];
        if (s.parking > 0) exp.push(`🅿️ €${s.parking.toFixed(2)}`);
        if (s.other > 0) exp.push(`📦 €${s.other.toFixed(2)}`);
        if (s.gas > 0) exp.push(`⛽ €${s.gas.toFixed(2)}`);
        return (
          <div key={s.id} style={S.listItem}>
            <div style={S.listLeft}>
              <span style={S.listDate}>{fmtDate(new Date(s.date))}</span>
              <span style={S.listSub}>{s.startTime} – {s.endTime} · {s.hours.toFixed(2)}h · €{s.rate}/hr</span>
              {exp.length > 0 && <span style={{ fontSize: 11, color: "#c9a0b0", marginTop: 1 }}>{exp.join("  ")}</span>}
            </div>
            <div style={S.listRight}>
              <span style={{ ...S.listAmt, color: C.green }}>{fmtEuro(s.earned)}</span>
              <button style={S.editBtn} onClick={() => setEditingSession(s)}>✏️</button>
              <button style={S.deleteBtn} onClick={() => deleteItem("session", s.id)}>✕</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AirportList({ airports, deleteItem, setEditingAirport }) {
  if (!airports.length) return <p style={S.empty}>No trips yet 🛫</p>;
  return (
    <div style={S.list}>
      {airports.map(a => (
        <div key={a.id} style={S.listItem}>
          <div style={S.listLeft}>
            <span style={S.listDate}>{fmtDate(new Date(a.date))}</span>
            <span style={S.listSub}>{a.airport} Airport{a.parking > 0 ? ` · 🅿️ €${a.parking.toFixed(2)}` : ""}</span>
          </div>
          <div style={S.listRight}>
            <span style={{ ...S.listAmt, color: C.blue }}>{fmtEuro(a.earned)}</span>
            <button style={S.editBtn} onClick={() => setEditingAirport(a)}>✏️</button>
            <button style={S.deleteBtn} onClick={() => deleteItem("airport", a.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentList({ payments, deleteItem, setEditingPayment }) {
  if (!payments.length) return <p style={S.empty}>No payments yet 💸</p>;
  return (
    <div style={S.list}>
      {payments.map(p => (
        <div key={p.id} style={S.listItem}>
          <div style={S.listLeft}><span style={S.listDate}>{fmtDate(new Date(p.date))}</span></div>
          <div style={S.listRight}>
            <span style={{ ...S.listAmt, color: C.blue }}>{fmtEuro(p.amount)}</span>
            <button style={S.editBtn} onClick={() => setEditingPayment(p)}>✏️</button>
            <button style={S.deleteBtn} onClick={() => deleteItem("payment", p.id)}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function EditModal({ session, onSave, onClose }) {
  const [form, setForm] = useState({ ...session });
  function calcHrs(s, e) { const [sh, sm] = s.split(":").map(Number); const [eh, em] = e.split(":").map(Number); const m = (eh * 60 + em) - (sh * 60 + sm); return m > 0 ? m / 60 : 0; }
  const hrs = calcHrs(form.startTime, form.endTime);
  const rate = rateForDate(form.date);
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: "#b5476a", fontSize: 17, fontWeight: 800 }}>✏️ Edit Session</h3>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
          <Field label="🕐 Start time"><input style={S.input} type="time" value={form.startTime} onChange={e => setForm(p => ({ ...p, startTime: e.target.value }))} /></Field>
          <Field label="🕔 End time"><input style={S.input} type="time" value={form.endTime} onChange={e => setForm(p => ({ ...p, endTime: e.target.value }))} /></Field>
          <Field label="⏱ Hours"><div style={{ ...S.input, background: "#fce7f0", color: "#b5476a", fontWeight: 700 }}>{hrs > 0 ? `${hrs.toFixed(2)} hrs` : "—"}</div></Field>
          <Field label="🅿️ Parking (€)"><input style={S.input} type="number" min="0" step="0.01" value={form.parking} onChange={e => setForm(p => ({ ...p, parking: +e.target.value }))} /></Field>
          <Field label="📦 Other (€)"><input style={S.input} type="number" min="0" step="0.01" value={form.other} onChange={e => setForm(p => ({ ...p, other: +e.target.value }))} /></Field>
        </div>
        <div style={S.preview}><span>{hrs.toFixed(2)} hrs × €{rate}/hr</span><span style={S.previewAmt}>{fmtEuro(hrs * rate)}</span></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...S.primaryBtn, background: "#e8f5f0", color: "#3a8a6a", flex: 1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...S.primaryBtn, flex: 2 }} onClick={() => onSave({ ...form, hours: hrs, earned: +(hrs * rate).toFixed(4), rate })}>Save 🐾</button>
        </div>
      </div>
    </div>
  );
}

function EditAirportModal({ airport, onSave, onClose }) {
  const [form, setForm] = useState({ ...airport });
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: "#b5476a", fontSize: 17, fontWeight: 800 }}>✏️ Edit Airport Trip</h3>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
          <Field label="🛫 Airport"><select style={S.input} value={form.airport} onChange={e => setForm(p => ({ ...p, airport: e.target.value }))}>{Object.keys(AIRPORTS).map(a => <option key={a}>{a}</option>)}</select></Field>
          <Field label="🅿️ Parking (€)"><input style={S.input} type="number" min="0" step="0.01" value={form.parking} onChange={e => setForm(p => ({ ...p, parking: +e.target.value }))} /></Field>
          <Field label="💶 Earned (€)"><input style={S.input} type="number" min="0" step="0.01" value={form.earned} onChange={e => setForm(p => ({ ...p, earned: +e.target.value }))} /></Field>
        </div>
        <div style={S.preview}><span>{form.airport} Airport</span><span style={S.previewAmt}>{fmtEuro((form.earned || 0) + (form.parking || 0))}</span></div>
        <div style={{ display: "flex", gap: 10 }}>
          <button style={{ ...S.primaryBtn, background: "#e8f5f0", color: "#3a8a6a", flex: 1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...S.primaryBtn, flex: 2 }} onClick={() => onSave(form)}>Save 🐾</button>
        </div>
      </div>
    </div>
  );
}

function EditPaymentModal({ payment, onSave, onClose }) {
  const [form, setForm] = useState({ ...payment });
  return (
    <div style={S.overlay}>
      <div style={S.modal}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h3 style={{ margin: 0, color: "#b5476a", fontSize: 17, fontWeight: 800 }}>✏️ Edit Payment</h3>
          <button style={S.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div style={S.formGrid}>
          <Field label="📅 Date"><input style={S.input} type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} /></Field>
          <Field label="💶 Amount (€)"><input style={S.input} type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: +e.target.value }))} /></Field>
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button style={{ ...S.primaryBtn, background: "#e8f5f0", color: "#3a8a6a", flex: 1 }} onClick={onClose}>Cancel</button>
          <button style={{ ...S.primaryBtn, flex: 2 }} onClick={() => onSave(form)}>Save 🐾</button>
        </div>
      </div>
    </div>
  );
}

function QuickLogFAB({ quickLog, setQuickLog, newSession, setNewSession, addSession, newAirport, setNewAirport, addAirport }) {
  if (quickLog === "hours") {
    const [sh, sm] = newSession.startTime.split(":").map(Number);
    const [eh, em] = newSession.endTime.split(":").map(Number);
    const hrs = Math.max(0, ((eh * 60 + em) - (sh * 60 + sm)) / 60);
    const rate = rateForDate(newSession.date);
    return (
      <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setQuickLog(null); }}>
        <div style={S.modal}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, color: "#b5476a", fontSize: 17, fontWeight: 800 }}>⏰ Quick Log Hours</h3>
            <button style={S.closeBtn} onClick={() => setQuickLog(null)}>✕</button>
          </div>
          <div style={S.formGrid}>
            <Field label="📅 Date"><input style={S.input} type="date" value={newSession.date} onChange={e => setNewSession(p => ({ ...p, date: e.target.value }))} /></Field>
            <Field label="🕐 Start"><input style={S.input} type="time" value={newSession.startTime} onChange={e => setNewSession(p => ({ ...p, startTime: e.target.value }))} /></Field>
            <Field label="🕔 End"><input style={S.input} type="time" value={newSession.endTime} onChange={e => setNewSession(p => ({ ...p, endTime: e.target.value }))} /></Field>
            <Field label="⏱ Hours"><div style={{ ...S.input, background: "#fce7f0", color: "#b5476a", fontWeight: 700 }}>{hrs > 0 ? `${hrs.toFixed(2)} hrs` : "—"}</div></Field>
            <Field label="🅿️ Parking (€)"><input style={S.input} type="number" min="0" step="0.01" value={newSession.parking} onChange={e => setNewSession(p => ({ ...p, parking: e.target.value }))} /></Field>
            <Field label="📦 Other (€)"><input style={S.input} type="number" min="0" step="0.01" value={newSession.other} onChange={e => setNewSession(p => ({ ...p, other: e.target.value }))} /></Field>
          </div>
          <div style={S.preview}><span>{hrs.toFixed(2)} hrs × €{rate}/hr</span><span style={S.previewAmt}>{fmtEuro(hrs * rate)}</span></div>
          <button style={S.primaryBtn} onClick={addSession}>Add Session 🐾</button>
        </div>
      </div>
    );
  }
  if (quickLog === "airport") {
    const info = AIRPORTS[newAirport.airport] || AIRPORTS.Brussels;
    return (
      <div style={S.overlay} onClick={e => { if (e.target === e.currentTarget) setQuickLog(null); }}>
        <div style={S.modal}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h3 style={{ margin: 0, color: "#b5476a", fontSize: 17, fontWeight: 800 }}>✈️ Quick Log Airport</h3>
            <button style={S.closeBtn} onClick={() => setQuickLog(null)}>✕</button>
          </div>
          <div style={S.formGrid}>
            <Field label="📅 Date"><input style={S.input} type="date" value={newAirport.date} onChange={e => setNewAirport(p => ({ ...p, date: e.target.value }))} /></Field>
            <Field label="🛫 Airport"><select style={S.input} value={newAirport.airport} onChange={e => setNewAirport(p => ({ ...p, airport: e.target.value }))}>{Object.keys(AIRPORTS).map(a => <option key={a}>{a}</option>)}</select></Field>
            <Field label="🅿️ Parking (€)"><input style={S.input} type="number" min="0" step="0.01" value={newAirport.parking} onChange={e => setNewAirport(p => ({ ...p, parking: e.target.value }))} /></Field>
          </div>
          <div style={S.preview}><span>{newAirport.airport} Airport</span><span style={S.previewAmt}>{fmtEuro(info.earned)}</span></div>
          <button style={S.primaryBtn} onClick={addAirport}>Add Trip 🐾</button>
        </div>
      </div>
    );
  }
  return (
    <div style={{ position: "fixed", bottom: 24, right: 20, display: "flex", flexDirection: "column", gap: 10, zIndex: 500 }}>
      <button style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: "#f4a7bb", fontSize: 20, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }} onClick={() => setQuickLog("hours")}>⏰</button>
      <button style={{ width: 48, height: 48, borderRadius: "50%", border: "none", background: "#a8d4f5", fontSize: 20, cursor: "pointer", boxShadow: "0 4px 16px rgba(0,0,0,0.15)" }} onClick={() => setQuickLog("airport")}>✈️</button>
    </div>
  );
}

function StatCard({ label, value, accent, icon }) { return (<div style={{ ...S.statCard, borderTop: `3px solid ${accent}` }}><div style={{ fontSize: 20, marginBottom: 6 }}>{icon}</div><div style={{ fontSize: 11, color: "#c9a0b0", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>{label}</div><div style={{ fontSize: 21, fontWeight: 800, color: accent }}>{value}</div></div>); }
function Sect({ title, children }) { return <div style={{ marginBottom: 22 }}><h3 style={S.sectTitle}>{title}</h3>{children}</div>; }
function Field({ label, children }) { return <label style={S.label}><span style={{ marginBottom: 5, display: "block" }}>{label}</span>{children}</label>; }
function FunFact({ icon, label, value, sub }) { return (<div style={{ background: "#fff7fa", borderRadius: 12, padding: "10px 12px", border: "1px solid #fce7f0", textAlign: "center" }}><div style={{ fontSize: 20, marginBottom: 4 }}>{icon}</div><div style={{ fontSize: 10, color: "#c97a94", fontWeight: 600, textTransform: "uppercase", letterSpacing: .5 }}>{label}</div><div style={{ fontSize: 12, fontWeight: 800, color: "#b5476a", marginTop: 2, lineHeight: 1.3 }}>{value}</div>{sub && <div style={{ fontSize: 11, color: C.green, fontWeight: 700, marginTop: 2 }}>{sub}</div>}</div>); }
function AnalCard({ label, value, accent, note }) { return (<div style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: `1.5px solid ${accent}33`, position: "relative", overflow: "hidden" }}><div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: accent }} /><div style={{ fontSize: 11, color: "#aaa", textTransform: "uppercase", letterSpacing: .5, marginBottom: 4 }}>{label}</div><div style={{ fontSize: 22, fontWeight: 800, color: accent }}>{value}</div><div style={{ fontSize: 11, color: "#bbb", marginTop: 2 }}>{note}</div></div>); }

const C = { pink: "#e8527a", blue: "#5b9bd5", green: "#5db887" };
const S = {
  root: { minHeight: "100vh", background: "#fdf5f8", backgroundImage: "radial-gradient(circle at 20% 10%,#fce7f0 0%,transparent 50%),radial-gradient(circle at 80% 80%,#e8f4ff 0%,transparent 50%)", color: "#3a2a35", fontFamily: "'DM Sans','Segoe UI',sans-serif", paddingBottom: 80 },
  header: { background: "linear-gradient(135deg,#fff0f5 0%,#ffe8f5 100%)", borderBottom: "2px solid #fce7f0", padding: "16px 0", boxShadow: "0 2px 12px #f4a7bb22" },
  headerInner: { maxWidth: 740, margin: "0 auto", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  logo: { fontSize: 24, fontWeight: 800, color: "#b5476a", letterSpacing: 1 },
  logoSub: { fontSize: 11, color: "#c9a0b0", letterSpacing: 2, textTransform: "uppercase" },
  balancePill: { background: "white", borderRadius: 16, padding: "10px 18px", textAlign: "right", border: "2px solid #fce7f0" },
  balanceLabel: { display: "block", fontSize: 11, color: "#c9a0b0", letterSpacing: 1, textTransform: "uppercase" },
  balanceAmount: { fontSize: 22, fontWeight: 800 },
  nav: { maxWidth: 740, margin: "0 auto", padding: "14px 20px 0", display: "flex", gap: 6, flexWrap: "wrap" },
  navBtn: { padding: "8px 14px", borderRadius: 20, border: "1.5px solid #fce7f0", background: "white", color: "#c9a0b0", cursor: "pointer", fontSize: 13, fontWeight: 600 },
  navActive: { background: "linear-gradient(135deg,#f9c8d4,#c4dff5)", color: "#7a3050", borderColor: "#f4a7bb" },
  main: { maxWidth: 740, margin: "0 auto", padding: "20px 20px 0" },
  card: { background: "white", borderRadius: 20, padding: 24, marginBottom: 20, border: "1.5px solid #fce7f0", boxShadow: "0 4px 20px #f4a7bb11" },
  cardTitle: { margin: 0, fontSize: 17, fontWeight: 800, color: "#b5476a" },
  cardRow: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 20 },
  statCard: { background: "white", borderRadius: 16, padding: "16px 18px", border: "1.5px solid #fce7f0" },
  sectTitle: { fontSize: 13, fontWeight: 700, color: "#c9a0b0", textTransform: "uppercase", letterSpacing: 1, margin: "0 0 10px" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 },
  label: { fontSize: 12, color: "#c9a0b0", fontWeight: 700, letterSpacing: .3 },
  input: { background: "#fdf5f8", border: "1.5px solid #fce7f0", borderRadius: 10, padding: "9px 12px", color: "#3a2a35", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", fontFamily: "inherit" },
  preview: { display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fdf5f8", borderRadius: 12, padding: "10px 14px", marginBottom: 16, color: "#c9a0b0", fontSize: 14, border: "1px dashed #fce7f0" },
  previewAmt: { fontSize: 22, fontWeight: 800, color: "#5db887" },
  primaryBtn: { width: "100%", padding: "12px", borderRadius: 12, border: "none", background: "linear-gradient(135deg,#f4a7bb,#a8d4f5)", color: "white", fontSize: 15, fontWeight: 800, cursor: "pointer" },
  toggleBtn: { background: "transparent", border: "1.5px dashed #fce7f0", borderRadius: 10, color: "#c9a0b0", padding: "7px 14px", fontSize: 12, cursor: "pointer", marginBottom: 10, fontFamily: "inherit" },
  list: { display: "flex", flexDirection: "column", gap: 8 },
  listItem: { background: "#fdf5f8", borderRadius: 12, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center", border: "1px solid #fce7f0" },
  listLeft: { display: "flex", flexDirection: "column", gap: 3 },
  listDate: { fontSize: 14, fontWeight: 700, color: "#3a2a35" },
  listSub: { fontSize: 12, color: "#c9a0b0" },
  listRight: { display: "flex", alignItems: "center", gap: 8 },
  listAmt: { fontSize: 16, fontWeight: 800 },
  editBtn: { background: "transparent", border: "none", cursor: "pointer", fontSize: 14, padding: "2px 4px" },
  deleteBtn: { background: "transparent", border: "none", color: "#e0b0be", cursor: "pointer", fontSize: 14, padding: "2px 4px" },
  empty: { color: "#dbb0c0", fontSize: 13, fontStyle: "italic" },
  overlay: { position: "fixed", inset: 0, background: "rgba(180,100,130,0.18)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, backdropFilter: "blur(4px)" },
  modal: { background: "white", borderRadius: 24, padding: 28, width: "min(480px,95vw)", border: "2px solid #fce7f0", boxShadow: "0 20px 60px #f4a7bb33" },
  closeBtn: { background: "#fdf5f8", border: "1px solid #fce7f0", borderRadius: 8, cursor: "pointer", fontSize: 14, color: "#c9a0b0", padding: "4px 10px" },
};
