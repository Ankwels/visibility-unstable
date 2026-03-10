import { useState, useEffect, useRef, useCallback } from 'react'

const STORAGE_KEY_A = 'visibility_session_a_v2'
const STORAGE_KEY_B = 'visibility_session_b_v2'
const REFRESH_MS = 6000
const MAX_VISIBILITY = 1.0
const MIN_VISIBILITY = 0.08
const DECAY_PER_SUBMISSION = 0.13

// ── GLITCH STYLES injected once ──────────────────────────────────────────────
const glitchCSS = `
@keyframes glitch-r {
  0%,100% { clip-path: inset(0 0 95% 0); transform: translateX(0); }
  20%      { clip-path: inset(30% 0 50% 0); transform: translateX(-4px); }
  40%      { clip-path: inset(60% 0 20% 0); transform: translateX(3px); }
  60%      { clip-path: inset(10% 0 80% 0); transform: translateX(-2px); }
  80%      { clip-path: inset(80% 0 5%  0); transform: translateX(4px); }
}
@keyframes glitch-b {
  0%,100% { clip-path: inset(0 0 95% 0); transform: translateX(0); }
  20%      { clip-path: inset(50% 0 30% 0); transform: translateX(4px); }
  40%      { clip-path: inset(20% 0 60% 0); transform: translateX(-3px); }
  60%      { clip-path: inset(80% 0 10% 0); transform: translateX(2px); }
  80%      { clip-path: inset(5%  0 80% 0); transform: translateX(-4px); }
}
@keyframes pulse-dot {
  0%,100% { opacity:1; } 50% { opacity:0.2; }
}
@keyframes fadeIn {
  from { opacity:0; transform:translateY(12px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes scanline {
  0%   { top: -10%; }
  100% { top: 110%; }
}
@keyframes flicker {
  0%,100%{ opacity:1; } 92%{ opacity:1; } 93%{ opacity:0.4; } 95%{ opacity:1; } 97%{ opacity:0.6; } 98%{ opacity:1; }
}
.glitch-title {
  position: relative;
  font-family: 'Black Han Sans', sans-serif;
  font-size: clamp(36px, 6vw, 72px);
  color: #f0ece0;
  text-transform: uppercase;
  line-height: 1.05;
  letter-spacing: 0.04em;
  animation: flicker 8s infinite;
}
.glitch-title::before,
.glitch-title::after {
  content: attr(data-text);
  position: absolute; inset: 0;
  font-family: inherit; font-size: inherit;
  text-transform: inherit; letter-spacing: inherit;
  line-height: inherit;
}
.glitch-title::before {
  color: #ff2d78;
  animation: glitch-r 3.5s infinite step-start;
  opacity: 0.8;
}
.glitch-title::after {
  color: #00e5a0;
  animation: glitch-b 3.5s 0.15s infinite step-start;
  opacity: 0.8;
}
.timer-dot {
  display:inline-block; width:8px; height:8px;
  border-radius:50%; background:#ff2d78;
  margin-right:10px;
  animation: pulse-dot 1.4s ease-in-out infinite;
  box-shadow: 0 0 8px rgba(255,45,120,0.7);
}
`

