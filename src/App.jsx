import { useState, useEffect } from "react";

const WARMUPS = {
  Push: [
    { name: "Arm circles", duration: "30 sec each direction" },
    { name: "Band pull-aparts (or towel)", duration: "2x15" },
    { name: "Wall slides", duration: "2x10" },
    { name: "Push-up (slow, 50%)", duration: "1x8" },
  ],
  Pull: [
    { name: "Cat-cow", duration: "1 min" },
    { name: "Dead hang (or scapular retractions)", duration: "2x10 sec" },
    { name: "Band face pulls (or towel rows)", duration: "2x15" },
    { name: "Hip hinge practice (bodyweight RDL)", duration: "1x10" },
  ],
  Legs: [
    { name: "Hip circles", duration: "30 sec each" },
    { name: "Bodyweight squat", duration: "2x10 slow" },
    { name: "Leg swings (front/back + lateral)", duration: "10 each" },
    { name: "Glute bridge", duration: "2x15" },
  ],
  Core: [
    { name: "Cat-cow", duration: "1 min" },
    { name: "Dead bug", duration: "2x10" },
    { name: "Bird dog", duration: "2x10 ea" },
    { name: "Hollow hold", duration: "2x20 sec" },
  ],
};

const WORKOUTS = {
  Push: [
    { name: "DB Floor Press", sets: 4, reps: "8-10", note: "Heavy, controlled descent" },
    { name: "DB Overhead Press", sets: 3, reps: "10", note: "Strict, no leg drive" },
    { name: "DB Lateral Raise", sets: 3, reps: "15", note: "Slow eccentric" },
    { name: "Push-up", sets: 2, reps: "AMRAP", note: "Bodyweight finisher — slow eccentric if easy", type: "bodyweight" },
    { name: "Dips", sets: 3, reps: "8-12", note: "Lean forward for chest, upright for tricep focus" },
  ],
  Pull: [
    { name: "DB Bent-Over Row", sets: 4, reps: "8-10", note: "Brace hard, hip hinge" },
    { name: "DB Single-Arm Row", sets: 3, reps: "10 ea", note: "Full ROM stretch" },
    { name: "Banded Rear Delt Fly", sets: 3, reps: "15", note: "Light band tension, elbows high" },
    { name: "DB Alternating Curl", sets: 3, reps: "12", note: "Supinate at top" },
    { name: "Inverted Row", sets: 3, reps: "AMRAP", note: "Bodyweight finisher", type: "bodyweight" },
    { name: "Back Extension", sets: 3, reps: "12", note: "Hyper Pro — erectors/glutes, hold DB at chest for load" },
  ],
  Legs: [
    { name: "DB Romanian Deadlift", sets: 4, reps: "10", note: "Hamstring focus" },
    { name: "DB Goblet Squat", sets: 3, reps: "12", note: "Heels elevated if needed" },
    { name: "Leg Extension", sets: 3, reps: "12", note: "Leg Developer — quad isolation, 2-sec squeeze at top" },
    { name: "Lying Leg Curl", sets: 3, reps: "12", note: "Leg Developer — hamstring isolation, slow eccentric" },
    { name: "Glute-Ham Raise", sets: 3, reps: "8", note: "GHD — full ROM, assist with hands if needed", type: "bodyweight" },
  ],
  Core: [
    { name: "GHD Sit-Up", sets: 3, reps: "12", note: "GHD — full extension to flexion, hands at chest", type: "bodyweight" },
    { name: "Reverse Hyper", sets: 3, reps: "12", note: "Hyper Pro — controlled, no swing, squeeze glutes", type: "bodyweight" },
    { name: "Hanging Leg Raise", sets: 3, reps: "10", note: "Lying leg raise if no bar — straight legs to 90°", type: "bodyweight" },
    { name: "DB Russian Twist", sets: 3, reps: "20 ea", note: "Slow, rotate from torso not arms" },
    { name: "Plank", sets: 3, reps: "45", note: "Hold position, slight ribs-down tuck", type: "time" },
  ],
};

const WEEK_TEMPLATE = [
  { day: "Mon", session: "Push", type: "lift" },
  { day: "Tue", session: "Trail / Rest", type: "cardio" },
  { day: "Wed", session: "Pull", type: "lift" },
  { day: "Thu", session: "Easy / Rest", type: "rest" },
  { day: "Fri", session: "Legs", type: "lift" },
  { day: "Sat", session: "Snowboard / Trail", type: "cardio" },
  { day: "Sun", session: "Core", type: "lift" },
];

