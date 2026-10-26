import { useEffect, useRef, useState } from "react";

/* ---------- Voices: 2 female, 2 male ---------- */
export const VOICES = [
  { id: "aria",  name: "Aria",  gender: "female", tone: "Warm and friendly", pitch: 1.15, rate: 1.0 },
  { id: "meera", name: "Meera", gender: "female", tone: "Calm and clear",    pitch: 1.0,  rate: 0.95 },
  { id: "arjun", name: "Arjun", gender: "male",   tone: "Deep and steady",   pitch: 0.75, rate: 0.95 },
  { id: "kabir", name: "Kabir", gender: "male",   tone: "Bright and quick",  pitch: 0.9,  rate: 1.05 },
];
const LANGS = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };
const FEMALE = /female|zira|heera|veena|samantha|aria|jenny|neerja|swara|google (हिन्दी|hindi)|kalpana/i;
const MALE = /\bmale\b|david|mark|ravi|hemant|madhur|prabhat|guy|rishi/i;
const KEY = "personal-ai-settings";
const DEFAULTS = { voice: "aria", speed: 1, pitch: 1, autoSpeak: true, lang: "en", instructions: "", files: [] };

export const loadSettings = () => {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; }
  catch { return DEFAULTS; }
};

/* Use anywhere: speak(answerText, "hi") */
export function speak(text, langKey) {
  const s = loadSettings();
  const v = VOICES.find((x) => x.id === s.voice) || VOICES[0];
  const lang = LANGS[langKey || s.lang] || "en-IN";
  const all = window.speechSynthesis.getVoices();
  const inLang = all.filter((x) => x.lang.replace("_", "-").toLowerCase().startsWith(lang.slice(0, 2)));
  const pool = (inLang.length ? inLang : all);
  const gendered = pool.filter((x) => (v.gender === "female" ? FEMALE : MALE).test(x.name));
  const idx = VOICES.filter((x) => x.gender === v.gender).findIndex((x) => x.id === v.id);
  const pick = gendered.length ? gendered[idx % gendered.length] : pool[0];
  const u = new SpeechSynthesisUtterance(text);
  if (pick) u.voice = pick;
  u.lang = lang;
  u.rate = v.rate * s.speed;
  u.pitch = v.pitch * s.pitch;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

const SAMPLE = {
  en: "Hi, I am your personal tutor. Let us learn something new today.",
  hi: "नमस्ते, मैं आपका निजी शिक्षक हूँ। आज कुछ नया सीखते हैं।",
  mr: "नमस्कार, मी तुमचा वैयक्तिक शिक्षक आहे. आज काहीतरी नवीन शिकूया.",
};
const CONTEXT_LIMIT = 20000; // characters of file text sent as context

/* ---------- Component ---------- */
export default function SettingsPanel({ open = true, onClose = () => {}, onChange = () => {} }) {
  const [s, setS] = useState(loadSettings);
  const [tab, setTab] = useState("voice");
  const [drag, setDrag] = useState(false);
  const input = useRef(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(s));
    onChange(s);
  }, [s]);
  useEffect(() => { window.speechSynthesis?.getVoices(); }, []);

  const set = (patch) => setS((p) => ({ ...p, ...patch }));
  const used = s.files.reduce((n, f) => n + f.text.length, 0) + s.instructions.length;
  const pct = Math.min(100, Math.round((used / CONTEXT_LIMIT) * 100));

  const addFiles = async (list) => {
    const added = [];
    for (const f of Array.from(list)) {
      const readable = /\.(txt|md|csv|json)$/i.test(f.name);
      added.push({ id: crypto.randomUUID(), name: f.name, size: f.size, text: readable ? (await f.text()).slice(0, 8000) : "" });
    }
    set({ files: [...s.files, ...added] });
  };

  if (!open) return null;
  const tabs = [["voice", "Voice"], ["context", "Context and files"], ["language", "Language"]];

  return (
    <div className="pa-overlay" onClick={onClose}>
      <style>{css}</style>
      <div className="pa-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <nav className="pa-nav">
          <h2>Settings</h2>
          {tabs.map(([id, label]) => (
            <button key={id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>

        <section className="pa-body">
          <button className="pa-x" onClick={onClose} aria-label="Close settings">×</button>

          {tab === "voice" && (
            <>
              <h3>Tutor voice</h3>
              <p className="sub">Pick who reads answers aloud. Preview plays in your chosen language.</p>
              <div className="pa-voices">
                {VOICES.map((v) => (
                  <div key={v.id} className={"pa-voice" + (s.voice === v.id ? " sel" : "")}>
                    <button className="pick" onClick={() => set({ voice: v.id })} aria-pressed={s.voice === v.id}>
                      <span className={"av " + v.gender}>{v.name[0]}</span>
                      <span className="meta"><b>{v.name}</b><small>{v.gender === "female" ? "Female" : "Male"} · {v.tone}</small></span>
                    </button>
                    <button className="play" onClick={() => { set({ voice: v.id }); setTimeout(() => speak(SAMPLE[s.lang], s.lang), 0); }}>Preview</button>
                  </div>
                ))}
              </div>

              <h4>Fine tuning</h4>
              <label className="row">Speed <output>{s.speed.toFixed(2)}×</output>
                <input type="range" min="0.6" max="1.5" step="0.05" value={s.speed} onChange={(e) => set({ speed: +e.target.value })} />
              </label>
              <label className="row">Pitch <output>{s.pitch.toFixed(2)}</output>
                <input type="range" min="0.7" max="1.3" step="0.05" value={s.pitch} onChange={(e) => set({ pitch: +e.target.value })} />
              </label>
              <label className="toggle">
                <input type="checkbox" checked={s.autoSpeak} onChange={(e) => set({ autoSpeak: e.target.checked })} />
                <span>Read every answer aloud automatically</span>
              </label>
            </>
          )}

          {tab === "context" && (
            <>
              <h3>Context and files</h3>
              <p className="sub">Add notes and study material. The tutor uses them when it answers.</p>

              <div className="pa-meter" aria-label={`Context used ${pct}%`}>
                <div style={{ width: pct + "%" }} className={pct > 85 ? "hot" : ""} />
                <small>{pct}% of context used</small>
              </div>

              <h4>Instructions</h4>
              <textarea rows={4} value={s.instructions} placeholder="Example: Explain like I am in class 10. Use simple Marathi examples."
                onChange={(e) => set({ instructions: e.target.value })} />

              <h4>Files <span className="count">{s.files.length}</span></h4>
              <div className={"pa-drop" + (drag ? " over" : "")}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
                onClick={() => input.current.click()}>
                Drop files here or click to browse
                <input ref={input} type="file" multiple hidden onChange={(e) => addFiles(e.target.files)} />
              </div>

              {s.files.length === 0 ? (
                <p className="empty">No files yet. Add lecture notes or a chapter to get answers based on them.</p>
              ) : (
                <ul className="pa-files">
                  {s.files.map((f) => (
                    <li key={f.id}>
                      <span className="ext">{f.name.split(".").pop().slice(0, 4)}</span>
                      <span className="fn"><b>{f.name}</b><small>{(f.size / 1024).toFixed(1)} KB{f.text ? "" : " · name only, text not readable"}</small></span>
                      <button onClick={() => set({ files: s.files.filter((x) => x.id !== f.id) })} aria-label={`Remove ${f.name}`}>Remove</button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}

          {tab === "language" && (
            <>
              <h3>Language</h3>
              <p className="sub">Used for voice playback and previews.</p>
              <div className="pa-langs">
                {[["en", "English"], ["hi", "हिन्दी"], ["mr", "मराठी"]].map(([k, l]) => (
                  <button key={k} className={s.lang === k ? "on" : ""} onClick={() => set({ lang: k })}>{l}</button>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

/* Send this with each backend request */
export const buildContext = (s = loadSettings()) =>
  [s.instructions, ...s.files.map((f) => f.text && `# ${f.name}\n${f.text}`)].filter(Boolean).join("\n\n").slice(0, 20000);

/* ---------- Styles ---------- */
const css = `
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;700;800&display=swap');
.pa-overlay{--bg:#f2f5f9;--card:#fff;--ink:#14213d;--mute:#5d6b86;--line:#dbe2ee;--acc:#3b4cca;--acc2:#0fa3a3;
 position:fixed;inset:0;background:rgba(20,33,61,.45);display:grid;place-items:center;z-index:50;font-family:Manrope,system-ui,sans-serif;color:var(--ink)}
.pa-modal{width:min(880px,94vw);height:min(600px,90vh);background:var(--bg);border-radius:18px;display:grid;grid-template-columns:200px 1fr;overflow:hidden;box-shadow:0 24px 70px rgba(20,33,61,.35)}
.pa-nav{background:var(--card);border-right:1px solid var(--line);padding:22px 12px;display:flex;flex-direction:column;gap:4px}
.pa-nav h2{font-size:18px;margin:0 8px 14px}
.pa-nav button{text-align:left;border:0;background:none;padding:10px 12px;border-radius:10px;font:600 14px inherit;color:var(--mute);cursor:pointer}
.pa-nav button:hover{background:var(--bg)}
.pa-nav button.on{background:var(--ink);color:#fff}
.pa-body{padding:28px 32px;overflow:auto;position:relative}
.pa-x{position:absolute;top:14px;right:16px;border:0;background:none;font-size:26px;cursor:pointer;color:var(--mute)}
h3{margin:0 0 4px;font-size:22px}h4{margin:24px 0 8px;font-size:14px}
.sub{margin:0 0 18px;color:var(--mute);font-size:14px;max-width:60ch}
.pa-voices{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.pa-voice{background:var(--card);border:1.5px solid var(--line);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:10px}
.pa-voice.sel{border-color:var(--acc);box-shadow:0 0 0 3px rgba(59,76,202,.15)}
.pick{display:flex;gap:12px;align-items:center;border:0;background:none;text-align:left;cursor:pointer;font:inherit;color:inherit;padding:0}
.av{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:800}
.av.female{background:var(--acc2)}.av.male{background:var(--acc)}
.meta{display:flex;flex-direction:column}.meta small{color:var(--mute);font-size:12px}
.play{align-self:flex-start;border:1px solid var(--line);background:var(--bg);border-radius:8px;padding:6px 12px;font:600 12px inherit;cursor:pointer}
.play:hover{border-color:var(--acc)}
.row{display:grid;grid-template-columns:70px 1fr 56px;align-items:center;gap:10px;font-size:14px;font-weight:600;margin-bottom:10px}
.row input{grid-column:2;grid-row:1;accent-color:var(--acc)}.row output{grid-column:3;grid-row:1;color:var(--mute);font-size:13px}
.toggle{display:flex;gap:10px;align-items:center;font-size:14px;margin-top:14px}
.pa-meter{height:8px;background:var(--line);border-radius:6px;position:relative;margin-bottom:26px}
.pa-meter div{height:100%;background:var(--acc2);border-radius:6px;transition:width .3s}.pa-meter div.hot{background:#d6453d}
.pa-meter small{position:absolute;top:12px;left:0;color:var(--mute);font-size:12px}
textarea{width:100%;box-sizing:border-box;border:1.5px solid var(--line);border-radius:12px;padding:12px;font:14px/1.5 inherit;resize:vertical;background:var(--card);color:inherit}
textarea:focus{outline:2px solid var(--acc);border-color:transparent}
.count{background:var(--ink);color:#fff;border-radius:10px;padding:1px 8px;font-size:12px;margin-left:6px}
.pa-drop{border:2px dashed var(--line);border-radius:14px;padding:22px;text-align:center;color:var(--mute);font-size:14px;cursor:pointer;background:var(--card)}
.pa-drop.over,.pa-drop:hover{border-color:var(--acc);color:var(--acc)}
.empty{color:var(--mute);font-size:13px}
.pa-files{list-style:none;padding:0;margin:12px 0 0;display:flex;flex-direction:column;gap:8px}
.pa-files li{display:flex;align-items:center;gap:12px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px}
.ext{width:38px;height:38px;border-radius:9px;background:var(--bg);display:grid;place-items:center;font:800 11px inherit;text-transform:uppercase;color:var(--acc)}
.fn{flex:1;display:flex;flex-direction:column;min-width:0}.fn b{font-size:14px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fn small{color:var(--mute);font-size:12px}
.pa-files button{border:0;background:none;color:#d6453d;font:600 12px inherit;cursor:pointer}
.pa-langs{display:flex;gap:10px}
.pa-langs button{padding:12px 22px;border-radius:12px;border:1.5px solid var(--line);background:var(--card);font:700 15px inherit;cursor:pointer}
.pa-langs button.on{border-color:var(--acc);background:var(--acc);color:#fff}
button:focus-visible{outline:2px solid var(--acc);outline-offset:2px}
@media(max-width:640px){.pa-modal{grid-template-columns:1fr;grid-template-rows:auto 1fr}.pa-nav{flex-direction:row;overflow:auto;padding:12px}.pa-nav h2{display:none}.pa-voices{grid-template-columns:1fr}.pa-body{padding:20px}}
`;