// ── STORAGE helpers ───────────────────────────────────────────────────────────
function loadSubmissions(session) {
  try {
    const raw = localStorage.getItem(session === 'A' ? STORAGE_KEY_A : STORAGE_KEY_B)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveSubmissions(session, data) {
  try {
    localStorage.setItem(session === 'A' ? STORAGE_KEY_A : STORAGE_KEY_B, JSON.stringify(data))
  } catch { /* quota */ }
}

// ── VISIBILITY calculation ────────────────────────────────────────────────────
function computeVisibility(index, total) {
  // newest (highest index) = most visible, oldest = most faded
  const age = total - 1 - index          // 0 = newest
  const v = MAX_VISIBILITY - age * DECAY_PER_SUBMISSION
  return Math.max(MIN_VISIBILITY, v)
}

// ── GLITCH FILTER svg ─────────────────────────────────────────────────────────
function GlitchFilter() {
  return (
    <svg style={{ position:'absolute', width:0, height:0 }}>
      <defs>
        <filter id="fragment" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" result="noise" seed="2"/>
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="8" xChannelSelector="R" yChannelSelector="G"/>
        </filter>
      </defs>
    </svg>
  )
}

// ── CARD component ────────────────────────────────────────────────────────────
function Card({ sub, visibility, isNewest }) {
  const frag = visibility < 0.5
  const heavy = visibility < 0.25

  const cardStyle = {
    position: 'relative',
    background: '#0e1a24',
    border: `1px solid rgba(0,229,160,${visibility * 0.4})`,
    borderRadius: 3,
    overflow: 'hidden',
    opacity: visibility,
    transition: 'opacity 2s ease, filter 2s ease, transform 2s ease',
    filter: heavy
      ? 'saturate(0.2) brightness(0.6)'
      : frag
      ? 'saturate(0.6) brightness(0.8)'
      : 'none',
    transform: heavy ? `translateX(${Math.sin(sub.id * 7.3) * 2}px)` : 'none',
    animation: isNewest ? 'fadeIn 0.6s ease both' : 'none',
    boxShadow: isNewest ? '0 0 20px rgba(0,229,160,0.18)' : 'none',
  }

  const imgStyle = {
    width: '100%',
    aspectRatio: '4/3',
    objectFit: 'cover',
    display: 'block',
    filter: frag ? `url(#fragment)` : 'none',
    transition: 'filter 2s ease',
  }

  return (
    <div style={cardStyle}>
      {/* scan line overlay when fading */}
      {frag && (
        <div style={{
          position:'absolute', inset:0, zIndex:2, pointerEvents:'none',
          background: `repeating-linear-gradient(
            0deg, transparent, transparent 3px,
            rgba(0,0,0,${0.4 * (1 - visibility)}) 3px, rgba(0,0,0,${0.4*(1-visibility)}) 4px
          )`
        }}/>
      )}

      {/* image */}
      <div style={{ position:'relative', overflow:'hidden' }}>
        <img src={sub.imageUrl} alt={sub.name} style={imgStyle} />
        {/* colour channel displacement on heavy fade */}
        {heavy && (
          <>
            <img src={sub.imageUrl} alt="" aria-hidden style={{
              ...imgStyle,
              position:'absolute', inset:0,
              mixBlendMode:'screen', opacity:0.4,
              filter:'url(#fragment)',
              transform:'translateX(4px)',
              tintColor:'red'
            }}/>
          </>
        )}
      </div>

      {/* info */}
      <div style={{ padding:'12px 14px 14px' }}>
        <div style={{
          fontFamily:"'Share Tech Mono', monospace",
          fontSize:11, letterSpacing:'0.15em',
          color: isNewest ? '#00e5a0' : `rgba(0,229,160,${visibility * 0.8})`,
          textTransform:'uppercase', marginBottom:6,
          transition:'color 2s ease'
        }}>
          {isNewest ? '// visible' : visibility < 0.3 ? '// disappearing' : '// fading'}
        </div>
        <div style={{
          fontFamily:"'Black Han Sans', sans-serif",
          fontSize: 18, color:`rgba(240,236,224,${visibility})`,
          textTransform:'uppercase', letterSpacing:'0.04em',
          marginBottom:8, transition:'color 2s ease'
        }}>
          {sub.name}
        </div>
        <div style={{
          fontFamily:"'Rajdhani', sans-serif",
          fontSize:15, lineHeight:1.6, fontWeight:500,
          color:`rgba(200,216,204,${visibility * 0.9})`,
          borderLeft:`2px solid rgba(255,45,120,${visibility * 0.5})`,
          paddingLeft:10, transition:'all 2s ease'
        }}>
          <span style={{ color:`rgba(255,45,120,${visibility * 0.7})`, fontFamily:"'Share Tech Mono',monospace", fontSize:10, letterSpacing:'0.1em', display:'block', marginBottom:3 }}>
            // in this space, visibility is...
          </span>
          {sub.statement}
        </div>
      </div>
    </div>
  )
}

// ── SUBMIT FORM ───────────────────────────────────────────────────────────────
function SubmitForm({ session, onSubmit }) {
  const [name, setName] = useState('')
  const [statement, setStatement] = useState('')
  const [imageUrl, setImageUrl] = useState(null)
  const [preview, setPreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef()

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      setImageUrl(ev.target.result)
      setPreview(ev.target.result)
    }
    reader.readAsDataURL(file)
  }

  function handleSubmit() {
    if (!name.trim() || !statement.trim() || !imageUrl) return
    setSubmitting(true)
    setTimeout(() => {
      onSubmit({ name: name.trim(), statement: statement.trim(), imageUrl, id: Date.now() })
      setDone(true)
      setSubmitting(false)
    }, 800)
  }

  if (done) return (
    <div style={{ textAlign:'center', padding:'48px 24px' }}>
      <div style={{ fontFamily:"'Black Han Sans',sans-serif", fontSize:32, color:'#00e5a0', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
        You were visible.
      </div>
      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:13, color:'rgba(200,216,204,0.6)', letterSpacing:'0.1em' }}>
        // for now — watch the wall
      </div>
    </div>
  )

  const inputStyle = {
    width:'100%', background:'rgba(14,26,36,0.9)',
    border:'1px solid rgba(0,229,160,0.25)',
    borderRadius:3, padding:'12px 14px',
    fontFamily:"'Rajdhani',sans-serif", fontSize:17, fontWeight:500,
    color:'#f0ece0', outline:'none',
    transition:'border-color 0.2s'
  }

  return (
    <div style={{ maxWidth:520, margin:'0 auto', padding:'0 20px 60px' }}>
      <div style={{ marginBottom:32, textAlign:'center' }}>
        <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'rgba(0,229,160,0.6)', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:8 }}>
          // Session {session} — submit your capture
        </div>
        <div style={{ fontFamily:"'Rajdhani',sans-serif", fontSize:17, color:'rgba(200,216,204,0.7)', lineHeight:1.6 }}>
          Upload your screenshot. Your submission will appear on the wall, then begin to disappear.
        </div>
      </div>

      {/* image upload */}
      <div
        onClick={() => fileRef.current.click()}
        style={{
          border:'2px dashed rgba(0,229,160,0.3)', borderRadius:4,
          padding:'28px', textAlign:'center', cursor:'pointer',
          marginBottom:20, transition:'border-color 0.2s',
          background: preview ? 'transparent' : 'rgba(0,229,160,0.03)'
        }}
      >
        {preview
          ? <img src={preview} alt="preview" style={{ maxWidth:'100%', maxHeight:220, objectFit:'contain', borderRadius:3 }}/>
          : <>
              <div style={{ fontSize:32, marginBottom:10 }}>📷</div>
              <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:'rgba(0,229,160,0.7)', letterSpacing:'0.1em' }}>
                TAP TO UPLOAD YOUR SCREENSHOT
              </div>
            </>
        }
        <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleFile}/>
      </div>

      {/* name */}
      <div style={{ marginBottom:16 }}>
        <label style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'rgba(0,229,160,0.6)', letterSpacing:'0.12em', textTransform:'uppercase', display:'block', marginBottom:7 }}>
          // your name
        </label>
        <input
          style={inputStyle}
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="First name or username"
        />
      </div>

      {/* statement */}
      <div style={{ marginBottom:28 }}>
        <label style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'rgba(255,45,120,0.7)', letterSpacing:'0.12em', textTransform:'uppercase', display:'block', marginBottom:7 }}>
          // in this space, visibility is...
        </label>
        <textarea
          style={{ ...inputStyle, resize:'vertical', minHeight:90 }}
          value={statement}
          onChange={e => setStatement(e.target.value)}
          placeholder="complete the sentence"
        />
      </div>

      {/* submit */}
      <button
        onClick={handleSubmit}
        disabled={!name.trim() || !statement.trim() || !imageUrl || submitting}
        style={{
          width:'100%', padding:'16px',
          background: (!name.trim() || !statement.trim() || !imageUrl || submitting)
            ? 'rgba(0,229,160,0.1)' : '#00e5a0',
          border:'none', borderRadius:3, cursor:'pointer',
          fontFamily:"'Black Han Sans',sans-serif", fontSize:20,
          color: (!name.trim() || !statement.trim() || !imageUrl || submitting)
            ? 'rgba(0,229,160,0.4)' : '#050a0e',
          textTransform:'uppercase', letterSpacing:'0.06em',
          transition:'all 0.2s',
        }}
      >
        {submitting ? 'Entering the space...' : 'Make me visible'}
      </button>
    </div>
  )
}

