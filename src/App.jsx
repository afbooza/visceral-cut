import { useState, useEffect, useRef } from "react";
import { getToken, saveToken, fetchLogs, pushLog, pushLogsBulk, removeLog, fetchDraft, pushDraft, clearRemoteDraft } from "./sync.js";

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
    { name: "DB Bench Press", sets: 4, reps: "8-10", note: "Heavy, controlled descent" },
    { name: "DB Fly", sets: 3, reps: "12", note: "Slight elbow bend, stretch at bottom — no shoulder strain" },
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

const STORAGE_KEY = "tony-workout-tracker-v2";
const DRAFT_KEY = "tony-workout-draft";
const TYPE_COLORS = { Push: "#c8f060", Pull: "#60c8f0", Legs: "#f0a040", Core: "#d060f0" };
const SYNC_COLORS = { synced: "#c8f060", pending: "#f0a040", error: "#f06060" };

// Newer entry wins, per date. `up` = last-updated timestamp (falls back to `ts` for old entries).
function mergeLogs(local, remote) {
  const merged = { ...remote };
  for (const [date, log] of Object.entries(local)) {
    const r = merged[date];
    if (!r || (log.up || log.ts || 0) > (r.up || r.ts || 0)) merged[date] = log;
  }
  return merged;
}

function readLocal() {
  let logs = {}, draft = null;
  try { const saved = localStorage.getItem(STORAGE_KEY); if (saved) logs = JSON.parse(saved).logs || {}; } catch {}
  try { const d = localStorage.getItem(DRAFT_KEY); if (d) draft = JSON.parse(d); } catch {}
  return { logs, draft };
}

// YYYY-MM-DD in the device's local timezone (toISOString is UTC — after 5-6pm MT it rolls to tomorrow)
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