const HRV_OPTIONS = ["Balanced", "Low", "Unbalanced", "Poor"];
const HRV_SCORES = { Balanced: 2, Low: 0, Unbalanced: 1, Poor: 0 };
const HRV_COLORS = { Balanced: "#c8f060", Low: "#f06060", Unbalanced: "#f0a040", Poor: "#f06060" };
const STORAGE_KEY = "tony-workout-tracker-v2";

function getReadinessScore(checkin) {
  if (!checkin) return null;
  let score = 0, flags = 0;
  score += HRV_SCORES[checkin.hrv] ?? 0;
  if (checkin.hrv && checkin.hrv !== "Balanced") flags++;
  const bb = parseInt(checkin.bodyBattery);
  if (!isNaN(bb)) { if (bb >= 70) score += 2; else if (bb >= 40) score += 1; else flags++; }
  const delta = parseInt(checkin.rhrDelta);
  if (!isNaN(delta)) { if (delta <= 0) score += 2; else if (delta <= 3) score += 1; else flags++; }
  return { pct: Math.round((score / 6) * 100), flags };
}

function formatPrev(prev, type) {
  if (!prev) return "—";
  if (type === "bodyweight") return prev.reps || "—";
  if (type === "time") return prev.reps ? `${prev.reps}s` : "—";
  return prev.weight ? `${prev.weight}×${prev.reps}` : "—";
}

function formatSet(s, type) {
  if (type === "bodyweight") return s.reps ? `BW×${s.reps}` : "";
  if (type === "time") return s.reps ? `${s.reps}s` : "";
  return `${s.weight ? `${s.weight}lbs` : ""}${s.weight && s.reps ? "×" : ""}${s.reps || ""}`;
}