// ── WALL view ─────────────────────────────────────────────────────────────────
function Wall({ submissions }) {
  if (submissions.length === 0) return (
    <div style={{ textAlign:'center', padding:'80px 24px' }}>
      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:13, color:'rgba(200,216,204,0.3)', letterSpacing:'0.15em', textTransform:'uppercase' }}>
        // no one has been captured yet
      </div>
    </div>
  )

  const total = submissions.length

  return (
    <div style={{
      display:'grid',
      gridTemplateColumns:'repeat(auto-fill, minmax(260px, 1fr))',
      gap:16, padding:'0 20px 60px'
    }}>
      {submissions.map((sub, i) => (
        <Card
          key={sub.id}
          sub={sub}
          visibility={computeVisibility(i, total)}
          isNewest={i === total - 1}
        />
      ))}
    </div>
  )
}

// ── ROOT APP ──────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState(null)       // 'A' | 'B'
  const [view, setView] = useState('wall')            // 'wall' | 'submit'
  const [submissions, setSubmissions] = useState([])
  const intervalRef = useRef(null)

  // inject glitch CSS once
  useEffect(() => {
    const s = document.createElement('style')
    s.textContent = glitchCSS
    document.head.appendChild(s)
    return () => document.head.removeChild(s)
  }, [])

  // poll storage
  const refresh = useCallback(() => {
    if (!session) return
    setSubmissions(loadSubmissions(session))
  }, [session])

  useEffect(() => {
    if (!session) return
    refresh()
    intervalRef.current = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(intervalRef.current)
  }, [session, refresh])

  function handleSubmit(entry) {
    const updated = [...loadSubmissions(session), entry]
    saveSubmissions(session, updated)
    setSubmissions(updated)
    setView('wall')
  }

  // ── SESSION PICKER ──
  if (!session) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:24 }}>
      <GlitchFilter/>
      <div className="glitch-title" data-text="VISIBILITY IS UNSTABLE" style={{ textAlign:'center', marginBottom:16 }}>
        VISIBILITY IS UNSTABLE
      </div>
      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:13, color:'rgba(200,216,204,0.5)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:48 }}>
        MDC602 &nbsp;·&nbsp; Week 7 &nbsp;·&nbsp; Matterport and the Disposable Body
      </div>
      <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:12, color:'rgba(0,229,160,0.6)', letterSpacing:'0.15em', textTransform:'uppercase', marginBottom:20 }}>
        // select your session
      </div>
      <div style={{ display:'flex', gap:16 }}>
        {['A','B'].map(s => (
          <button key={s} onClick={() => setSession(s)} style={{
            padding:'18px 44px',
            background:'rgba(0,229,160,0.06)',
            border:'1px solid rgba(0,229,160,0.35)',
            borderRadius:3, cursor:'pointer',
            fontFamily:"'Black Han Sans',sans-serif",
            fontSize:28, color:'#00e5a0',
            textTransform:'uppercase', letterSpacing:'0.08em',
            transition:'all 0.2s'
          }}>
            Session {s}
          </button>
        ))}
      </div>
      <div style={{ marginTop:20, fontFamily:"'Rajdhani',sans-serif", fontSize:15, color:'rgba(200,216,204,0.4)', textAlign:'center' }}>
        A — 11:00–13:00 &nbsp;&nbsp; B — 14:00–16:00
      </div>
    </div>
  )

  // ── MAIN UI ──
  return (
    <div style={{ minHeight:'100vh' }}>
      <GlitchFilter/>

      {/* header */}
      <div style={{
        padding:'24px 20px 20px',
        borderBottom:'1px solid rgba(0,229,160,0.12)',
        marginBottom:28,
        background:'rgba(5,10,14,0.95)',
        position:'sticky', top:0, zIndex:100,
        backdropFilter:'blur(8px)'
      }}>
        <div style={{ maxWidth:1100, margin:'0 auto', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <div className="glitch-title" data-text="VISIBILITY IS UNSTABLE" style={{ fontSize:'clamp(22px,4vw,36px)' }}>
              VISIBILITY IS UNSTABLE
            </div>
            <div style={{ fontFamily:"'Share Tech Mono',monospace", fontSize:11, color:'rgba(200,216,204,0.4)', letterSpacing:'0.12em', textTransform:'uppercase', marginTop:5 }}>
              <span className="timer-dot"/>
              Session {session} &nbsp;·&nbsp; {submissions.length} {submissions.length === 1 ? 'body' : 'bodies'} captured
            </div>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            {['wall','submit'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding:'10px 22px',
                background: view === v ? (v === 'submit' ? '#ff2d78' : '#00e5a0') : 'transparent',
                border: `1px solid ${v === 'submit' ? 'rgba(255,45,120,0.4)' : 'rgba(0,229,160,0.4)'}`,
                borderRadius:3, cursor:'pointer',
                fontFamily:"'Share Tech Mono',monospace", fontSize:12,
                color: view === v ? '#050a0e' : (v === 'submit' ? 'rgba(255,45,120,0.8)' : 'rgba(0,229,160,0.8)'),
                letterSpacing:'0.1em', textTransform:'uppercase',
                transition:'all 0.2s'
              }}>
                {v === 'wall' ? '// The Wall' : '// Submit'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* content */}
      <div style={{ maxWidth:1100, margin:'0 auto' }}>
        {view === 'wall'
          ? <Wall submissions={submissions}/>
          : <SubmitForm session={session} onSubmit={handleSubmit}/>
        }
      </div>
    </div>
  )
}