export default function App() {
  const [view, setView] = useState("dashboard");
  const [activeSession, setActiveSession] = useState(null);
  const [logs, setLogs] = useState({});
  const [sessionData, setSessionData] = useState({});
  const [warmupDone, setWarmupDone] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [draft, setDraft] = useState(null);
  const [syncState, setSyncState] = useState(getToken() ? "pending" : "off"); // off | pending | synced | error
  const [tokenInput, setTokenInput] = useState(getToken());
  const draftTimer = useRef(null);

  useEffect(() => {
    const { logs: local, draft: localDraft } = readLocal();
    setLogs(local);
    if (localDraft) setDraft(localDraft);
    syncNow();
  }, []);

  const persist = (l) => localStorage.setItem(STORAGE_KEY, JSON.stringify({ logs: l }));
  const todayKey = () => dateKey(new Date());

  // Fire-and-forget remote write; local state is already saved, so failures only flip the status dot.
  const remote = (fn) => {
    if (!getToken()) return;
    setSyncState("pending");
    fn().then(() => setSyncState("synced")).catch(() => setSyncState("error"));
  };

  // Full two-way sync: pull remote, merge (newer wins per date), push anything the server is missing.
  const syncNow = async () => {
    if (!getToken()) { setSyncState("off"); return; }
    setSyncState("pending");
    try {
      const { logs: local, draft: localDraft } = readLocal();
      const [remoteLogs, remoteDraft] = await Promise.all([fetchLogs(), fetchDraft()]);
      const merged = mergeLogs(local, remoteLogs);
      setLogs(merged); persist(merged);
      const toPush = {};
      for (const [date, log] of Object.entries(merged)) {
        const r = remoteLogs[date];
        if (!r || (log.up || log.ts || 0) > (r.up || r.ts || 0)) toPush[date] = log;
      }
      if (Object.keys(toPush).length) await pushLogsBulk(toPush);
      const bestDraft = [localDraft, remoteDraft].filter(Boolean).sort((a, b) => (b.ts || 0) - (a.ts || 0))[0] || null;
      if (bestDraft) {
        setDraft(bestDraft);
        try { localStorage.setItem(DRAFT_KEY, JSON.stringify(bestDraft)); } catch {}
      }
      setSyncState("synced");
    } catch {
      setSyncState("error");
    }
  };

  // Save in-progress session locally on every keystroke; push to server debounced.
  const saveDraft = (data) => {
    const d = { type: activeSession, date: todayKey(), data, ts: Date.now() };
    setDraft(d);
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(d)); } catch {}
    if (draftTimer.current) clearTimeout(draftTimer.current);
    draftTimer.current = setTimeout(() => remote(() => pushDraft(d)), 1500);
  };

  const discardDraft = () => {
    setDraft(null);
    if (draftTimer.current) clearTimeout(draftTimer.current);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
    remote(() => clearRemoteDraft());
  };

  const resumeDraft = () => {
    if (!draft) return;
    setActiveSession(draft.type); setWarmupDone(true);
    const init = {};
    WORKOUTS[draft.type].forEach((ex, i) => {
      init[i] = Array.from({ length: ex.sets }, (_, si) => draft.data?.[i]?.[si] ? { ...draft.data[i][si] } : ({ weight: "", reps: "" }));
    });
    setSessionData(init); setView("session");
  };

  const startSession = (type) => {
    setActiveSession(type); setWarmupDone(false);
    const init = {};
    WORKOUTS[type].forEach((ex, i) => { init[i] = Array.from({ length: ex.sets }, () => ({ weight: "", reps: "" })); });
    setSessionData(init); setView("session");
  };

  const finishSession = () => {
    const key = todayKey();
    const log = { type: activeSession, data: sessionData, ts: Date.now(), up: Date.now() };
    const nl = { ...logs, [key]: log };
    setLogs(nl); persist(nl); discardDraft();
    remote(() => pushLog(key, log));
    setActiveSession(null); setView("dashboard");
  };

  const updateSet = (exIdx, setIdx, field, value) => {
    const u = { ...sessionData };
    u[exIdx] = (u[exIdx] || []).map((s, i) => i === setIdx ? { ...s, [field]: value } : s);
    setSessionData(u);
    saveDraft(u);
  };

  const getLastLog = (type) => {
    const m = Object.entries(logs).filter(([, v]) => v.type === type).sort(([a], [b]) => b.localeCompare(a));
    return m.length ? m[0][1] : null;
  };

  const week = (() => {
    const today = new Date();
    const mondayOffset = -((today.getDay() + 6) % 7);
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() + mondayOffset + i);
      const key = dateKey(d);
      return {
        key,
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        log: logs[key],
      };
    });
  })();

  const typeBg = t => t === "lift" ? "rgba(200,240,96,0.08)" : t === "cardio" ? "rgba(96,200,240,0.08)" : "transparent";

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
        .nav-btn { flex: 1; background: transparent; border: none; font-family: 'DM Mono', monospace; font-size: 9px; color: #555; padding: 8px 4px; cursor: pointer; text-transform: uppercase; letter-spacing: 0.06em; display: flex; flex-direction: column; align-items: center; gap: 4px; transition: color 0.15s; }
        .nav-btn.active { color: #c8f060; }
        .nav-icon { font-size: 18px; line-height: 1; }
      `}</style>

      {/* Top bar */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: "#0e0e0e", borderBottom: "1px solid #1e1e1e", padding: "env(safe-area-inset-top) 20px 12px", paddingTop: `max(env(safe-area-inset-top), 12px)`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 24, letterSpacing: "0.1em", color: "#c8f060" }}>
          {view === "session" && activeSession ? `${activeSession.toUpperCase()} DAY` : view === "edit-session" ? "EDIT SESSION" : view === "settings" ? "SYNC & BACKUP" : "VISCERAL CUT"}
        </div>
        {syncState !== "off" && (
          <div style={{ width: 8, height: 8, borderRadius: 4, background: SYNC_COLORS[syncState] || "#555", flexShrink: 0 }} />
        )}
      </div>

      {/* Content */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 16px 0" }}>

        {/* DASHBOARD */}
        {view === "dashboard" && (
          <div>
            {draft && (
              <div className="card" style={{ marginBottom: 16, borderColor: "#3a4a1a", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: "#c8f060", letterSpacing: "0.06em" }}>SESSION IN PROGRESS</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>
                    {draft.type} · {draft.date} · {Object.values(draft.data || {}).flat().filter(s => s.weight || s.reps).length} sets logged
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 11, padding: "8px 10px", color: "#f06060", borderColor: "#3a1a1a" }}
                    onClick={() => { if (confirm("Discard the in-progress session?")) discardDraft(); }}>✕</button>
                  <button className="btn btn-primary" style={{ fontSize: 12, padding: "8px 14px" }} onClick={resumeDraft}>Resume</button>
                </div>
              </div>
            )}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>THIS WEEK</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5 }}>
                {week.map(({ key, day, date, log }) => {
                  const isToday = key === todayKey();
                  const color = log ? (TYPE_COLORS[log.type] || "#c8f060") : "#2a2a2a";
                  return (
                    <div key={key} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, color: isToday ? "#c8f060" : "#444", marginBottom: 2 }}>{day}</div>
                      <div style={{ fontSize: 9, color: isToday ? "#c8f060" : "#555", marginBottom: 4 }}>{date}</div>
                      <div style={{ height: 32, borderRadius: 4, background: log ? color + "15" : "#141414", border: `1px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ fontFamily: log ? "'Bebas Neue', sans-serif" : "inherit", fontSize: log ? 13 : 9, color: log ? color : "#333", letterSpacing: log ? "0.05em" : 0 }}>{log ? log.type : "—"}</div>
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
              ) : Object.entries(logs).sort(([a], [b]) => b.localeCompare(a)).slice(0, 5).map(([date, log]) => (
                <div key={date} className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: TYPE_COLORS[log.type] || "#c8f060" }}>{log.type}</div>
                    <div style={{ fontSize: 11, color: "#555" }}>{new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</div>
                  </div>
                  <span style={{ fontSize: 11, color: "#444" }}>{Object.values(log.data).flat().filter(s => s.weight || s.reps).length} sets</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SESSION */}
        {view === "session" && activeSession && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button className="btn btn-ghost" style={{ fontSize: 12, padding: "8px 12px" }} onClick={() => { setView("dashboard"); setActiveSession(null); }}>← Back</button>
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
                const moved = editingLog.editDate !== editingLog.dateKey;
                if (moved) delete nl[editingLog.dateKey];
                const log = { type: logType, data: editingLog.editData, ts: editingLog.log.ts, up: Date.now() };
                nl[editingLog.editDate] = log;
                setLogs(nl); persist(nl);
                remote(async () => {
                  if (moved) await removeLog(editingLog.dateKey);
                  await pushLog(editingLog.editDate, log);
                });
                setEditingLog(null); setView("history");
              }}>Save Changes</button>

              <button className="btn btn-ghost" style={{ width: "100%", padding: 14, fontSize: 15, marginTop: 8, color: "#f06060", borderColor: "#3a1a1a" }} onClick={() => {
                if (confirm("Delete this session?")) {
                  const nl = { ...logs };
                  delete nl[editingLog.dateKey];
                  setLogs(nl); persist(nl);
                  remote(() => removeLog(editingLog.dateKey));
                  setEditingLog(null); setView("history");
                }
              }}>Delete Session</button>
            </div>
          );
        })()}

        {/* HISTORY */}
        {view === "history" && (
          <div>
            {Object.entries(logs).length === 0 ? (
              <div className="card" style={{ color: "#444", textAlign: "center", padding: 40 }}>No sessions yet.</div>
            ) : Object.entries(logs).sort(([a], [b]) => b.localeCompare(a)).map(([date, log]) => (
                <div key={date} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: TYPE_COLORS[log.type] || "#c8f060", marginRight: 8 }}>{log.type}</span>
                      <span style={{ fontSize: 11, color: "#555" }}>{new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
              ))}
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
              {["Don't stack Legs + long run same or consecutive days","Shift lifts around trail/snowboard — reschedule, don't skip","Hard cardio day = maintenance cals, not deficit","If recovery feels off, cut load not the session"].map((rule, i, arr) => (
                <div key={i} style={{ fontSize: 12, color: "#666", padding: "8px 0 8px 10px", borderBottom: i < arr.length - 1 ? "1px solid #1a1a1a" : "none", borderLeft: "2px solid #2a2a2a" }}>{rule}</div>
              ))}
            </div>
          </div>
        )}

        {/* SETTINGS / SYNC */}
        {view === "settings" && (
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>CLOUD SYNC</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <div style={{ width: 8, height: 8, borderRadius: 4, background: SYNC_COLORS[syncState] || "#555", flexShrink: 0 }} />
                <div style={{ fontSize: 12, color: "#888" }}>
                  {syncState === "off" && "Local only — enter your sync token to enable cloud backup."}
                  {syncState === "pending" && "Syncing…"}
                  {syncState === "synced" && `Synced · ${Object.keys(logs).length} sessions`}
                  {syncState === "error" && "Sync failed — check token or connection."}
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#555", marginBottom: 6 }}>SYNC TOKEN</div>
              <input type="text" placeholder="paste token" value={tokenInput} autoCapitalize="none" autoCorrect="off" spellCheck={false}
                onChange={e => setTokenInput(e.target.value)} style={{ marginBottom: 10 }} />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => { saveToken(tokenInput.trim()); syncNow(); }}>Save & Sync</button>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={syncNow} disabled={syncState === "pending"}>Sync Now</button>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: "#555", marginBottom: 10, letterSpacing: "0.08em" }}>BACKUP</div>
              <div style={{ fontSize: 12, color: "#666", marginBottom: 12 }}>{Object.keys(logs).length} sessions on this device.</div>
              <button className="btn btn-ghost" style={{ width: "100%" }} onClick={async () => {
                const payload = JSON.stringify({ logs }, null, 2);
                try {
                  await navigator.clipboard.writeText(payload);
                  alert(`Copied ${Object.keys(logs).length} sessions to clipboard.`);
                } catch {
                  try { await navigator.share({ text: payload }); } catch {}
                }
              }}>Copy Backup JSON</button>
            </div>

            <div style={{ fontSize: 10, color: "#444", lineHeight: 1.6, padding: "0 4px" }}>
              Every set you enter is saved on this device instantly and pushed to the cloud within seconds. Closing the app mid-workout is safe — you'll get a Resume banner when you come back.
            </div>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0e0e0e", borderTop: "1px solid #1e1e1e", display: "flex", paddingBottom: "env(safe-area-inset-bottom)", zIndex: 100 }}>
        {[["dashboard","⊞","Home"],["history","≡","Log"],["schedule","▦","Plan"],["settings","⟳","Sync"]].map(([v, icon, label]) => (
          <button key={v} className={`nav-btn ${view === v || (view === "session" && v === "dashboard") || (view === "edit-session" && v === "history") ? "active" : ""}`}
            onClick={() => { if (v === "dashboard" && view === "session") { setView("dashboard"); setActiveSession(null); } else if (view === "edit-session") { setEditingLog(null); setView(v); } else setView(v); }}>
            <span className="nav-icon">{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