function ReadinessGauge({ pct, flags }) {
  const color = pct >= 70 ? "#c8f060" : pct >= 40 ? "#f0a040" : "#f06060";
  const r = 28, circ = 2 * Math.PI * r;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
        <svg width={72} height={72} style={{ transform: "rotate(-90deg)" }}>
          <circle cx={36} cy={36} r={r} fill="none" stroke="#1e1e1e" strokeWidth={6} />
          <circle cx={36} cy={36} r={r} fill="none" stroke={color} strokeWidth={6}
            strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
            strokeLinecap="round" style={{ transition: "stroke-dashoffset 0.6s ease" }} />
        </svg>
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color, lineHeight: 1 }}>
            {pct >= 70 ? "GO" : pct >= 40 ? "EASY" : "REST"}
          </div>
          <div style={{ fontSize: 9, color: "#555" }}>{pct}%</div>
        </div>
      </div>
      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color, letterSpacing: "0.06em" }}>
          {pct >= 70 ? "Train Hard" : pct >= 40 ? "Train Light" : "Rest Today"}
        </div>
        {flags >= 2 && <div style={{ fontSize: 11, color: "#f06060", marginTop: 2 }}>⚠ 2+ signals red — rest recommended</div>}
      </div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("dashboard");
  const [activeSession, setActiveSession] = useState(null);
  const [logs, setLogs] = useState({});
  const [readiness, setReadiness] = useState({});
  const [sessionData, setSessionData] = useState({});
  const [warmupDone, setWarmupDone] = useState(false);
  const [checkin, setCheckin] = useState({ hrv: "", bodyBattery: "", rhrDelta: "" });
  const [checkinSaved, setCheckinSaved] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [editingReadiness, setEditingReadiness] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) { const p = JSON.parse(saved); setLogs(p.logs || {}); setReadiness(p.readiness || {}); }
    } catch {}
  }, []);

  const persist = (l, r) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ logs: l, readiness: r }));
  const todayKey = () => new Date().toISOString().split("T")[0];

  const saveCheckin = () => {
    const nr = { ...readiness, [todayKey()]: { ...checkin, ts: Date.now() } };
    setReadiness(nr); persist(logs, nr); setCheckinSaved(true);
  };

  const todayCheckin = readiness[todayKey()];
  const todayScore = getReadinessScore(todayCheckin);

  const startSession = (type) => {
    setActiveSession(type); setWarmupDone(false);
    const init = {};
    WORKOUTS[type].forEach((ex, i) => { init[i] = Array.from({ length: ex.sets }, () => ({ weight: "", reps: "" })); });
    setSessionData(init); setView("session");
  };

  const finishSession = () => {
    const nl = { ...logs, [todayKey()]: { type: activeSession, data: sessionData, ts: Date.now() } };
    setLogs(nl); persist(nl, readiness); setActiveSession(null); setView("dashboard");
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    setSessionData(prev => {
      const u = { ...prev };
      u[exIdx] = u[exIdx].map((s, i) => i === setIdx ? { ...s, [field]: value } : s);
      return u;
    });
  };

  const getLastLog = (type) => {
    const m = Object.entries(logs).filter(([, v]) => v.type === type).sort(([a], [b]) => b.localeCompare(a));
    return m.length ? m[0][1] : null;
  };

  const last7 = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    const key = d.toISOString().split("T")[0];
    return { key, day: d.toLocaleDateString("en-US", { weekday: "short" }), score: getReadinessScore(readiness[key]) };
  });

  const typeBg = t => t === "lift" ? "rgba(200,240,96,0.08)" : t === "cardio" ? "rgba(96,200,240,0.08)" : "transparent";

  const NAV = ["dashboard", "readiness", "history", "schedule"];

  return (
    <div style={{ minHeight: "100dvh", background: "#0e0e0e", color: "#e8e8e0", fontFamily: "'DM Mono', 'Courier New', monospace", paddingBottom: "calc(60px + env(safe-area-inset-bottom))" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { margin: 0; overscroll-behavior: none; }
        input { background: #1a1a1a; border: 1px solid #2a2a2a; color: #e8e8e0; font-family: 'DM Mono', monospace; border-radius: 4px; padding: 10px 12px; width: 100%; font-size: 16px; }
        input:focus { outline: none; border-color: #c8f060; }
        .btn { cursor: pointer; border: none; font-family: 'DM Mono', monospace; border-radius: 6px; padding: 12px 18px; font-size: 14px; font-weight: 500; transition: all 0.15s; -webkit-tap-highlight-color: transparent; }
        .btn-primary { background: #c8f060; color: #0e0e0e; }
        .btn-primary:active { background: #d9ff70; }
        .btn-ghost { background: transparent; color: #888; border: 1px solid #2a2a2a; }
        .btn-ghost:active { border-color: #555; color: #e8e8e0; }
        .card { background: #141414; border: 1px solid #1e1e1e; border-radius: 10px; padding: 16px; }
        .tag { display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 11px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; }
        ::-webkit-scrollbar { display: none; }
        .session-btn { background: #141414; border: 1px solid #1e1e1e; border-radius: 10px; padding: 16px; cursor: pointer; transition: all 0.15s; text-align: left; width: 100%; }
        .session-btn:active { border-color: #c8f060; background: rgba(200,240,96,0.05); }
        .hrv-pill { cursor: pointer; padding: 10px 14px; border-radius: 6px; border: 1px solid #2a2a2a; font-size: 13px; background: #1a1a1a; transition: all 0.15s; font-family: 'DM Mono', monospace; }
        .nav-btn { flex: 1; background: transparent; border: none; font-family: 'DM Mono', monospace; font-size: 9px; color: #555; padding: 8px 4px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.06em; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: color 0.15s; }
        .nav-btn.active { color: #c8f060; }
        .nav-icon { font-size: 18px; line-height: 1; }
      `}</style>

      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#0e0e0e", borderBottom: "1px solid #1e1e1e", padding: "env(safe-area-inset-top) 20px 12px", paddingTop: `max(env(safe-area-inset-top), 12px)` }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.1em", color: "#c8f060" }}>
          {view === "session" && activeSession ? `${activeSession.toUpperCase()} DAY` : view === "edit-session" ? "EDIT SESSION" : view === "edit-readiness" ? "EDIT READINESS" : "VISCERAL CUT"}
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 0" }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            <div className="card" style={{ marginBottom: 14, borderColor: todayScore ? (todayScore.pct >= 70 ? "#2a3a1a" : todayScore.pct >= 40 ? "#3a2a10" : "#3a1a1a") : "#1e1e1e" }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>TODAY'S READINESS</div>
              {todayCheckin ? (
                <>
                  <ReadinessGauge pct={todayScore.pct} flags={todayScore.flags} />
                  <div style={{ display: "flex", gap: 20, marginTop: 12, paddingTop: 10, borderTop: "1px solid #1e1e1e" }}>
                    {[["HRV", todayCheckin.hrv, HRV_COLORS[todayCheckin.hrv]], ["Body Battery", todayCheckin.bodyBattery, parseInt(todayCheckin.bodyBattery) >= 70 ? "#c8f060" : parseInt(todayCheckin.bodyBattery) >= 40 ? "#f0a040" : "#f06060"], ["RHR Δ", todayCheckin.rhrDelta !== "" ? `${todayCheckin.rhrDelta > 0 ? "+" : ""}${todayCheckin.rhrDelta} bpm` : "—", parseInt(todayCheckin.rhrDelta) <= 0 ? "#c8f060" : parseInt(todayCheckin.rhrDelta) <= 3 ? "#f0a040" : "#f06060"]].map(([label, val, color]) => (
                      <div key={label} style={{ fontSize: 11 }}>
                        <div style={{ color: "#444", marginBottom: 2 }}>{label}</div>
                        <div style={{ color: color || "#888" }}>{val || "—"}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ fontSize: 12, color: "#555" }}>No check-in yet</div>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: "8px 12px" }} onClick={() => setView("readiness")}>Check In →</button>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>7-DAY READINESS</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
                {last7.map(({ key, day, score }) => {
                  const color = !score ? "#2a2a2a" : score.pct >= 70 ? "#c8f060" : score.pct >= 40 ? "#f0a040" : "#f06060";
                  return (
                    <div key={key} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: key === todayKey() ? "#c8f060" : "#444", marginBottom: 3 }}>{day}</div>
                      <div style={{ height: 28, borderRadius: 4, background: score ? color + "15" : "#141414", border: `1px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ fontSize: 9, color: score ? color : "#333" }}>{score ? `${score.pct}%` : "—"}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>START SESSION</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                {["Push", "Pull", "Legs", "Core"].map(type => {
                  const last = getLastLog(type);
                  const subtitle = { Push: "Chest·Shoulder·Tri", Pull: "Back·Bi·Rear Delt", Legs: "Quads·Hams·Glutes", Core: "Abs·Obliques·Lower Back" }[type];
                  return (
                    <button key={type} className="session-btn" onClick={() => startSession(type)}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: "#c8f060", marginBottom: 2 }}>{type}</div>
                      <div style={{ fontSize: 9, color: "#555", marginBottom: 6 }}>{subtitle}</div>
                      <div style={{ fontSize: 9, color: "#444" }}>{last ? `${new Date(last.ts).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Not started"}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>RECENT SESSIONS</div>
              {Object.entries(logs).length === 0 ? (
                <div className="card" style={{ color: "#444", fontSize: 12, textAlign: "center", padding: 24 }}>No sessions yet.</div>
              ) : Object.entries(logs).sort(([a], [b]) => b.localeCompare(a)).slice(0, 5).map(([date, log]) => {
                const rs = getReadinessScore(readiness[date]);
                return (
                  <div key={date} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#c8f060" }}>{log.type}</div>
                      <div style={{ fontSize: 11, color: "#555" }}>{new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      {rs && <span style={{ fontSize: 11, color: rs.pct >= 70 ? "#c8f060" : rs.pct >= 40 ? "#f0a040" : "#f06060" }}>{rs.pct}%</span>}
                      <span style={{ fontSize: 11, color: "#444" }}>{Object.values(log.data).flat().filter(s => s.weight || s.reps).length} sets</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* READINESS */}
        {view === "readiness" && (
          <div>
            <div style={{ fontSize: 12, color: "#555", marginBottom: 16 }}>Open Garmin Connect → check HRV Status, Body Battery, and RHR before logging.</div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>HRV STATUS <span style={{ color: "#444", fontSize: 10 }}>— Health Snapshot</span></div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {HRV_OPTIONS.map(opt => (
                  <button key={opt} className="hrv-pill" onClick={() => setCheckin(p => ({ ...p, hrv: opt }))}
                    style={{ borderColor: checkin.hrv === opt ? HRV_COLORS[opt] : "#2a2a2a", color: checkin.hrv === opt ? HRV_COLORS[opt] : "#666", background: checkin.hrv === opt ? HRV_COLORS[opt] + "15" : "#1a1a1a" }}>
                    {opt}
                  </button>
                ))}
              </div>
              {checkin.hrv && (
                <div style={{ fontSize: 11, color: "#555", marginTop: 10 }}>
                  {checkin.hrv === "Balanced" && "✓ ANS recovered — cortisol load likely normal"}
                  {checkin.hrv === "Low" && "⚠ Suppressed — high stress load, reduce intensity"}
                  {checkin.hrv === "Unbalanced" && "⚠ Fluctuating — moderate caution today"}
                  {checkin.hrv === "Poor" && "✗ Poor — rest day, especially given your O2 capacity"}
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>BODY BATTERY ON WAKE <span style={{ color: "#444", fontSize: 10 }}>— 0–100</span></div>
              <input type="number" min={0} max={100} placeholder="e.g. 72" value={checkin.bodyBattery}
                onChange={e => setCheckin(p => ({ ...p, bodyBattery: e.target.value }))} />
              {checkin.bodyBattery !== "" && (
                <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
                  {parseInt(checkin.bodyBattery) >= 70 && "✓ High — full effort cleared"}
                  {parseInt(checkin.bodyBattery) >= 40 && parseInt(checkin.bodyBattery) < 70 && "~ Moderate — train within plan"}
                  {parseInt(checkin.bodyBattery) < 40 && "✗ Low — rest or light walk only"}
                </div>
              )}
            </div>

            <div className="card" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 4 }}>RHR vs 7-DAY AVG <span style={{ color: "#444", fontSize: 10 }}>— bpm delta</span></div>
              <div style={{ fontSize: 11, color: "#444", marginBottom: 8 }}>Enter difference: +4 if elevated, -2 if lower than avg</div>
              <input type="number" placeholder="e.g. +3 or -1" value={checkin.rhrDelta}
                onChange={e => setCheckin(p => ({ ...p, rhrDelta: e.target.value }))} />
              {checkin.rhrDelta !== "" && (
                <div style={{ fontSize: 11, color: "#555", marginTop: 8 }}>
                  {parseInt(checkin.rhrDelta) <= 0 && "✓ Normal or below — well recovered"}
                  {parseInt(checkin.rhrDelta) > 0 && parseInt(checkin.rhrDelta) <= 3 && "~ Slightly elevated — monitor during warmup"}
                  {parseInt(checkin.rhrDelta) > 3 && "⚠ Elevated RHR — cut load 30% today"}
                </div>
              )}
            </div>

            {(() => { const p = getReadinessScore(checkin); return p ? (
              <div className="card" style={{ marginBottom: 14, borderColor: p.pct >= 70 ? "#2a3a1a" : p.pct >= 40 ? "#3a2a10" : "#3a1a1a" }}>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>PREVIEW</div>
                <ReadinessGauge pct={p.pct} flags={p.flags} />
              </div>
            ) : null; })()}

            <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 15 }} onClick={saveCheckin}>
              {checkinSaved ? "✓ Saved" : "Save Check-In"}
            </button>

            {Object.keys(readiness).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>LOG</div>
                {Object.entries(readiness).sort(([a], [b]) => b.localeCompare(a)).slice(0, 14).map(([date, r]) => {
                  const s = getReadinessScore(r);
                  const color = s?.pct >= 70 ? "#c8f060" : s?.pct >= 40 ? "#f0a040" : "#f06060";
                  return (
                    <div key={date} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", marginBottom: 8 }}>
                      <div style={{ fontSize: 12, color: "#666" }}>{new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                        {r.hrv && <span style={{ fontSize: 11, color: HRV_COLORS[r.hrv] }}>{r.hrv}</span>}
                        {r.bodyBattery && <span style={{ fontSize: 11, color: "#555" }}>BB {r.bodyBattery}</span>}
                        {r.rhrDelta !== "" && <span style={{ fontSize: 11, color: "#555" }}>RHR {r.rhrDelta > 0 ? "+" : ""}{r.rhrDelta}</span>}
                        {s && <span style={{ fontSize: 12, color, fontWeight: 500 }}>{s.pct}%</span>}
                        <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 10px" }} onClick={() => {
                          setEditingReadiness({ dateKey: date, entry: r, editDate: date, editHrv: r.hrv || "", editBB: r.bodyBattery || "", editRHR: r.rhrDelta !== undefined ? String(r.rhrDelta) : "" });
                          setView("edit-readiness");
                        }}>Edit</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SESSION */}
        {view === "session" && activeSession && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 12px" }} onClick={() => { setView("dashboard"); setActiveSession(null); }}>← Back</button>
              {todayScore && <span style={{ marginLeft: "auto", fontSize: 11, color: todayScore.pct >= 70 ? "#c8f060" : todayScore.pct >= 40 ? "#f0a040" : "#f06060" }}>Readiness {todayScore.pct}%</span>}
            </div>

            {!warmupDone && (
              <div className="card" style={{ marginBottom: 16, borderColor: "#2a3a1a" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: "#8ab040", marginBottom: 12, letterSpacing: "0.08em" }}>WARMUP — 5 MIN</div>
                {WARMUPS[activeSession].map((w, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: i < WARMUPS[activeSession].length - 1 ? "1px solid #1a1a1a" : "none" }}>
                    <div style={{ fontSize: 13 }}>{w.name}</div>
                    <div style={{ fontSize: 12, color: "#666" }}>{w.duration}</div>
                  </div>
                ))}
                <button className="btn btn-primary" style={{ marginTop: 14, width: "100%" }} onClick={() => setWarmupDone(true)}>Warmup Done → Start Lifts</button>
              </div>
            )}

            {warmupDone && WORKOUTS[activeSession].map((ex, exIdx) => {
              const lastSets = getLastLog(activeSession)?.data?.[exIdx] || [];
              const hideWeight = ex.type === "bodyweight" || ex.type === "time";
              const repLabel = ex.type === "time" ? "SEC" : "REPS";
              const repPh = ex.type === "time" ? "sec" : "reps";
              const gridCols = hideWeight ? "24px 1fr 64px" : "24px 1fr 1fr 64px";
              return (
                <div key={exIdx} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500 }}>{ex.name}</div>
                      {ex.note && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{ex.note}</div>}
                    </div>
                    <div style={{ fontSize: 11, color: "#777", textAlign: "right" }}>{ex.sets}×{ex.reps}{ex.type === "time" ? "s" : ""}</div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 6, marginBottom: 6 }}>
                    <div />
                    {!hideWeight && <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>LBS</div>}
                    <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>{repLabel}</div>
                    <div style={{ fontSize: 10, color: "#444", textAlign: "center" }}>PREV</div>
                  </div>
                  {Array.from({ length: ex.sets }).map((_, setIdx) => {
                    const prev = lastSets[setIdx];
                    return (
                      <div key={setIdx} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 6, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "#555", textAlign: "center", paddingTop: 10 }}>{setIdx + 1}</div>
                        {!hideWeight && (
                          <input type="number" inputMode="decimal" placeholder="lbs" value={sessionData[exIdx]?.[setIdx]?.weight || ""}
                            onChange={e => updateSet(exIdx, setIdx, "weight", e.target.value)} style={{ textAlign: "center" }} />
                        )}
                        <input type="number" inputMode="numeric" placeholder={repPh} value={sessionData[exIdx]?.[setIdx]?.reps || ""}
                          onChange={e => updateSet(exIdx, setIdx, "reps", e.target.value)} style={{ textAlign: "center" }} />
                        <div style={{ fontSize: 11, color: "#444", textAlign: "center", paddingTop: 10 }}>{formatPrev(prev, ex.type)}</div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {warmupDone && <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 4 }} onClick={finishSession}>Finish & Save</button>}
          </div>
        )}

        {/* EDIT SESSION */}
        {view === "edit-session" && editingLog && (() => {
          const logType = editingLog.log.type;
          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 12px" }} onClick={() => { setView("history"); setEditingLog(null); }}>← Back</button>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#c8f060", marginLeft: "auto" }}>{logType}</span>
              </div>

              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>DATE</div>
                <input type="date" value={editingLog.editDate}
                  onChange={e => setEditingLog(prev => ({ ...prev, editDate: e.target.value }))}
                  style={{ colorScheme: "dark" }} />
              </div>

              {WORKOUTS[logType].map((ex, exIdx) => {
                const hideWeight = ex.type === "bodyweight" || ex.type === "time";
                const repLabel = ex.type === "time" ? "SEC" : "REPS";
                const repPh = ex.type === "time" ? "sec" : "reps";
                const gridCols = hideWeight ? "24px 1fr" : "24px 1fr 1fr";
                return (
                  <div key={exIdx} className="card" style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>{ex.name}</div>
                        {ex.note && <div style={{ fontSize: 11, color: "#555", marginTop: 2 }}>{ex.note}</div>}
                      </div>
                      <div style={{ fontSize: 11, color: "#777", textAlign: "right" }}>{ex.sets}×{ex.reps}{ex.type === "time" ? "s" : ""}</div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 6, marginBottom: 6 }}>
                      <div />
                      {!hideWeight && <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>LBS</div>}
                      <div style={{ fontSize: 10, color: "#555", textAlign: "center" }}>{repLabel}</div>
                    </div>
                    {Array.from({ length: ex.sets }).map((_, setIdx) => (
                      <div key={setIdx} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 6, marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "#555", textAlign: "center", paddingTop: 10 }}>{setIdx + 1}</div>
                        {!hideWeight && (
                          <input type="number" inputMode="decimal" placeholder="lbs" value={editingLog.editData[exIdx]?.[setIdx]?.weight || ""}
                            onChange={e => setEditingLog(prev => {
                              const d = { ...prev.editData };
                              d[exIdx] = d[exIdx].map((s, i) => i === setIdx ? { ...s, weight: e.target.value } : s);
                              return { ...prev, editData: d };
                            })} style={{ textAlign: "center" }} />
                        )}
                        <input type="number" inputMode="numeric" placeholder={repPh} value={editingLog.editData[exIdx]?.[setIdx]?.reps || ""}
                          onChange={e => setEditingLog(prev => {
                            const d = { ...prev.editData };
                            d[exIdx] = d[exIdx].map((s, i) => i === setIdx ? { ...s, reps: e.target.value } : s);
                            return { ...prev, editData: d };
                          })} style={{ textAlign: "center" }} />
                      </div>
                    ))}
                  </div>
                );
              })}

              <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 4 }} onClick={() => {
                const nl = { ...logs };
                if (editingLog.editDate !== editingLog.dateKey) delete nl[editingLog.dateKey];
                nl[editingLog.editDate] = { type: logType, data: editingLog.editData, ts: editingLog.log.ts };
                setLogs(nl); persist(nl, readiness); setEditingLog(null); setView("history");
              }}>Save Changes</button>

              <button className="btn btn-ghost" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 8, color: "#f06060", borderColor: "#3a1a1a" }} onClick={() => {
                if (confirm("Delete this session?")) {
                  const nl = { ...logs };
                  delete nl[editingLog.dateKey];
                  setLogs(nl); persist(nl, readiness); setEditingLog(null); setView("history");
                }
              }}>Delete Session</button>
            </div>
          );
        })()}

        {/* EDIT READINESS */}
        {view === "edit-readiness" && editingReadiness && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 12px" }} onClick={() => { setView("readiness"); setEditingReadiness(null); }}>← Back</button>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>DATE</div>
              <input type="date" value={editingReadiness.editDate}
                onChange={e => setEditingReadiness(prev => ({ ...prev, editDate: e.target.value }))}
                style={{ colorScheme: "dark" }} />
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>HRV STATUS</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {HRV_OPTIONS.map(opt => (
                  <button key={opt} className="hrv-pill" onClick={() => setEditingReadiness(prev => ({ ...prev, editHrv: opt }))}
                    style={{ borderColor: editingReadiness.editHrv === opt ? HRV_COLORS[opt] : "#2a2a2a", color: editingReadiness.editHrv === opt ? HRV_COLORS[opt] : "#666", background: editingReadiness.editHrv === opt ? HRV_COLORS[opt] + "15" : "#1a1a1a" }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>BODY BATTERY ON WAKE <span style={{ color: "#444", fontSize: 10 }}>— 0–100</span></div>
              <input type="number" min={0} max={100} placeholder="e.g. 72" value={editingReadiness.editBB}
                onChange={e => setEditingReadiness(prev => ({ ...prev, editBB: e.target.value }))} />
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>RHR vs 7-DAY AVG <span style={{ color: "#444", fontSize: 10 }}>— bpm delta</span></div>
              <input type="number" placeholder="e.g. +3 or -1" value={editingReadiness.editRHR}
                onChange={e => setEditingReadiness(prev => ({ ...prev, editRHR: e.target.value }))} />
            </div>

            {(() => { const p = getReadinessScore({ hrv: editingReadiness.editHrv, bodyBattery: editingReadiness.editBB, rhrDelta: editingReadiness.editRHR }); return p ? (
              <div className="card" style={{ marginBottom: 14, borderColor: p.pct >= 70 ? "#2a3a1a" : p.pct >= 40 ? "#3a2a10" : "#3a1a1a" }}>
                <div style={{ fontSize: 11, color: "#555", marginBottom: 10 }}>PREVIEW</div>
                <ReadinessGauge pct={p.pct} flags={p.flags} />
              </div>
            ) : null; })()}

            <button className="btn btn-primary" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 4 }} onClick={() => {
              const nr = { ...readiness };
              if (editingReadiness.editDate !== editingReadiness.dateKey) delete nr[editingReadiness.dateKey];
              nr[editingReadiness.editDate] = { hrv: editingReadiness.editHrv, bodyBattery: editingReadiness.editBB, rhrDelta: editingReadiness.editRHR, ts: editingReadiness.entry.ts };
              setReadiness(nr); persist(logs, nr); setEditingReadiness(null); setView("readiness");
            }}>Save Changes</button>

            <button className="btn btn-ghost" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 8, color: "#f06060", borderColor: "#3a1a1a" }} onClick={() => {
              if (confirm("Delete this readiness entry?")) {
                const nr = { ...readiness };
                delete nr[editingReadiness.dateKey];
                setReadiness(nr); persist(logs, nr); setEditingReadiness(null); setView("readiness");
              }
            }}>Delete Entry</button>
          </div>
        )}

        {/* HISTORY */}
        {view === "history" && (
          <div>
            {Object.entries(logs).length === 0 ? (
              <div className="card" style={{ color: "#444", textAlign: "center", padding: 40 }}>No sessions yet.</div>
            ) : Object.entries(logs).sort(([a], [b]) => b.localeCompare(a)).map(([date, log]) => {
              const rs = getReadinessScore(readiness[date]);
              return (
                <div key={date} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: "#c8f060", marginRight: 8 }}>{log.type}</span>
                      <span style={{ fontSize: 11, color: "#555" }}>{new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {rs && <span style={{ fontSize: 11, color: rs.pct >= 70 ? "#c8f060" : rs.pct >= 40 ? "#f0a040" : "#f06060" }}>{rs.pct}% ready</span>}
                      <button className="btn btn-ghost" style={{ fontSize: 10, padding: "4px 10px" }} onClick={() => {
                        const editData = {};
                        WORKOUTS[log.type].forEach((ex, i) => {
                          editData[i] = log.data?.[i] ? log.data[i].map(s => ({ ...s })) : Array.from({ length: ex.sets }, () => ({ weight: "", reps: "" }));
                        });
                        setEditingLog({ dateKey: date, log, editDate: date, editData });
                        setView("edit-session");
                      }}>Edit</button>
                    </div>
                  </div>
                  {WORKOUTS[log.type].map((ex, exIdx) => {
                    const sets = log.data?.[exIdx]?.filter(s => s.weight || s.reps) || [];
                    if (!sets.length) return null;
                    return (
                      <div key={exIdx} style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: "#666", marginBottom: 4 }}>{ex.name}</div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {sets.map((s, i) => (
                            <span key={i} style={{ fontSize: 11, background: "#1a1a1a", padding: "2px 8px", borderRadius: 3, color: "#c8f060" }}>
                              {formatSet(s, ex.type)}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* SCHEDULE */}
        {view === "schedule" && (
          <div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
              {WEEK_TEMPLATE.map(({ day, session, type }) => (
                <div key={day} className="card" style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 14px", background: typeBg(type) }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "#555", minWidth: 32 }}>{day}</div>
                  <div style={{ flex: 1, fontSize: 13 }}>{session}</div>
                  {type === "lift" && <span className="tag" style={{ background: "rgba(200,240,96,0.12)", color: "#c8f060" }}>Lift</span>}
                  {type === "cardio" && <span className="tag" style={{ background: "rgba(96,200,240,0.12)", color: "#60c8f0" }}>Cardio</span>}
                  {type === "rest" && <span className="tag" style={{ background: "rgba(80,80,80,0.2)", color: "#555" }}>Rest</span>}
                </div>
              ))}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>PROGRESSION</div>
            <div className="card" style={{ marginBottom: 20 }}>
              {[["Wk 1–2","Establish weights. RPE 7–8."],["Wk 3–4","Add reps or +2.5–5 lbs."],["Wk 5","Deload — 40% volume, keep intensity."],["Repeat","Each cycle beats the last."]].map(([l,d],i) => (
                <div key={i} style={{ display: "flex", gap: 12, padding: "8px 0", borderBottom: i < 3 ? "1px solid #1a1a1a" : "none" }}>
                  <div style={{ fontSize: 12, color: "#c8f060", minWidth: 60 }}>{l}</div>
                  <div style={{ fontSize: 12, color: "#666" }}>{d}</div>
                </div>
              ))}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>FLEX RULES</div>
            <div className="card">
              {["Don't stack Legs + long run same or consecutive days","Shift lifts around trail/snowboard — reschedule, don't skip","Hard cardio day = maintenance cals, not deficit","Elevated RHR or poor HRV = reduce load, not session","Readiness < 40% = rest regardless of the plan"].map((rule, i, arr) => (
                <div key={i} style={{ fontSize: 12, color: "#666", padding: "8px 0 8px 10px", borderBottom: i < arr.length - 1 ? "1px solid #1a1a1a" : "none", borderLeft: "2px solid #2a2a2a" }}>{rule}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e0e0e", borderTop: "1px solid #1e1e1e", display: "flex", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 100 }}>
        {[["dashboard","⊞","Home"],["readiness","◎","Ready"],["history","≡","Log"],["schedule","▦","Plan"]].map(([v, icon, label]) => (
          <button key={v} className={`nav-btn ${view === v || (view === "session" && v === "dashboard") || (view === "edit-session" && v === "history") || (view === "edit-readiness" && v === "readiness") ? "active" : ""}`}
            onClick={() => { if (v === "dashboard" && view === "session") { setView("dashboard"); setActiveSession(null); } else if (view === "edit-session" || view === "edit-readiness") { setEditingLog(null); setEditingReadiness(null); setView(v); } else setView(v); }}>
            <span className="nav-icon">{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
