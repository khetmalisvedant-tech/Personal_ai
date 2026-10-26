import { useState, useEffect, useRef } from "react";

// ════════════════════════════════════════════════════════════════════════════
// LANGUAGE DETECTION
// ════════════════════════════════════════════════════════════════════════════
const MARATHI_KEYWORDS = new Set(["आहे","आणि","काय","कसे","मला","तुम्ही","आपण","सांगा","करा","हे","ते","नाही","होय","मराठी","त्याचा","त्याची","आम्ही","तुमचा","कोण","कुठे"]);
const HINDI_KEYWORDS   = new Set(["है","और","क्या","कैसे","मुझे","आप","हम","बताओ","करो","यह","वह","नहीं","हाँ","हिंदी","उसका","उसकी","तुम्हारा","कौन","कहाँ","मैं"]);

function detectLanguage(text) {
  let hasDevanagari = false;
  for (const ch of text) { const c = ch.codePointAt(0); if (c >= 0x0900 && c <= 0x097f) { hasDevanagari = true; break; } }
  if (!hasDevanagari) return "english";
  const words = new Set(text.split(/\s+/));
  for (const w of words) if (MARATHI_KEYWORDS.has(w)) return "marathi";
  for (const w of words) if (HINDI_KEYWORDS.has(w))   return "hindi";
  return "hindi";
}

const PLACEHOLDER = { english:"Type your question here, or click 🎤 to speak...", hindi:"यहाँ अपना सवाल लिखें, या 🎤 बोलने के लिए क्लिक करें...", marathi:"येथे तुमचा प्रश्न लिहा, किंवा 🎤 बोलण्यासाठी क्लिक करा..." };
const LANG_ATTR   = { english:"en", hindi:"hi", marathi:"mr" };
const LANG_LABEL  = { english:"EN", hindi:"HI", marathi:"MR" };

// ════════════════════════════════════════════════════════════════════════════
// SKELETON
// ════════════════════════════════════════════════════════════════════════════
function Skeleton({ width="100%", height="16px", style={} }) {
  return <div style={{ width, height, borderRadius:"6px", background:"rgba(255,255,255,0.08)", backgroundImage:"linear-gradient(90deg,rgba(255,255,255,0) 0%,rgba(255,255,255,0.07) 50%,rgba(255,255,255,0) 100%)", backgroundSize:"200% 100%", animation:"shimmer 1.4s infinite", ...style }} />;
}

// ════════════════════════════════════════════════════════════════════════════
// AUDIO PLAYER
// ════════════════════════════════════════════════════════════════════════════
function AudioPlayer({ audioUrl, audioB64, audioError, audioLoading, provider, autoPlay }) {
  const ref            = useRef(null);
  const [playing,   setPlaying]   = useState(false);
  const [progress,  setProgress]  = useState(0);
  const [duration,  setDuration]  = useState(0);

  const src = audioUrl
    ? audioUrl
    : audioB64
      ? (audioB64.startsWith("data:") ? audioB64 : `data:audio/mp3;base64,${audioB64}`)
      : null;

  useEffect(() => {
    if (!ref.current || !src) return;
    ref.current.src = src;
    ref.current.load();
    setPlaying(false); setProgress(0); setDuration(0);
    if (autoPlay) {
      ref.current.play().then(() => setPlaying(true)).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, autoPlay]);

  const togglePlay = () => {
    if (!ref.current) return;
    if (playing) { ref.current.pause(); setPlaying(false); }
    else { ref.current.play().then(() => setPlaying(true)).catch(() => {}); }
  };

  const replay = () => {
    if (!ref.current) return;
    ref.current.currentTime = 0;
    ref.current.play().then(() => setPlaying(true)).catch(() => {});
  };

  const seek = (e) => {
    if (!ref.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    ref.current.currentTime = pct * duration;
    setProgress(pct * duration);
  };

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const pct = duration ? (progress / duration * 100) : 0;

  if (audioLoading) {
    return (
      <div style={AP.loadRow}>
        <div style={AP.spinner} />
        <span style={{ fontSize:"13px", color:"#9ca3af" }}>Generating audio…</span>
      </div>
    );
  }

  if (audioError && !src) {
    return (
      <div style={AP.errorRow}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <span style={{ fontSize:"13px", color:"#f59e0b" }}>{audioError}</span>
      </div>
    );
  }

  if (!src) return null;

  return (
    <div style={AP.wrap}>
      <audio
        ref={ref}
        onTimeUpdate={() => setProgress(ref.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(ref.current?.duration || 0)}
        onEnded={() => setPlaying(false)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        style={{ display:"none" }}
      />
      <div style={AP.player}>
        <button style={{ ...AP.playBtn, ...(playing ? AP.playBtnActive : {}) }} onClick={togglePlay} title={playing ? "Pause" : "Play"}>
          {playing
            ? <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor"><rect x="2" y="1" width="4" height="12" rx="1"/><rect x="8" y="1" width="4" height="12" rx="1"/></svg>
            : <svg width="13" height="13" viewBox="0 0 14 14" fill="currentColor"><path d="M3 1.5l9 5.5-9 5.5V1.5z"/></svg>
          }
        </button>
        <div style={AP.trackWrap} onClick={seek} title="Seek">
          <div style={AP.track}>
            <div style={{ ...AP.fill, width: pct + "%" }} />
          </div>
        </div>
        <span style={AP.time}>{fmt(progress)} / {fmt(duration)}</span>
        <button style={AP.iconBtn} onClick={replay} title="Replay from start">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4"/>
          </svg>
        </button>
        {provider && <span style={AP.badge}>{provider === "murf" ? "Murf" : "gTTS"}</span>}
      </div>
    </div>
  );
}

const AP = {
  wrap:        { marginTop:"4px" },
  loadRow:     { display:"flex", alignItems:"center", gap:"10px", padding:"10px 0" },
  spinner:     { width:"16px", height:"16px", borderRadius:"50%", border:"2px solid rgba(255,255,255,0.12)", borderTopColor:"#7c3aed", animation:"spin 0.8s linear infinite", flexShrink:0 },
  errorRow:    { display:"flex", alignItems:"center", gap:"8px", padding:"8px 0" },
  player:      { display:"flex", alignItems:"center", gap:"10px", background:"rgba(255,255,255,0.05)", borderRadius:"12px", border:"1px solid rgba(255,255,255,0.1)", padding:"10px 14px" },
  playBtn:     { width:"34px", height:"34px", borderRadius:"50%", border:"none", background:"rgba(124,58,237,0.25)", color:"#a78bfa", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"background 0.15s", padding:0 },
  playBtnActive:{ background:"rgba(124,58,237,0.55)", color:"#fff" },
  trackWrap:   { flex:1, cursor:"pointer", padding:"6px 0" },
  track:       { height:"4px", borderRadius:"2px", background:"rgba(255,255,255,0.12)", overflow:"hidden" },
  fill:        { height:"100%", background:"linear-gradient(90deg,#7c3aed,#60a5fa)", borderRadius:"2px", transition:"width 0.1s linear" },
  time:        { fontSize:"11px", color:"#6b7280", fontFamily:"monospace", whiteSpace:"nowrap", minWidth:"76px", textAlign:"right" },
  iconBtn:     { background:"none", border:"none", color:"#6b7280", cursor:"pointer", display:"flex", alignItems:"center", padding:"4px", borderRadius:"6px" },
  badge:       { fontSize:"10px", color:"#6b7280", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:"4px", padding:"2px 7px", fontFamily:"monospace", whiteSpace:"nowrap" },
};

// ════════════════════════════════════════════════════════════════════════════
// TOGGLE SWITCH
// ════════════════════════════════════════════════════════════════════════════
function Toggle({ on, onChange }) {
  return (
    <button onClick={() => onChange(!on)} style={{ ...V.toggleBtn, ...(on ? V.toggleBtnOn : {}) }}>
      <div style={{ ...V.toggleThumb, ...(on ? V.toggleThumbOn : {}) }} />
    </button>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// VOICE SETTINGS PANEL
// ════════════════════════════════════════════════════════════════════════════
const DEFAULT_VOICE_CATALOG = {
  english:[
    {id:"en-US-natalie", name:"Natalie", gender:"female", accent:"US English", style:"Warm · clear · conversational"},
    {id:"en-US-ken",     name:"Ken",     gender:"male",   accent:"US English", style:"Steady · confident · natural"},
    {id:"en-US-joey",    name:"Joey",    gender:"male",   accent:"US English", style:"Friendly · relaxed · expressive"},
    {id:"en-US-julia",   name:"Julia",   gender:"female", accent:"US English", style:"Bright · smooth · engaging"},
  ],
  hindi:[
    {id:"hi-IN-amit",  name:"Amit",  gender:"male",   accent:"Hindi", style:"Clear · steady"},
    {id:"hi-IN-divya", name:"Divya", gender:"female", accent:"Hindi", style:"Warm · clear"},
  ],
  marathi:[
    {id:"hi-IN-amit",  name:"Amit",  gender:"male",   accent:"Hindi voice · Marathi text support varies", style:"Clear · steady"},
    {id:"hi-IN-divya", name:"Divya", gender:"female", accent:"Hindi voice · Marathi text support varies", style:"Warm · clear"},
  ],
};

const EMPHASIS_OPTIONS = [
  {value:"none",     label:"None"},
  {value:"reduced",  label:"Soft"},
  {value:"moderate", label:"Moderate"},
  {value:"strong",   label:"Strong"},
];

function VoiceSettingsPanel({ settings, onChange, currentLang, autoPlay, onAutoPlayChange }) {
  const [catalog,     setCatalog]     = useState(DEFAULT_VOICE_CATALOG);
  const [cloneId,     setCloneId]     = useState("");
  const [showClone,   setShowClone]   = useState(false);
  const [previewText, setPreviewText] = useState("Hello! This is a preview of the selected voice.");
  const [previewing,  setPreviewing]  = useState(false);
  const [previewAudio, setPreviewAudio] = useState({ url:null, b64:null, error:"", loading:false });

  useEffect(() => {
    fetch("http://localhost:8000/voices")
      .then(r => r.json())
      .then(d => {
        if (d.voices) {
          setCatalog(prev => {
            const merged = {};
            for (const lang of ["english", "hindi", "marathi"]) {
              const base = prev[lang] || DEFAULT_VOICE_CATALOG[lang] || [];
              const live = d.voices[lang] || [];
              const byId = new Map(live.map(v => [v.id, { ...v }]));
              merged[lang] = base.map(v => ({ ...v, ...(byId.get(v.id) || {}) }));
              for (const v of live) if (!merged[lang].some(item => item.id === v.id)) merged[lang].push(v);
            }
            return merged;
          });
        }
      })
      .catch(() => {
        const lv = DEFAULT_VOICE_CATALOG[currentLang] || DEFAULT_VOICE_CATALOG.english;
        if (lv[0]) onChange("voice_id", lv[0].id);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLang]);

  const langVoices = catalog[currentLang] || catalog.english;

  const applyClone = () => {
    if (!cloneId.trim()) return;
    onChange("voice_id", cloneId.trim());
    setShowClone(false);
  };

  const handlePreview = async () => {
    if (!previewText.trim()) return;
    setPreviewing(true);
    setPreviewAudio({ url:null, b64:null, error:"", loading:true });
    try {
      const resp = await fetch("http://localhost:8000/voice-preview", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ text:previewText, lang:currentLang, voice_id:settings.voice_id, pitch:settings.pitch, rate:settings.rate, emphasis:settings.emphasis }),
      });
      if (resp.ok) {
        const data = await resp.json();
        setPreviewAudio({ url:data.audio_url||null, b64:data.audio_b64||null, error:data.error||"", loading:false });
      } else {
        setPreviewAudio({ url:null, b64:null, error:"Preview failed.", loading:false });
      }
    } catch {
      setPreviewAudio({ url:null, b64:null, error:"Could not reach server.", loading:false });
    } finally {
      setPreviewing(false);
    }
  };

  const sliderStyle = (val) => {
    const pct = ((val + 50) / 100 * 100) + "%";
    return { ...V.slider, background:`linear-gradient(to right,#7c3aed 0%,#7c3aed ${pct},rgba(255,255,255,0.15) ${pct})` };
  };

  return (
    <div style={V.panel}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:"12px",marginBottom:"18px",flexWrap:"wrap"}}>
        <div>
          <div style={{fontSize:"15px",fontWeight:750,color:"#f1f5f9",letterSpacing:"-.01em",marginBottom:"5px"}}>🎙️ Voice experience</div>
          <div style={{fontSize:"12px",color:"#94a3b8",lineHeight:1.55}}>Choose a voice and fine-tune how your assistant speaks.</div>
        </div>
        <span style={{fontSize:"10px",fontWeight:700,letterSpacing:".08em",color:"#c4b5fd",textTransform:"uppercase",padding:"5px 9px",borderRadius:"999px",border:"1px solid rgba(167,139,250,.25)",background:"rgba(124,58,237,.13)"}}>Personalize</span>
      </div>

      <div style={V.autoPlayRow}>
        <div>
          <div style={{ fontSize:"13px", fontWeight:600, color:"#e2e8f0", marginBottom:"2px" }}>Auto-play audio</div>
          <div style={{ fontSize:"12px", color:"#6b7280" }}>Play audio automatically when a response arrives</div>
        </div>
        <Toggle on={autoPlay} onChange={onAutoPlayChange} />
      </div>

      <div style={{ marginBottom:"18px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"9px", gap:"10px" }}>
          <label style={V.label}>Choose your voice</label>
          <span style={{fontSize:"10px", letterSpacing:".08em", color:"#a5b4fc", textTransform:"uppercase"}}>{currentLang === "english" ? "4 curated voices" : `${langVoices.length} language voices`}</span>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(190px,1fr))", gap:"10px"}}>
          {langVoices.map((v, index) => {
            const selected = (settings.voice_id || langVoices[0]?.id) === v.id;
            const gender = (v.gender || (/natalie|julia|hazel|isha|divya/i.test(`${v.id} ${v.name}`) ? "female" : "male")).toLowerCase();
            const female = gender.includes("f");
            return <button key={v.id} type="button" onClick={() => onChange("voice_id", v.id)} aria-pressed={selected}
              style={{textAlign:"left", padding:"15px", minHeight:"112px", borderRadius:"16px", cursor:"pointer", color:"#e5e7eb", border:selected?"1px solid rgba(196,181,253,.9)":"1px solid rgba(148,163,184,.2)", background:selected?"linear-gradient(145deg,rgba(124,58,237,.28),rgba(30,41,59,.82))":"linear-gradient(145deg,rgba(15,23,42,.76),rgba(15,23,42,.48))", boxShadow:selected?"0 8px 24px rgba(76,29,149,.18),inset 0 1px 0 rgba(255,255,255,.07)":"inset 0 1px 0 rgba(255,255,255,.025)", transition:"all .18s ease"}}>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <div style={{width:"38px",height:"38px",borderRadius:"12px",display:"grid",placeItems:"center",fontSize:"19px",background:female?"rgba(236,72,153,.16)":"rgba(59,130,246,.16)"}}>{female?"♀":"♂"}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:"14px",fontWeight:700}}>{v.name || v.id}</div>
                  <div style={{fontSize:"10px",color:"#94a3b8",marginTop:"3px"}}>{v.accent || (currentLang === "english" ? "English" : currentLang)} · {female?"Female voice":"Male voice"}</div>
                </div>
                <div style={{width:"18px",height:"18px",borderRadius:"50%",border:selected?"5px solid #a78bfa":"1px solid #64748b",flexShrink:0}} />
              </div>
              <div style={{fontSize:"11px",color:"#a8b2c5",marginTop:"10px",lineHeight:1.45}}>{v.style || (index===0?"Warm and clear":index===1?"Steady and confident":"Conversational delivery")}</div>
            </button>;
          })}
        </div>
        {currentLang === "english" && <div style={{fontSize:"11px",color:"#8490a5",marginTop:"8px",lineHeight:1.5}}>Natalie and Julia are female voice options; Ken and Joey are male voice options. Availability depends on your Murf account and API voice catalog.</div>}
        {settings.voice_id && !langVoices.find(v => v.id === settings.voice_id) && <div style={V.cloneActive}>🧬 Active custom voice: <code>{settings.voice_id}</code></div>}
      </div>

      <div style={{ marginBottom:"14px" }}>
        <button style={V.cloneToggleBtn} onClick={() => setShowClone(p => !p)}>
          🧬 {showClone ? "Hide" : "Use Cloned Voice ID"}
        </button>
        {showClone && (
          <div style={V.cloneBox}>
            <p style={V.cloneHint}>Paste your Murf <strong>Cloned Voice ID</strong> from the Murf Studio dashboard.</p>
            <div style={{ display:"flex", gap:"8px" }}>
              <input style={V.cloneInput} placeholder="e.g. en-US-myvoice-abc123" value={cloneId} onChange={e => setCloneId(e.target.value)} />
              <button style={V.applyBtn} onClick={applyClone}>Apply</button>
              <button style={V.clearBtn}  onClick={() => { setCloneId(""); onChange("voice_id", null); }}>Clear</button>
            </div>
            {settings.voice_id && settings.voice_id !== (langVoices[0]?.id) && (
              <div style={V.cloneActive}>✅ Active: <code>{settings.voice_id}</code></div>
            )}
          </div>
        )}
      </div>

      <div style={{ marginBottom:"18px" }}>
        <label style={{ ...V.label, display:"block", marginBottom:"8px" }}>Speaking style</label>
        <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
          <button onClick={() => { onChange("pitch", 0); onChange("rate", -5); onChange("emphasis", "moderate"); }} style={V.emphBtn}>🌿 Natural</button>
          <button onClick={() => { onChange("pitch", -3); onChange("rate", -10); onChange("emphasis", "reduced"); }} style={V.emphBtn}>☕ Calm</button>
          <button onClick={() => { onChange("pitch", 2); onChange("rate", 3); onChange("emphasis", "strong"); }} style={V.emphBtn}>✨ Expressive</button>
        </div>
        <div style={{fontSize:"11px", color:"#6b7280", marginTop:"7px", lineHeight:1.5}}>Presets adjust pitch, speed, and emphasis. Results depend on the selected voice and TTS provider.</div>
      </div>

      <div style={V.row}>
        <label style={V.label}>Pitch</label>
        <input type="range" min={-50} max={50} value={settings.pitch} onChange={e => onChange("pitch", Number(e.target.value))} style={sliderStyle(settings.pitch)} />
        <span style={V.val}>{settings.pitch > 0 ? `+${settings.pitch}` : settings.pitch}</span>
      </div>

      <div style={V.row}>
        <label style={V.label}>Speed</label>
        <input type="range" min={-50} max={50} value={settings.rate} onChange={e => onChange("rate", Number(e.target.value))} style={sliderStyle(settings.rate)} />
        <span style={V.val}>{settings.rate > 0 ? `+${settings.rate}` : settings.rate}</span>
      </div>

      <div style={{ marginBottom:"18px" }}>
        <label style={{ ...V.label, display:"block", marginBottom:"8px" }}>Emphasis</label>
        <div style={{ display:"flex", gap:"8px" }}>
          {EMPHASIS_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => onChange("emphasis", opt.value)}
              style={{ ...V.emphBtn, ...(settings.emphasis === opt.value ? V.emphBtnActive : {}) }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={V.previewBox}>
        <label style={{ ...V.label, display:"block", marginBottom:"8px" }}>🔊 Preview voice</label>
        <textarea style={V.previewInput} value={previewText} onChange={e => setPreviewText(e.target.value)} rows={2} placeholder="Type a sentence to preview…" />
        <button style={{ ...V.applyBtn, marginTop:"8px", width:"100%" }} onClick={handlePreview} disabled={previewing}>
          {previewing ? "⏳ Generating…" : "▶ Play Preview"}
        </button>
        <AudioPlayer audioUrl={previewAudio.url} audioB64={previewAudio.b64} audioError={previewAudio.error} audioLoading={previewAudio.loading} autoPlay={true} />
      </div>

      <button style={V.resetBtn} onClick={() => { onChange("voice_id", null); onChange("pitch", 0); onChange("rate", 0); onChange("emphasis","none"); setCloneId(""); }}>
        ↺ Reset to Defaults
      </button>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// SETTINGS MODAL
// ════════════════════════════════════════════════════════════════════════════
const buildContext = (c) =>
  [c.instructions, ...c.files.map(f => f.text && `# ${f.name}\n${f.text}`)]
    .filter(Boolean).join("\n\n").slice(0, 20000);

function SettingsModal({
  open, onClose, voiceSettings, updateVoice, currentLang,
  autoPlay, onAutoPlayChange, voiceInputEnabled, onVoiceInput,
  voiceOutputEnabled, onVoiceOutput, context, setContext,
}) {
  const [tab,  setTab]  = useState("voice");
  const [drag, setDrag] = useState(false);
  const pickRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const h = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;

  const used = context.instructions.length + context.files.reduce((n, f) => n + f.text.length, 0);
  const pct  = Math.min(100, Math.round(used / 20000 * 100));

  const addFiles = async (list) => {
    const added = [];
    for (const f of Array.from(list)) {
      const readable = /\.(txt|md|csv)$/i.test(f.name);
      added.push({ id: `${Date.now()}-${f.name}`, name: f.name, size: f.size, text: readable ? (await f.text()).slice(0, 8000) : "" });
    }
    setContext({ ...context, files: [...context.files, ...added] });
  };

  const prefRow = (title, sub, on, onChange) => (
    <div style={V.autoPlayRow}>
      <div>
        <div style={{ fontSize:"13px", fontWeight:600, color:"#e2e8f0", marginBottom:"2px" }}>{title}</div>
        <div style={{ fontSize:"12px", color:"#6b7280" }}>{sub}</div>
      </div>
      <Toggle on={on} onChange={onChange} />
    </div>
  );

  return (
    <div style={M.overlay} onClick={onClose}>
      <div style={M.modal} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div style={M.head}>
          <div>
            <h2 style={M.title}>Settings</h2>
            <p style={{margin:"5px 0 0",fontSize:"12px",lineHeight:1.5,color:"#94a3b8"}}>Personalize your tutor, voice, and learning context.</p>
          </div>
          <button style={M.close} onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div style={A.tabRow}>
          {[["voice", "🎙️ Voice"], ["context", "📚 Context & Files"]].map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)} style={{ ...A.tabBtn, ...(tab === id ? A.tabBtnActive : {}) }}>{label}</button>
          ))}
        </div>

        {tab === "voice" && (
          <>
            {prefRow("Voice input", "Allow speaking questions into the microphone", voiceInputEnabled, onVoiceInput)}
            {prefRow("Voice output", "Play spoken answers from the assistant", voiceOutputEnabled, onVoiceOutput)}
            <VoiceSettingsPanel
              settings={voiceSettings} onChange={updateVoice} currentLang={currentLang}
              autoPlay={autoPlay && voiceOutputEnabled} onAutoPlayChange={onAutoPlayChange}
            />
          </>
        )}

        {tab === "context" && (
          <>
            <p style={M.sub}>Add notes and study material. The tutor uses them when it answers.</p>

            <div style={M.meterTrack} aria-label={`Context used ${pct}%`}>
              <div style={{ ...M.meterFill, width: pct + "%", background: pct > 85 ? "#ef4444" : "linear-gradient(90deg,#7c3aed,#60a5fa)" }} />
            </div>
            <div style={M.meterLabel}>{pct}% of context used</div>

            <label style={{ ...V.label, display:"block", margin:"18px 0 8px" }}>Instructions</label>
            <textarea
              style={{ ...S.textarea, padding:"12px 16px", minHeight:"96px", fontSize:"0.95rem" }}
              placeholder="Example: Explain like I am in class 10. Use simple Marathi examples."
              value={context.instructions}
              onChange={(e) => setContext({ ...context, instructions: e.target.value })}
            />

            <label style={{ ...V.label, display:"block", margin:"18px 0 8px" }}>Files ({context.files.length})</label>
            <div
              style={{ ...A.dropZone, padding:"26px 20px", ...(drag ? { borderColor:"#a78bfa", background:"rgba(124,58,237,0.1)" } : {}) }}
              onClick={() => pickRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
            >
              <div style={{ fontWeight:600, marginBottom:"4px" }}>Drop files here or click to browse</div>
              <div style={{ fontSize:"12px", color:"#9ca3af" }}>TXT, MD and CSV are read as context</div>
              <input ref={pickRef} type="file" multiple accept=".txt,.md,.csv,.pdf" style={{ display:"none" }} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
            </div>

            {context.files.length === 0 ? (
              <p style={{ ...M.sub, marginTop:"12px" }}>No files yet. Add lecture notes or a chapter to get answers based on them.</p>
            ) : context.files.map((f) => (
              <div key={f.id} style={A.previewRow}>
                <span style={{ fontSize:"28px" }}>📄</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{f.name}</div>
                  <div style={{ fontSize:"12px", color:"#9ca3af", marginTop:"2px" }}>
                    {(f.size / 1024).toFixed(1)} KB{f.text ? "" : " · text not readable, name only"}
                  </div>
                </div>
                <button style={A.removeBtn} onClick={() => setContext({ ...context, files: context.files.filter((x) => x.id !== f.id) })}>✕ Remove</button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const M = {
  overlay:   { position:"fixed", inset:0, background:"rgba(5,4,18,0.78)", backdropFilter:"blur(10px)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:100, padding:"clamp(10px,3vw,24px)" },
  modal:     { width:"100%", maxWidth:"760px", maxHeight:"92vh", overflowY:"auto", background:"radial-gradient(ellipse at top left,rgba(124,58,237,.14),transparent 45%),linear-gradient(145deg,#17152f,#201e3b 55%,#191a31)", border:"1px solid rgba(255,255,255,0.14)", borderRadius:"22px", padding:"clamp(18px,3vw,30px)", color:"#f0f0f0", boxShadow:"0 28px 90px rgba(0,0,0,0.65)" },
  head:      { display:"flex", alignItems:"center", justifyContent:"space-between", gap:"16px", marginBottom:"20px", paddingBottom:"16px", borderBottom:"1px solid rgba(255,255,255,0.08)" },
  title:     { margin:0, fontSize:"1.4rem", fontWeight:750, letterSpacing:"-.025em", color:"#f1f5f9" },
  close:     { background:"none", border:"1px solid rgba(255,255,255,0.15)", borderRadius:"8px", color:"#9ca3af", cursor:"pointer", padding:"5px 10px", fontFamily:"inherit" },
  sub:       { fontSize:"13px", color:"#9ca3af", margin:"0 0 14px", lineHeight:1.5 },
  meterTrack:{ height:"6px", borderRadius:"3px", background:"rgba(255,255,255,0.12)", overflow:"hidden" },
  meterFill: { height:"100%", borderRadius:"3px", transition:"width 0.3s" },
  meterLabel:{ fontSize:"11px", color:"#6b7280", marginTop:"6px", fontFamily:"monospace" },
};

// ════════════════════════════════════════════════════════════════════════════
// TUTOR PANEL
// ════════════════════════════════════════════════════════════════════════════
const EMPTY_RESPONSE = { explanation:"", summary:"", quiz:[], audioUrl:null, audioB64:null, audioError:"", audioLoading:false, provider:"", error:"", loading:false };

function TutorPanel() {
  const [question,      setQuestion]      = useState("");
  const [inputLang,     setInputLang]     = useState("english");
  const [listening,     setListening]     = useState(false);
  const [interimText,   setInterimText]   = useState("");
  const [showSettings,  setShowSettings]  = useState(false);
  const [context, setContextState] = useState(() => { try { return { instructions:"", files:[], ...JSON.parse(localStorage.getItem("personalAI.context") || "{}") }; } catch { return { instructions:"", files:[] }; } });
  const setContext = (next) => { setContextState(next); try { localStorage.setItem("personalAI.context", JSON.stringify(next)); } catch {} };
  const [autoPlay,      setAutoPlay]      = useState(() => { try { return JSON.parse(localStorage.getItem("personalAI.voice.autoPlay") ?? "true"); } catch { return true; } });
  const [voiceInputEnabled, setVoiceInputEnabled] = useState(() => { try { return JSON.parse(localStorage.getItem("personalAI.voice.inputEnabled") ?? "true"); } catch { return true; } });
  const [voiceOutputEnabled, setVoiceOutputEnabled] = useState(() => { try { return JSON.parse(localStorage.getItem("personalAI.voice.outputEnabled") ?? "true"); } catch { return true; } });
  const [voiceSettings, setVoiceSettings] = useState(() => { try { return { voice_id:null, pitch:0, rate:0, emphasis:"none", ...JSON.parse(localStorage.getItem("personalAI.voice.settings") || "{}") }; } catch { return { voice_id:null, pitch:0, rate:0, emphasis:"none" }; } });
  const [res, setRes]                     = useState(EMPTY_RESPONSE);

  const recRef       = useRef(null);
  const finalRef     = useRef("");
  const silenceTimer = useRef(null);

  const updateVoice = (key, val) => setVoiceSettings(p => {
    const next = { ...p, [key]: val };
    try { localStorage.setItem("personalAI.voice.settings", JSON.stringify(next)); } catch {}
    return next;
  });
  const updateAutoPlay = (value) => { setAutoPlay(value); try { localStorage.setItem("personalAI.voice.autoPlay", JSON.stringify(value)); } catch {} };
  const updateVoiceInput = (value) => { setVoiceInputEnabled(value); try { localStorage.setItem("personalAI.voice.inputEnabled", JSON.stringify(value)); } catch {} };
  const updateVoiceOutput = (value) => { setVoiceOutputEnabled(value); try { localStorage.setItem("personalAI.voice.outputEnabled", JSON.stringify(value)); } catch {} };

  const handleQuestionChange = (e) => {
    const val = e.target.value;
    setQuestion(val);
    setInputLang(val.trim() ? detectLanguage(val) : "english");
  };

  const sendQuestion = async (q) => {
    if (!q?.trim()) return;
    setRes({ ...EMPTY_RESPONSE, loading:true });
    try {
      const response = await fetch("http://localhost:8000/ask", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ question: q, ...voiceSettings, context: buildContext(context) }),
      });
      if (!response.ok) { setRes({ ...EMPTY_RESPONSE, error:`Server error: ${response.status}` }); return; }
      const data = await response.json();
      if (data.error) { setRes({ ...EMPTY_RESPONSE, error:data.error }); return; }

      // Strip leaked JSON wrapper from explanation if model misbehaved
      let explanation = data.explanation || "";
      if (explanation.trimStart().startsWith("{")) {
        try {
          const inner = JSON.parse(explanation);
          explanation = inner.explanation || inner.result || explanation;
        } catch {
          const m = explanation.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)"/);
          if (m) explanation = m[1].replace(/\\n/g, " ").replace(/\\"/g, '"');
        }
      }

      // Suppress audio if the AI response is itself an error message
      const isAiError = !explanation || /taking too long|try again|could not reach|please try|failed to generate/i.test(explanation);

      setRes({
        loading:false, error:"",
        explanation: explanation,
        summary:     data.summary     || "",
        quiz:        Array.isArray(data.quiz) ? data.quiz : [],
        audioUrl:    isAiError ? null : (data.audio_type === "url"    ? data.audio : null),
        audioB64:    isAiError ? null : (data.audio_type === "base64" ? data.audio : null),
        audioError:  isAiError ? ""   : (data.audio_error || ""),
        audioLoading:false,
        provider:    isAiError ? ""   : (data.voice_provider || ""),
      });
    } catch {
      setRes({ ...EMPTY_RESPONSE, error:"Could not connect to server. Is it running?" });
    }
  };

  const stopAndSend = () => {
    clearTimeout(silenceTimer.current);
    if (recRef.current) { try { recRef.current.stop(); } catch {} }
  };

  const startVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { alert("Speech recognition not supported. Please use Chrome."); return; }
    if (!voiceInputEnabled) { setRes(p => ({ ...p, error:"Voice input is disabled. Enable it in Settings first." })); return; }
    if (listening) { stopAndSend(); return; }

    const rec = new SR();
    rec.lang           = inputLang === "marathi" ? "mr-IN" : inputLang === "hindi" ? "hi-IN" : "en-IN";
    rec.continuous     = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    finalRef.current   = "";

    rec.onstart  = () => { setListening(true); setInterimText(""); setQuestion(""); clearTimeout(silenceTimer.current); };
    rec.onresult = (e) => {
      let interim = "", gotFinal = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) { finalRef.current += t + " "; gotFinal = true; }
        else { interim = t; }
      }
      setQuestion(finalRef.current + interim);
      setInterimText(interim);
      if (finalRef.current) setInputLang(detectLanguage(finalRef.current));
      if (gotFinal) {
        clearTimeout(silenceTimer.current);
        silenceTimer.current = setTimeout(() => { try { recRef.current?.stop(); } catch {} }, 2000);
      }
    };
    rec.onerror = (e) => {
      clearTimeout(silenceTimer.current); setListening(false); setInterimText("");
      if (e.error !== "no-speech" && e.error !== "aborted") setRes(p => ({ ...p, error:`Voice error: ${e.error}` }));
    };
    rec.onend = () => {
      clearTimeout(silenceTimer.current); setListening(false); setInterimText("");
      const full = finalRef.current.trim();
      if (full) { setQuestion(full); setInputLang(detectLanguage(full)); sendQuestion(full); }
    };
    recRef.current = rec;
    rec.start();
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendQuestion(question); }
  };

  const { loading, error, explanation, summary, quiz, audioUrl, audioB64, audioError, audioLoading, provider } = res;

  return (
    <>
      <div style={T.toolbar}>
        <div style={T.toolbarHint}>Personalize your learning experience</div>
        <button
          type="button"
          style={T.voiceToggle}
          onClick={() => setShowSettings(true)}
          aria-label="Open settings"
          title="Open settings"
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
            <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="m19.4 13.5 1.1.9-1.5 2.6-1.4-.5a7.7 7.7 0 0 1-1.5.9l-.2 1.5h-3l-.3-1.5a7.7 7.7 0 0 1-1.5-.9l-1.4.5-1.5-2.6 1.1-.9a7.4 7.4 0 0 1 0-1.8l-1.1-.9 1.5-2.6 1.4.5a7.7 7.7 0 0 1 1.5-.9l.3-1.5h3l.2 1.5a7.7 7.7 0 0 1 1.5.9l1.4-.5 1.5 2.6-1.1.9a7.4 7.4 0 0 1 0 1.8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" transform="translate(-1.2 -1.2) scale(1.08)" />
          </svg>
          <span>Settings</span>
          {(voiceSettings.pitch!==0 || voiceSettings.rate!==0 || voiceSettings.emphasis!=="none" || voiceSettings.voice_id) && <span style={T.activeDot} />}
        </button>
      </div>

      <div style={S.inputRow}>
        <div style={S.textareaWrapper}>
          <span style={S.langBadge}>{LANG_LABEL[inputLang]}</span>
          <textarea
            lang={LANG_ATTR[inputLang]}
            style={{ ...S.textarea, fontSize: inputLang === "english" ? "1rem" : "1.05rem", borderColor: listening ? "rgba(124,58,237,0.6)" : undefined, boxShadow: listening ? "0 0 0 3px rgba(124,58,237,0.15)" : undefined }}
            placeholder={listening ? "🎤 Listening… speak your full question, then pause…" : PLACEHOLDER[inputLang]}
            value={question} onChange={handleQuestionChange} onKeyDown={handleKeyDown} rows={2}
          />
          {listening && interimText && <div style={T.interimBadge}>💬 {interimText}</div>}
        </div>
        <div style={S.btnGroup}>
          <button style={{ ...S.btn, ...S.btnVoice, background: listening ? "#dc2626" : "#7c3aed", opacity: voiceInputEnabled ? 1 : 0.45 }} onClick={startVoice} disabled={loading || !voiceInputEnabled}>
            {listening ? "⏹ Stop & Send" : "🎤 Speak"}
          </button>
          <button style={{ ...S.btn, ...S.btnAsk }} onClick={() => sendQuestion(question)} disabled={loading || !question.trim()}>
            {loading ? "⏳ Thinking..." : "Ask →"}
          </button>
        </div>
      </div>

      {listening && (
        <div style={T.listeningBar}>
          <span style={T.listeningDot} />
          Listening… speak your full question. It sends after 2 seconds of silence, or press ⏹ Stop &amp; Send.
        </div>
      )}

      <SettingsModal
        open={showSettings} onClose={() => setShowSettings(false)}
        voiceSettings={voiceSettings} updateVoice={updateVoice} currentLang={inputLang}
        autoPlay={autoPlay} onAutoPlayChange={updateAutoPlay}
        voiceInputEnabled={voiceInputEnabled} onVoiceInput={updateVoiceInput}
        voiceOutputEnabled={voiceOutputEnabled} onVoiceOutput={updateVoiceOutput}
        context={context} setContext={setContext}
      />

      {error && <div style={S.error}>⚠️ {error}</div>}

      {loading && (
        <>
          <div style={S.section}>
            <Skeleton height="13px" width="60px" style={{marginBottom:"14px"}} />
            <Skeleton height="14px" style={{marginBottom:"10px"}} />
            <Skeleton height="14px" width="90%" style={{marginBottom:"10px"}} />
            <Skeleton height="14px" width="75%" />
          </div>
          <div style={S.section}>
            <Skeleton height="13px" width="80px" style={{marginBottom:"14px"}} />
            {[1,2,3].map(i => <Skeleton key={i} height="14px" width={`${85-i*5}%`} style={{marginBottom:"10px"}} />)}
          </div>
        </>
      )}

      {!loading && explanation && (
        <>
          <div style={S.section}>
            <h2 style={S.sectionTitle}>📘 Explanation</h2>
            <p style={S.explanationText}>{explanation}</p>
          </div>

          {summary && (
            <div style={{ ...S.section, ...S.summaryBox }}>
              <h2 style={S.sectionTitle}>💡 Summary</h2>
              <p style={S.summaryText}>{summary}</p>
            </div>
          )}

          {voiceOutputEnabled && (audioUrl || audioB64 || audioLoading) && (
            <div style={S.section}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
                <h2 style={{ ...S.sectionTitle, margin:0 }}>🔊 Listen</h2>
                {autoPlay && (audioUrl || audioB64) && (
                  <span style={T.autoPlayBadge}>▶ Auto-playing</span>
                )}
              </div>
              <AudioPlayer
                audioUrl={audioUrl}
                audioB64={audioB64}
                audioError={audioError}
                audioLoading={audioLoading}
                provider={provider}
                autoPlay={autoPlay && voiceOutputEnabled}
              />
            </div>
          )}

          {quiz.length > 0 && (
            <div style={S.section}>
              <h2 style={S.sectionTitle}>🧠 Practice Questions</h2>
              <ol style={S.quizList}>
                {quiz.map((q, i) => <li key={i} style={S.quizItem}>{q}</li>)}
              </ol>
            </div>
          )}
        </>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// FORMATTED RESULT
// ════════════════════════════════════════════════════════════════════════════
function FormattedResult({ text }) {
  if (!text) return null;
  let clean = text.trim();
  if (clean.startsWith("{") && clean.includes('"result"')) {
    try { const p = JSON.parse(clean); if (p.result) clean = p.result; }
    catch { const m = clean.match(/"result"\s*:\s*"([\s\S]*?)"\s*[,}]/); if (m) clean = m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'); }
  }
  clean = clean.replace(/^```[a-z]*\n?/i, "").replace(/```$/,"").trim();
  const lines = clean.split("\n");

  const renderInline = (str) => {
    const parts = str.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
    return parts.map((p, i) => {
      if (p.startsWith("**") && p.endsWith("**")) return <strong key={i} style={{color:"#e2e8f0",fontWeight:700}}>{p.slice(2,-2)}</strong>;
      if (p.startsWith("__") && p.endsWith("__")) return <strong key={i} style={{color:"#e2e8f0",fontWeight:700}}>{p.slice(2,-2)}</strong>;
      return p;
    });
  };

  const elements = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (/^\d+[\.\)]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+[\.\)]\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^\d+[\.\)]\s/, "")); i++; }
      elements.push(<ol key={`ol-${i}`} style={FR.ol}>{items.map((it, idx) => <li key={idx} style={FR.li}>{renderInline(it)}</li>)}</ol>);
      continue;
    }
    if (/^[-•*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-•*]\s/.test(lines[i].trim())) { items.push(lines[i].trim().replace(/^[-•*]\s/, "")); i++; }
      elements.push(<ul key={`ul-${i}`} style={FR.ul}>{items.map((it, idx) => <li key={idx} style={FR.li}><span style={FR.bullet}>▸</span>{renderInline(it)}</li>)}</ul>);
      continue;
    }
    if (/^#{1,3}\s/.test(line)) {
      elements.push(<div key={`h-${i}`} style={FR.heading}>{line.replace(/^#{1,3}\s/, "")}</div>);
      i++; continue;
    }
    elements.push(<p key={`p-${i}`} style={FR.para}>{renderInline(line)}</p>);
    i++;
  }
  return <div style={FR.wrap}>{elements}</div>;
}

const FR = {
  wrap:    { lineHeight:1.75, fontSize:"1rem", color:"#e2e8f0" },
  para:    { margin:"0 0 10px 0" },
  ol:      { margin:"0 0 10px 0", paddingLeft:"22px" },
  ul:      { margin:"0 0 10px 0", paddingLeft:"4px", listStyle:"none" },
  li:      { marginBottom:"6px", lineHeight:1.7 },
  bullet:  { color:"#a78bfa", marginRight:"8px", fontWeight:700 },
  heading: { fontWeight:700, fontSize:"1rem", color:"#a78bfa", textTransform:"uppercase", letterSpacing:"0.06em", margin:"14px 0 8px" },
};

// ════════════════════════════════════════════════════════════════════════════
// ANALYZER PANEL
// ════════════════════════════════════════════════════════════════════════════
const ANALYZE_MODES = [
  {value:"summary",   label:"📝 Summary"},
  {value:"explain",   label:"🔍 Explanation"},
  {value:"keypoints", label:"🎯 Key Points"},
  {value:"simplify",  label:"🧒 Simplify"},
  {value:"critical",  label:"🧠 Critical Analysis"},
];
const MODE_LABELS   = {summary:"Summary",explain:"Explanation",keypoints:"Key Points",simplify:"Simplified",critical:"Critical Analysis"};
const DETAIL_LABELS = ["","Brief","Balanced","Detailed"];

function AnalyzerPanel() {
  const [inputTab,  setInputTab]  = useState("text");
  const [textInput, setTextInput] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [docFile,   setDocFile]   = useState(null);
  const [mode,      setMode]      = useState("summary");
  const [detail,    setDetail]    = useState(2);
  const [loading,   setLoading]   = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [result,    setResult]    = useState("");
  const [resultMode,setResultMode]= useState("");
  const [error,     setError]     = useState("");
  const [copied,    setCopied]    = useState(false);
  const [autoPlay,  setAutoPlay]  = useState(true);
  const [audio, setAudio] = useState({ url:null, b64:null, error:"", loading:false, provider:"" });

  const readAsDataUrl = (file) => new Promise((res,rej) => { const r=new FileReader(); r.onload=(e)=>res(e.target.result); r.onerror=()=>rej(); r.readAsDataURL(file); });
  const handleImagePick = async (file) => {
    if (!file||!file.type.startsWith("image/")) { setError("Please select a valid image file."); return; }
    try { const d=await readAsDataUrl(file); setImageFile({name:file.name,base64:d.split(",")[1],mediaType:file.type,previewUrl:d,size:file.size}); setError(""); } catch { setError("Could not read image."); }
  };
  const handleDocPick = async (file) => {
    if (!file) return;
    const ext=file.name.split(".").pop().toLowerCase();
    if (!["pdf","txt","md","csv"].includes(ext)) { setError("Supported: PDF, TXT, MD, CSV"); return; }
    try { const d=await readAsDataUrl(file); setDocFile({name:file.name,base64:d.split(",")[1],size:file.size}); setError(""); } catch { setError("Could not read file."); }
  };
  const onDrop=(e,type)=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f) type==="image"?handleImagePick(f):handleDocPick(f); };
  const fmtSize=(b)=>b<1048576?(b/1024).toFixed(1)+" KB":(b/1048576).toFixed(1)+" MB";

  const handleAnalyze = async () => {
    setError(""); setResult(""); setResultMode(""); setStreaming(false);
    setAudio({ url:null, b64:null, error:"", loading:false, provider:"" });

    let body = { mode, detail };
    if (inputTab==="text") {
      if (!textInput.trim()) { setError("Please enter some text first."); return; }
      body = { ...body, content_type:"text", text:textInput.trim() };
    } else if (inputTab==="image") {
      if (!imageFile) { setError("Please upload an image first."); return; }
      body = { ...body, content_type:"image", image_base64:imageFile.base64, image_media_type:imageFile.mediaType };
    } else {
      if (!docFile) { setError("Please upload a file first."); return; }
      body = { ...body, content_type:"file", file_base64:docFile.base64, file_name:docFile.name };
    }

    setLoading(true);
    let accumulated = "";
    let detectedLang = "english";

    try {
      const resp = await fetch("http://localhost:8000/analyze", {
        method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body),
      });
      if (!resp.ok) { setError(`Server error: ${resp.status}`); return; }

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let firstChunk = true;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });

        if (firstChunk && chunk.startsWith("__LANG__:")) {
          firstChunk   = false;
          detectedLang = chunk.replace("__LANG__:", "").trim();
          setResultMode(mode);
          setStreaming(true);
          setLoading(false);
          continue;
        }
        firstChunk = false;
        if (chunk.startsWith("__ERROR__:")) { setError(chunk.replace("__ERROR__:", "").trim()); setStreaming(false); return; }
        accumulated += chunk;
        setResult(accumulated);
      }

      if (accumulated.trim()) {
        setAudio(a => ({ ...a, loading:true }));
        try {
          const vr = await fetch("http://localhost:8000/voice-preview", {
            method:"POST", headers:{"Content-Type":"application/json"},
            body: JSON.stringify({ text:accumulated.trim().slice(0,400), lang:detectedLang, voice_id:null, pitch:0, rate:0, emphasis:"none" }),
          });
          if (vr.ok) {
            const vd = await vr.json();
            setAudio({ url:vd.audio_url||null, b64:vd.audio_b64||null, error:vd.error||"", loading:false, provider:vd.provider||"" });
          } else {
            setAudio({ url:null, b64:null, error:"Audio generation failed.", loading:false, provider:"" });
          }
        } catch {
          setAudio({ url:null, b64:null, error:"Could not generate audio.", loading:false, provider:"" });
        }
      }

    } catch {
      setError("Could not connect to server. Is it running?");
    } finally {
      setLoading(false);
      setStreaming(false);
    }
  };

  const sliderPct = ((detail-1)/2*100)+"%";

  return (
    <>
      <div style={A.tabRow}>
        {[["text","✏️ Type / Paste"],["image","🖼️ Image"],["file","📄 File"]].map(([t,l])=>(
          <button key={t} onClick={()=>{setInputTab(t);setError("");}} style={{...A.tabBtn,...(inputTab===t?A.tabBtnActive:{})}}>{l}</button>
        ))}
      </div>

      {inputTab==="text" && (
        <div style={{position:"relative"}}>
          <textarea style={{...S.textarea,minHeight:"140px",resize:"vertical",fontSize:"0.95rem"}} placeholder="Paste or type your text here…" value={textInput} onChange={e=>setTextInput(e.target.value)} rows={5} />
          <span style={A.charCount}>{textInput.length.toLocaleString()} chars</span>
        </div>
      )}
      {inputTab==="image" && (
        <>
          <div style={A.dropZone} onClick={()=>document.getElementById("imgPicker").click()} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,"image")}>
            <div style={{fontSize:"40px",marginBottom:"10px"}}>🖼️</div>
            <div style={{fontWeight:600,marginBottom:"6px"}}>Drop an image or click to browse</div>
            <div style={{fontSize:"13px",color:"#9ca3af"}}>Screenshots, scanned docs, photos of text</div>
            <div style={A.fileTags}>{["PNG","JPG","WEBP","GIF"].map(t=><span key={t} style={A.fileTag}>{t}</span>)}</div>
            <input id="imgPicker" type="file" accept="image/*" style={{display:"none"}} onChange={e=>handleImagePick(e.target.files[0])} />
          </div>
          {imageFile && <div style={A.previewRow}><img src={imageFile.previewUrl} alt="preview" style={A.previewThumb} /><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{imageFile.name}</div><div style={{fontSize:"12px",color:"#9ca3af",marginTop:"2px"}}>{fmtSize(imageFile.size)}</div></div><button style={A.removeBtn} onClick={()=>setImageFile(null)}>✕ Remove</button></div>}
        </>
      )}
      {inputTab==="file" && (
        <>
          <div style={A.dropZone} onClick={()=>document.getElementById("filePicker").click()} onDragOver={e=>e.preventDefault()} onDrop={e=>onDrop(e,"file")}>
            <div style={{fontSize:"40px",marginBottom:"10px"}}>📄</div>
            <div style={{fontWeight:600,marginBottom:"6px"}}>Drop a file or click to browse</div>
            <div style={{fontSize:"13px",color:"#9ca3af"}}>PDF, TXT, MD, CSV</div>
            <div style={A.fileTags}>{["PDF","TXT","MD","CSV"].map(t=><span key={t} style={A.fileTag}>{t}</span>)}</div>
            <input id="filePicker" type="file" accept=".pdf,.txt,.md,.csv" style={{display:"none"}} onChange={e=>handleDocPick(e.target.files[0])} />
          </div>
          {docFile && <div style={A.previewRow}><span style={{fontSize:"32px"}}>📄</span><div style={{flex:1,minWidth:0}}><div style={{fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{docFile.name}</div><div style={{fontSize:"12px",color:"#9ca3af",marginTop:"2px"}}>{fmtSize(docFile.size)}</div></div><button style={A.removeBtn} onClick={()=>setDocFile(null)}>✕ Remove</button></div>}
        </>
      )}

      <div style={A.divider} />

      <div style={V.autoPlayRow}>
        <div>
          <div style={{ fontSize:"13px", fontWeight:600, color:"#e2e8f0", marginBottom:"2px" }}>Auto-play audio after analysis</div>
          <div style={{ fontSize:"12px", color:"#6b7280" }}>Play audio automatically when result is ready</div>
        </div>
        <Toggle on={autoPlay} onChange={setAutoPlay} />
      </div>

      <div style={{fontSize:"12px",color:"#9ca3af",marginBottom:"10px",fontWeight:600,textTransform:"uppercase",letterSpacing:"0.06em"}}>What do you need?</div>
      <div style={A.modeRow}>
        {ANALYZE_MODES.map(m=>(
          <button key={m.value} onClick={()=>setMode(m.value)} style={{...A.modeChip,...(mode===m.value?A.modeChipActive:{})}}>{m.label}</button>
        ))}
      </div>
      <div style={A.sliderRow}>
        <span style={A.sliderLabel}>Detail</span>
        <input type="range" min={1} max={3} value={detail} onChange={e=>setDetail(Number(e.target.value))}
          style={{...A.slider,background:`linear-gradient(to right,#7c3aed 0%,#7c3aed ${sliderPct},rgba(255,255,255,0.15) ${sliderPct})`}} />
        <span style={A.sliderValue}>{DETAIL_LABELS[detail]}</span>
      </div>

      <button onClick={handleAnalyze} disabled={loading||streaming} style={{...S.btn,...S.btnAsk,width:"100%",padding:"14px",fontSize:"1rem",opacity:(loading||streaming)?0.6:1,cursor:(loading||streaming)?"not-allowed":"pointer"}}>
        {loading?"⏳ Processing…": streaming?"✍️ Writing…":"✨ Analyze Now"}
      </button>

      {error && <div style={{...S.error,marginTop:"16px"}}>⚠️ {error}</div>}

      {loading && !streaming && (
        <div style={{...S.section,marginTop:"24px"}}>
          <Skeleton height="13px" width="100px" style={{marginBottom:"14px"}} />
          {[1,2,3,4].map(i=><Skeleton key={i} height="14px" width={`${92-i*4}%`} style={{marginBottom:"10px"}} />)}
        </div>
      )}

      {(streaming || (!loading && result)) && (
        <div style={{...S.section,marginTop:"24px"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:"14px"}}>
            <h2 style={{...S.sectionTitle,margin:0,color:streaming?"#a78bfa":"#34d399"}}>
              {streaming ? "✍️ " : "✅ "}{MODE_LABELS[resultMode]||"Result"}
            </h2>
            {!streaming && (
              <button style={A.copyBtn} onClick={()=>{ navigator.clipboard.writeText(result).then(()=>{ setCopied(true); setTimeout(()=>setCopied(false),2000); }); }}>
                {copied?"✅ Copied!":"📋 Copy"}
              </button>
            )}
          </div>
          <FormattedResult text={result} />
          {streaming && <span style={A.cursor}>▋</span>}
        </div>
      )}

      {!streaming && result && (
        <div style={{ ...S.section, marginTop:"16px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"12px" }}>
            <h2 style={{ ...S.sectionTitle, margin:0 }}>🔊 Listen</h2>
            {autoPlay && (audio.url || audio.b64) && (
              <span style={T.autoPlayBadge}>▶ Auto-playing</span>
            )}
          </div>
          <AudioPlayer
            audioUrl={audio.url}
            audioB64={audio.b64}
            audioError={audio.error}
            audioLoading={audio.loading}
            provider={audio.provider}
            autoPlay={autoPlay}
          />
        </div>
      )}
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// ROOT APP
// ════════════════════════════════════════════════════════════════════════════
export default function App() {
  const [activeTab, setActiveTab] = useState("tutor");
  return (
    <>
      <style>{`
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes cursorBlink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{to{transform:rotate(360deg)}}
        *{box-sizing:border-box}
        html{color-scheme:dark;scroll-behavior:smooth}
        body{margin:0;background:#0f0c29}
        button,input,textarea,select{font:inherit}
        button{ -webkit-tap-highlight-color:transparent }
        button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible{outline:2px solid #a78bfa;outline-offset:3px}
        [role=dialog] button{transition:background .18s ease,border-color .18s ease,transform .18s ease,box-shadow .18s ease}
        [role=dialog] button:hover:not(:disabled){filter:brightness(1.08)}
        [role=dialog] button:active:not(:disabled){transform:translateY(1px)}
        [role=dialog] button:disabled{opacity:.55;cursor:not-allowed}
        @media(max-width:640px){
          [role=dialog]{padding:18px!important;border-radius:16px!important}
        }
        input[type=range]{-webkit-appearance:none;appearance:none;height:4px;border-radius:2px;outline:none;cursor:pointer}
        input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#7c3aed;box-shadow:0 0 6px rgba(124,58,237,0.6);cursor:pointer}
        select option{background:#1e1b4b;color:#f0f0f0}
      `}</style>
      <div style={S.page}>
        <div style={{...S.card,maxHeight:"90vh",overflowY:"auto"}}>
          <div style={S.header}>
            <span style={S.icon}>🎓</span>
            <h1 style={S.title}>Personal AI Tutor</h1>
            <p style={S.subtitle}>Ask anything. Analyze everything.</p>
          </div>
          <div style={A.mainTabRow}>
            {[["tutor","🎓 Tutor"],["analyzer","📄 Analyzer"]].map(([t,l])=>(
              <button key={t} onClick={()=>setActiveTab(t)} style={{...A.mainTab,...(activeTab===t?A.mainTabActive:{})}}>{l}</button>
            ))}
          </div>
          {activeTab==="tutor"    && <TutorPanel />}
          {activeTab==="analyzer" && <AnalyzerPanel />}
        </div>
      </div>
    </>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════
const S = {
  page:{minHeight:"100vh",width:"100%",background:"radial-gradient(ellipse at 15% 0%,rgba(124,58,237,.22),transparent 42%),linear-gradient(135deg,#0f0c29 0%,#211c4d 48%,#17172f 100%)",display:"flex",alignItems:"flex-start",justifyContent:"center",padding:"clamp(18px,4vw,40px) 16px",fontFamily:"'Segoe UI',Inter,system-ui,sans-serif"},
  card:{background:"linear-gradient(145deg,rgba(255,255,255,0.065),rgba(255,255,255,0.035))",backdropFilter:"blur(18px)",borderRadius:"22px",border:"1px solid rgba(255,255,255,0.12)",padding:"clamp(18px,4vw,36px)",width:"100%",maxWidth:"760px",color:"#f0f0f0",boxShadow:"0 28px 80px rgba(0,0,0,0.42)"},
  header:{textAlign:"center",marginBottom:"26px"},
  icon:{fontSize:"46px",filter:"drop-shadow(0 8px 18px rgba(124,58,237,.28))"},
  title:{fontSize:"clamp(1.65rem,4vw,2.15rem)",fontWeight:750,letterSpacing:"-.035em",margin:"8px 0 5px",background:"linear-gradient(90deg,#c4b5fd 0%,#93c5fd 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"},
  subtitle:{color:"#9ca3af",fontSize:"0.95rem",margin:0},
  inputRow:{display:"flex",flexDirection:"column",gap:"12px"},
  textareaWrapper:{position:"relative",width:"100%"},
  langBadge:{position:"absolute",top:"8px",right:"10px",background:"rgba(167,139,250,0.25)",color:"#c4b5fd",fontSize:"0.7rem",fontWeight:700,letterSpacing:"0.1em",padding:"2px 8px",borderRadius:"20px",pointerEvents:"none",zIndex:1,userSelect:"none"},
  textarea:{width:"100%",padding:"12px 48px 12px 16px",borderRadius:"12px",border:"1px solid rgba(255,255,255,0.15)",background:"rgba(255,255,255,0.08)",color:"#fff",resize:"vertical",outline:"none",lineHeight:1.6,fontFamily:"inherit"},
  btnGroup:{display:"flex",gap:"12px"},
  btn:{flex:1,padding:"12px",borderRadius:"10px",border:"none",fontWeight:600,fontSize:"0.95rem",cursor:"pointer",fontFamily:"inherit"},
  btnVoice:{background:"#7c3aed",color:"#fff"},
  btnAsk:{background:"#2563eb",color:"#fff"},
  error:{marginTop:"16px",padding:"12px 16px",background:"rgba(239,68,68,0.15)",border:"1px solid rgba(239,68,68,0.4)",borderRadius:"10px",color:"#fca5a5",fontSize:"0.9rem"},
  section:{marginTop:"24px",padding:"20px",background:"rgba(255,255,255,0.05)",borderRadius:"14px",border:"1px solid rgba(255,255,255,0.08)"},
  summaryBox:{background:"rgba(96,165,250,0.08)",border:"1px solid rgba(96,165,250,0.2)"},
  sectionTitle:{fontSize:"1rem",fontWeight:700,margin:"0 0 12px",color:"#a78bfa",textTransform:"uppercase",letterSpacing:"0.08em"},
  explanationText:{lineHeight:1.75,fontSize:"1rem",margin:0},
  summaryText:{lineHeight:1.65,fontSize:"0.95rem",color:"#bfdbfe",margin:0},
  quizList:{paddingLeft:"20px",margin:0},
  quizItem:{marginBottom:"10px",lineHeight:1.6,fontSize:"0.95rem",color:"#e2e8f0"},
};

const A = {
  mainTabRow:{display:"flex",gap:"0",marginBottom:"28px",background:"rgba(255,255,255,0.06)",borderRadius:"12px",padding:"4px",border:"1px solid rgba(255,255,255,0.1)"},
  mainTab:{flex:1,padding:"10px 16px",border:"none",borderRadius:"9px",background:"transparent",color:"#9ca3af",fontWeight:600,fontSize:"0.95rem",cursor:"pointer",fontFamily:"inherit"},
  mainTabActive:{background:"rgba(124,58,237,0.35)",color:"#c4b5fd"},
  tabRow:{display:"flex",gap:"4px",marginBottom:"16px"},
  tabBtn:{flex:1,padding:"9px 12px",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",background:"rgba(255,255,255,0.05)",color:"#9ca3af",fontWeight:600,fontSize:"13px",cursor:"pointer",fontFamily:"inherit"},
  tabBtnActive:{background:"rgba(124,58,237,0.3)",borderColor:"rgba(124,58,237,0.5)",color:"#c4b5fd"},
  dropZone:{border:"2px dashed rgba(255,255,255,0.15)",borderRadius:"14px",padding:"40px 24px",textAlign:"center",cursor:"pointer",background:"rgba(255,255,255,0.03)",color:"#f0f0f0"},
  fileTags:{display:"flex",justifyContent:"center",gap:"6px",marginTop:"14px",flexWrap:"wrap"},
  fileTag:{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"6px",padding:"2px 10px",fontSize:"11px",color:"#9ca3af",fontFamily:"monospace"},
  previewRow:{display:"flex",alignItems:"center",gap:"14px",marginTop:"12px",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"12px",padding:"12px 16px"},
  previewThumb:{width:"56px",height:"56px",borderRadius:"8px",objectFit:"cover",border:"1px solid rgba(255,255,255,0.1)"},
  removeBtn:{background:"none",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"8px",color:"#9ca3af",cursor:"pointer",padding:"6px 10px",fontSize:"13px",fontFamily:"inherit"},
  divider:{height:"1px",background:"rgba(255,255,255,0.08)",margin:"22px 0"},
  modeRow:{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"20px"},
  modeChip:{padding:"7px 14px",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"20px",background:"rgba(255,255,255,0.05)",color:"#9ca3af",fontWeight:600,fontSize:"13px",cursor:"pointer",fontFamily:"inherit"},
  modeChipActive:{background:"rgba(124,58,237,0.2)",borderColor:"rgba(167,139,250,0.5)",color:"#c4b5fd"},
  sliderRow:{display:"flex",alignItems:"center",gap:"14px",marginBottom:"18px"},
  sliderLabel:{fontSize:"13px",color:"#9ca3af",fontWeight:600,whiteSpace:"nowrap"},
  slider:{flex:1,height:"4px",borderRadius:"2px",outline:"none",cursor:"pointer"},
  sliderValue:{fontSize:"12px",color:"#a78bfa",minWidth:"60px",textAlign:"right",fontFamily:"monospace"},
  charCount:{position:"absolute",bottom:"10px",right:"12px",fontSize:"11px",color:"#6b7280",fontFamily:"monospace"},
  copyBtn:{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"#9ca3af",fontSize:"12px",fontWeight:600,padding:"5px 12px",cursor:"pointer",fontFamily:"inherit"},
  cursor:{display:"inline-block",color:"#a78bfa",animation:"cursorBlink 0.8s step-end infinite",marginLeft:"1px"},
};

const V = {
  panel:{background:"linear-gradient(145deg,rgba(124,58,237,.095),rgba(255,255,255,.025))",border:"1px solid rgba(167,139,250,.22)",borderRadius:"18px",padding:"clamp(14px,2.5vw,22px)",marginTop:"14px",marginBottom:"16px",boxShadow:"inset 0 1px 0 rgba(255,255,255,.035)"},
  panelHeader:{fontSize:"13px",fontWeight:700,color:"#a78bfa",textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"16px"},
  autoPlayRow:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"14px",marginBottom:"18px",padding:"13px 15px",background:"linear-gradient(135deg,rgba(255,255,255,.055),rgba(255,255,255,.025))",borderRadius:"12px",border:"1px solid rgba(255,255,255,0.085)"},
  row:{display:"flex",alignItems:"center",gap:"12px",marginBottom:"16px"},
  label:{fontSize:"13px",color:"#9ca3af",fontWeight:600,minWidth:"58px"},
  select:{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"8px",color:"#f0f0f0",padding:"8px 12px",fontSize:"13px",outline:"none",fontFamily:"inherit",cursor:"pointer"},
  slider:{flex:1,height:"4px",borderRadius:"2px",outline:"none",cursor:"pointer"},
  val:{fontSize:"12px",color:"#a78bfa",minWidth:"40px",textAlign:"right",fontFamily:"monospace"},
  cloneToggleBtn:{background:"none",border:"1px solid rgba(167,139,250,0.3)",borderRadius:"8px",color:"#a78bfa",fontSize:"12px",fontWeight:600,padding:"5px 14px",cursor:"pointer",fontFamily:"inherit",marginBottom:"8px"},
  cloneBox:{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:"10px",padding:"14px"},
  cloneHint:{fontSize:"12px",color:"#9ca3af",marginBottom:"10px",lineHeight:1.5},
  cloneInput:{flex:1,background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"8px",color:"#f0f0f0",padding:"8px 12px",fontSize:"13px",outline:"none",fontFamily:"monospace"},
  cloneActive:{marginTop:"8px",fontSize:"12px",color:"#34d399"},
  applyBtn:{background:"#7c3aed",border:"none",borderRadius:"8px",color:"#fff",fontSize:"13px",fontWeight:600,padding:"8px 14px",cursor:"pointer",fontFamily:"inherit"},
  clearBtn:{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.15)",borderRadius:"8px",color:"#9ca3af",fontSize:"13px",padding:"8px 12px",cursor:"pointer",fontFamily:"inherit"},
  emphBtn:{padding:"6px 14px",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"20px",background:"rgba(255,255,255,0.05)",color:"#9ca3af",fontWeight:600,fontSize:"12px",cursor:"pointer",fontFamily:"inherit"},
  emphBtnActive:{background:"rgba(124,58,237,0.25)",borderColor:"rgba(167,139,250,0.5)",color:"#c4b5fd"},
  previewBox:{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:"10px",padding:"14px",marginBottom:"14px"},
  previewInput:{width:"100%",background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"#f0f0f0",padding:"10px 12px",fontSize:"13px",outline:"none",lineHeight:1.6,fontFamily:"inherit",resize:"vertical"},
  resetBtn:{background:"none",border:"1px solid rgba(255,255,255,0.12)",borderRadius:"8px",color:"#6b7280",fontSize:"12px",padding:"5px 14px",cursor:"pointer",fontFamily:"inherit",width:"100%"},
  toggleBtn:{width:"40px",height:"22px",borderRadius:"11px",border:"none",background:"rgba(255,255,255,0.12)",cursor:"pointer",position:"relative",flexShrink:0,transition:"background 0.2s",padding:0},
  toggleBtnOn:{background:"#7c3aed"},
  toggleThumb:{width:"16px",height:"16px",borderRadius:"50%",background:"#fff",position:"absolute",top:"3px",left:"3px",transition:"left 0.2s",pointerEvents:"none"},
  toggleThumbOn:{left:"21px"},
};

const T = {
  toolbar:{display:"flex",alignItems:"center",justifyContent:"space-between",gap:"12px",marginBottom:"14px",padding:"10px 12px",borderRadius:"14px",border:"1px solid rgba(167,139,250,0.18)",background:"linear-gradient(100deg,rgba(124,58,237,0.10),rgba(59,130,246,0.06))",flexWrap:"wrap"},
  toolbarHint:{fontSize:"12px",color:"#a5b4fc",letterSpacing:"0.01em"},
  voiceToggle:{background:"linear-gradient(135deg,#7c3aed,#5b5bd6)",border:"1px solid rgba(196,181,253,0.38)",boxShadow:"0 5px 18px rgba(91,58,190,0.28)",borderRadius:"10px",color:"#fff",fontSize:"13px",fontWeight:650,padding:"9px 14px",cursor:"pointer",fontFamily:"inherit",display:"inline-flex",alignItems:"center",justifyContent:"center",gap:"8px",position:"relative",whiteSpace:"nowrap",transition:"transform .18s ease,box-shadow .18s ease"},
  activeDot:{width:"7px",height:"7px",borderRadius:"50%",background:"#34d399",display:"inline-block",marginLeft:"4px"},
  listeningBar:{marginTop:"10px",padding:"10px 16px",background:"rgba(124,58,237,0.12)",border:"1px solid rgba(124,58,237,0.3)",borderRadius:"10px",fontSize:"13px",color:"#c4b5fd",display:"flex",alignItems:"center",gap:"10px",lineHeight:1.5},
  listeningDot:{width:"10px",height:"10px",borderRadius:"50%",background:"#dc2626",flexShrink:0},
  interimBadge:{position:"absolute",bottom:"10px",left:"12px",right:"56px",fontSize:"12px",color:"#a78bfa",fontStyle:"italic",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",pointerEvents:"none"},
  autoPlayBadge:{fontSize:"11px",color:"#34d399",background:"rgba(52,211,153,0.1)",border:"1px solid rgba(52,211,153,0.25)",borderRadius:"6px",padding:"3px 10px",fontWeight:600},
};