import React, { useState, useMemo, useEffect } from "react";

// ---------- deterministic daily randomness ----------
function hashStr(s) {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

// ---------- sign data with constellation patterns ----------
const SIGNS = [
  { name: "Aries", glyph: "\u2648", dates: "Mar 21 - Apr 19", element: "Fire", traits: ["bold", "impatient", "first in line"],
    stars: [[35,125],[80,95],[125,72],[160,90],[172,112]], lines: [[0,1],[1,2],[2,3],[3,4]] },
  { name: "Taurus", glyph: "\u2649", dates: "Apr 20 - May 20", element: "Earth", traits: ["steady", "stubborn", "luxurious"],
    stars: [[35,55],[72,88],[100,108],[128,92],[168,48],[60,140]], lines: [[0,1],[1,2],[2,3],[3,4],[2,5]] },
  { name: "Gemini", glyph: "\u264A", dates: "May 21 - Jun 20", element: "Air", traits: ["quick", "curious", "double-booked"],
    stars: [[55,40],[62,90],[70,142],[125,38],[130,88],[136,140]], lines: [[0,1],[1,2],[3,4],[4,5],[0,3],[1,4]] },
  { name: "Cancer", glyph: "\u264B", dates: "Jun 21 - Jul 22", element: "Water", traits: ["intuitive", "protective", "moonlit"],
    stars: [[100,38],[95,88],[58,132],[135,138]], lines: [[0,1],[1,2],[1,3]] },
  { name: "Leo", glyph: "\u264C", dates: "Jul 23 - Aug 22", element: "Fire", traits: ["radiant", "theatrical", "loyal"],
    stars: [[142,48],[118,38],[98,56],[104,82],[132,96],[92,148],[48,150],[64,118]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,3]] },
  { name: "Virgo", glyph: "\u264D", dates: "Aug 23 - Sep 22", element: "Earth", traits: ["precise", "observant", "quietly right"],
    stars: [[38,52],[72,80],[102,70],[132,92],[152,132],[100,122],[68,150]], lines: [[0,1],[1,2],[2,3],[3,4],[3,5],[5,6]] },
  { name: "Libra", glyph: "\u264E", dates: "Sep 23 - Oct 22", element: "Air", traits: ["balanced", "charming", "deciding later"],
    stars: [[68,58],[132,54],[100,98],[62,142],[140,146]], lines: [[0,1],[0,2],[1,2],[2,3],[2,4]] },
  { name: "Scorpio", glyph: "\u264F", dates: "Oct 23 - Nov 21", element: "Water", traits: ["intense", "magnetic", "all or nothing"],
    stars: [[40,50],[58,82],[74,112],[95,132],[122,142],[148,130],[162,104],[150,84]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7]] },
  { name: "Sagittarius", glyph: "\u2650", dates: "Nov 22 - Dec 21", element: "Fire", traits: ["adventurous", "blunt", "already packing"],
    stars: [[60,82],[92,58],[124,74],[134,112],[100,132],[68,116],[160,52]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0],[2,6]] },
  { name: "Capricorn", glyph: "\u2651", dates: "Dec 22 - Jan 19", element: "Earth", traits: ["ambitious", "dry-witted", "playing long"],
    stars: [[40,70],[78,110],[120,132],[156,100],[140,58]], lines: [[0,1],[1,2],[2,3],[3,4]] },
  { name: "Aquarius", glyph: "\u2652", dates: "Jan 20 - Feb 18", element: "Air", traits: ["original", "detached", "ahead of it"],
    stars: [[40,62],[72,86],[60,118],[96,102],[122,132],[152,110]], lines: [[0,1],[1,2],[1,3],[3,4],[4,5]] },
  { name: "Pisces", glyph: "\u2653", dates: "Feb 19 - Mar 20", element: "Water", traits: ["dreamy", "empathic", "elsewhere"],
    stars: [[42,42],[62,82],[82,120],[112,140],[150,130],[166,100]], lines: [[0,1],[1,2],[2,3],[3,4],[4,5]] },
];

// ---------- daily copy pools ----------
const OPENERS = [
  "The moon spent all night rearranging your priorities. Check the top of the list.",
  "Something you shelved weeks ago is asking to be picked back up.",
  "Today runs on borrowed momentum. Spend it before noon.",
  "A door you thought was closed was only ever heavy.",
  "Your intuition is loud today. It is also, unusually, correct.",
  "The universe owes you one from last week. Today it pays in small coins.",
  "An overdue conversation finds its opening. Let it.",
  "What looks like a delay is actually choreography.",
  "The sky is between dramas. Use the quiet.",
  "Saturn is minding its own business for once. Take advantage.",
];
const ADVICE = [
  "Say the honest thing in the meeting. Phrase it kindly, but say it.",
  "Answer the message you have been composing in your head for three days.",
  "Take the longer route home. Something on it belongs to you.",
  "Let someone help you. They have been waiting to be asked.",
  "Finish the small thing first. The big thing is watching how you handle it.",
  "Trust the first draft of your gut, not the fifth draft of your doubt.",
  "Make the unreasonable ask. The worst case is the situation you are already in.",
  "Protect one hour today like it is money.",
  "Write it down before it evaporates. Tonight you will be glad.",
  "Compliment a stranger. The orbit returns it within nine days.",
];
const WARNINGS = [
  "Do not reread old messages looking for new meanings. The archive is closed.",
  "Avoid making permanent decisions during temporary moods.",
  "Beware advice from people who want your problem to stay interesting.",
  "Do not confuse being busy with being needed.",
  "Resist explaining yourself twice. Once was generous.",
  "Skip the argument that is really about something else.",
  "The cart can wait until Mercury minds its own business.",
  "Watch the urge to fix what was never yours to repair.",
  "Decline the third coffee. The stars have seen what happens.",
  "Do not check their profile. You already know.",
];
const ONELINERS = [
  "today you will win an argument you started in the shower.",
  "the stars said rest. The stars did not say doomscroll.",
  "your red flag of the day is calling it 'just a vibe.'",
  "Mercury is not in retrograde. You sent that text on purpose.",
  "today's forecast: unbothered, moisturized, mildly chaotic.",
  "you are the group chat's emergency contact. Act accordingly.",
  "manifesting works better with a to-do list. The universe checked.",
  "your villain era is postponed due to a nice afternoon.",
  "someone is thinking about you. It is probably your group chat.",
  "the audacity you need today is already in your possession.",
  "today's lesson is free if you learn it the first time.",
  "your aura is in airplane mode. Enjoy it.",
  "the universe is not testing you. It is just Tuesday energy.",
  "you cannot be late if you decide it starts when you arrive.",
];
const MATCH_LINES = [
  "Your chaos speaks their language.",
  "They finish your sentences. You forgive them for it.",
  "Same storm, different umbrellas.",
  "A slow burn with excellent ventilation.",
  "Cosmic co-conspirators since before either of you existed.",
  "They are the water to your perfectly timed sunlight.",
  "Two open tabs in the same browser of fate.",
];
const COLORS_OF_DAY = ["Oxblood", "Moonstone", "Saffron", "Deep teal", "Lilac smoke", "Burnt gold", "Glacier blue", "Cherry ink", "Sage", "Ultraviolet"];
const MOODS = ["Magnetic", "Unbothered", "Feral but polite", "Soft focus", "Decisive", "Nostalgic", "Electric", "Quietly smug", "Cinematic", "Recharging"];

function dailyReading(signIndex, dateStr) {
  const sign = SIGNS[signIndex];
  const rng = mulberry32(hashStr(dateStr + "::" + sign.name));
  const love = 35 + Math.floor(rng() * 61);
  const career = 35 + Math.floor(rng() * 61);
  const chaos = 10 + Math.floor(rng() * 81);
  const luckyNum = 1 + Math.floor(rng() * 33);
  const hour = 1 + Math.floor(rng() * 12);
  const ampm = rng() > 0.45 ? "PM" : "AM";
  let matchIdx = Math.floor(rng() * 12);
  if (matchIdx === signIndex) matchIdx = (matchIdx + 5) % 12;
  return {
    opener: pick(rng, OPENERS),
    advice: pick(rng, ADVICE),
    warning: pick(rng, WARNINGS),
    oneliner: pick(rng, ONELINERS),
    matchIdx,
    matchLine: pick(rng, MATCH_LINES),
    matchPct: 62 + Math.floor(rng() * 37),
    love, career, chaos, luckyNum,
    powerHour: hour + " " + ampm,
    color: pick(rng, COLORS_OF_DAY),
    mood: pick(rng, MOODS),
  };
}

// ---------- starfield ----------
function makeStars(n, seed) {
  const rng = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: rng() * 100,
    y: rng() * 100,
    r: 0.6 + rng() * 1.6,
    d: 2 + rng() * 5,
    delay: rng() * 6,
    o: 0.25 + rng() * 0.6,
  }));
}

// ---------- share card renderer (canvas -> PNG) ----------
function wrapLines(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? line + " " + w : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

async function drawShareCard(sign, reading, niceDate) {
  try {
    await document.fonts.load('italic 600 120px "Cormorant Garamond"');
    await document.fonts.load('500 30px "Outfit"');
    await document.fonts.ready;
  } catch (e) { /* system fallbacks still look fine */ }

  const W = 1080, H = 1920;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");
  const ls = (v) => { try { ctx.letterSpacing = v; } catch (e) {} };

  // background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#1C1433"); bg.addColorStop(0.55, "#0D0A1A"); bg.addColorStop(1, "#080614");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // starfield (seeded so the card is identical every time today)
  const rng = mulberry32(hashStr(sign.name + "::card"));
  for (let i = 0; i < 120; i++) {
    const x = rng() * W, y = rng() * H, r = 1 + rng() * 2.6;
    ctx.globalAlpha = 0.15 + rng() * 0.5;
    ctx.fillStyle = "#EDE6F7";
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;

  // zodiac wheel rings behind constellation
  ctx.strokeStyle = "rgba(227,188,107,0.14)";
  ctx.setLineDash([4, 14]); ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(W / 2, 640, 430, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(227,188,107,0.08)";
  ctx.beginPath(); ctx.arc(W / 2, 640, 340, 0, Math.PI * 2); ctx.stroke();

  // date eyebrow
  ctx.textAlign = "center";
  ls("10px");
  ctx.fillStyle = "#A6986F";
  ctx.font = '500 30px "Outfit", sans-serif';
  ctx.fillText(niceDate.toUpperCase(), W / 2, 170);
  ls("0px");

  // constellation, scaled up with glow
  const scale = 3.1, ox = W / 2 - 100 * scale, oy = 330;
  ctx.strokeStyle = "#E3BC6B"; ctx.lineWidth = 4; ctx.lineCap = "round";
  ctx.shadowColor = "rgba(227,188,107,0.7)"; ctx.shadowBlur = 18;
  ctx.globalAlpha = 0.8;
  for (const [a, b] of sign.lines) {
    ctx.beginPath();
    ctx.moveTo(ox + sign.stars[a][0] * scale, oy + sign.stars[a][1] * scale);
    ctx.lineTo(ox + sign.stars[b][0] * scale, oy + sign.stars[b][1] * scale);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const [x, y] of sign.stars) {
    const px = ox + x * scale, py = oy + y * scale;
    ctx.fillStyle = "rgba(227,188,107,0.25)";
    ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#F4E3B2";
    ctx.beginPath(); ctx.arc(px, py, 8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.shadowBlur = 0;

  // sign name and traits
  ctx.fillStyle = "#F2EBDA";
  ctx.font = 'italic 600 120px "Cormorant Garamond", Georgia, serif';
  ctx.fillText(sign.name, W / 2, 1065);
  ctx.fillStyle = "#9C93B8";
  ctx.font = '300 32px "Outfit", sans-serif';
  ctx.fillText(sign.traits.join("  \u00b7  "), W / 2, 1122);

  // gold divider
  const dg = ctx.createLinearGradient(W / 2 - 140, 0, W / 2 + 140, 0);
  dg.addColorStop(0, "rgba(227,188,107,0)"); dg.addColorStop(0.5, "#E3BC6B"); dg.addColorStop(1, "rgba(227,188,107,0)");
  ctx.fillStyle = dg; ctx.fillRect(W / 2 - 140, 1160, 280, 2);

  // one-liner
  ctx.fillStyle = "#F2EBDA";
  ctx.font = 'italic 500 60px "Cormorant Garamond", Georgia, serif';
  const quote = "\u201c" + sign.name + ": " + reading.oneliner + "\u201d";
  const lines = wrapLines(ctx, quote, 840);
  let y = 1262;
  for (const ln of lines) { ctx.fillText(ln, W / 2, y); y += 78; }

  // stats columns
  const statsY = Math.max(y + 56, 1560);
  const cols = [["LOVE", reading.love, "#D98E9C"], ["CAREER", reading.career, "#8FB8D9"], ["CHAOS", reading.chaos, "#E3BC6B"]];
  cols.forEach(([label, val, color], i) => {
    const cx = W / 2 + (i - 1) * 280;
    ctx.fillStyle = color;
    ctx.font = '600 58px "Outfit", sans-serif';
    ctx.fillText(val + "%", cx, statsY);
    ls("6px");
    ctx.fillStyle = "#7E7499";
    ctx.font = '500 26px "Outfit", sans-serif';
    ctx.fillText(label, cx, statsY + 44);
    ls("0px");
  });

  // lucky row
  ctx.fillStyle = "#BBB1D4";
  ctx.font = '300 31px "Outfit", sans-serif';
  ctx.fillText(
    "Lucky number " + reading.luckyNum + "   \u00b7   Power hour " + reading.powerHour + "   \u00b7   Wear " + reading.color.toLowerCase(),
    W / 2, statsY + 138
  );

  // footer brand
  ls("12px");
  ctx.fillStyle = "#A6986F";
  ctx.font = '500 30px "Outfit", sans-serif';
  ctx.fillText("CELESTIAL DAILY", W / 2, 1828);
  ls("0px");
  ctx.fillStyle = "#564E70";
  ctx.font = '300 24px "Outfit", sans-serif';
  ctx.fillText("Read yours tomorrow", W / 2, 1872);

  return canvas;
}

// ---------- constellation component ----------
function Constellation({ sign, size = 220, animateKey }) {
  return (
    <svg key={animateKey} viewBox="0 0 200 190" width={size} height={size * 0.86} style={{ overflow: "visible" }}>
      {sign.lines.map(([a, b], i) => {
        const [x1, y1] = sign.stars[a];
        const [x2, y2] = sign.stars[b];
        const len = Math.hypot(x2 - x1, y2 - y1);
        return (
          <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke="#E3BC6B" strokeWidth="0.9" strokeLinecap="round"
            strokeDasharray={len} strokeDashoffset={len}
            style={{ animation: `drawline 0.7s ease forwards ${0.15 + i * 0.13}s`, opacity: 0.75 }} />
        );
      })}
      {sign.stars.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r="6" fill="#E3BC6B" opacity="0.12"
            style={{ animation: `starpop 0.5s ease forwards ${i * 0.1}s`, transformOrigin: `${x}px ${y}px`, transform: "scale(0)" }} />
          <circle cx={x} cy={y} r="2.4" fill="#F4E3B2"
            style={{ animation: `starpop 0.5s ease forwards ${i * 0.1}s`, transformOrigin: `${x}px ${y}px`, transform: "scale(0)" }} />
        </g>
      ))}
    </svg>
  );
}

// ---------- meter ----------
function Meter({ label, value, color }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(value), 120);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#9C93B8" }}>{label}</span>
        <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: 12, color: "#E9E2F5", fontWeight: 600 }}>{value}%</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: "rgba(255,255,255,0.07)" }}>
        <div style={{ height: "100%", width: w + "%", borderRadius: 3, background: color, transition: "width 1.1s cubic-bezier(0.22,1,0.36,1)", boxShadow: `0 0 8px ${color}55` }} />
      </div>
    </div>
  );
}

// ---------- main app ----------
export default function CelestialDaily() {
  const [signIndex, setSignIndex] = useState(null);
  const [copied, setCopied] = useState(false);
  const [peek, setPeek] = useState(false);
  const [cardUrl, setCardUrl] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [shareNote, setShareNote] = useState("");

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const niceDate = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const tomorrow = new Date(now.getTime() + 86400000);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);

  const stars = useMemo(() => makeStars(70, 42), []);
  const reading = signIndex !== null ? dailyReading(signIndex, dateStr) : null;
  const tomorrowReading = signIndex !== null ? dailyReading(signIndex, tomorrowStr) : null;
  const sign = signIndex !== null ? SIGNS[signIndex] : null;

  const shareText = sign && reading
    ? `${sign.glyph} ${sign.name} \u00b7 ${niceDate}\n\u201c${sign.name}: ${reading.oneliner}\u201d\nLove ${reading.love}% \u00b7 Career ${reading.career}% \u00b7 Chaos ${reading.chaos}%\nLucky number ${reading.luckyNum} \u00b7 Power hour ${reading.powerHour}\nRead yours: Celestial Daily`
    : "";

  const openShareCard = async () => {
    setGenerating(true);
    try {
      const canvas = await drawShareCard(sign, reading, niceDate);
      setCardUrl(canvas.toDataURL("image/png"));
    } finally {
      setGenerating(false);
    }
  };

  const fileName = sign ? `celestial-${sign.name.toLowerCase()}-${dateStr}.png` : "celestial.png";

  const downloadImage = () => {
    const a = document.createElement("a");
    a.href = cardUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setShareNote("Saved. Post it before the stars change their mind.");
    setTimeout(() => setShareNote(""), 2600);
  };

  const shareImage = async () => {
    try {
      const blob = await (await fetch(cardUrl)).blob();
      const file = new File([blob], fileName, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "Celestial Daily", text: shareText });
        return;
      }
    } catch (e) { /* user cancelled or unsupported, fall back */ }
    downloadImage();
  };

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch (e) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(120% 90% at 50% 0%, #1C1433 0%, #0D0A1A 55%, #080614 100%)", color: "#E9E2F5", fontFamily: "'Outfit', sans-serif", position: "relative", overflowX: "hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500;1,600&family=Outfit:wght@300;400;500;600&display=swap');
        @keyframes twinkle { 0%,100% { opacity: var(--o); } 50% { opacity: 0.08; } }
        @keyframes drawline { to { stroke-dashoffset: 0; } }
        @keyframes starpop { to { transform: scale(1); } }
        @keyframes rise { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slowspin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
        .glyphbtn { transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease; }
        .glyphbtn:hover { transform: translateY(-3px); border-color: rgba(227,188,107,0.6) !important; background: rgba(227,188,107,0.07) !important; }
        .glyphbtn:focus-visible, .actionbtn:focus-visible { outline: 2px solid #E3BC6B; outline-offset: 3px; }
        .actionbtn { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .actionbtn:hover { transform: translateY(-1px); }
        .actionbtn:active { transform: translateY(0px) scale(0.98); }
      `}</style>

      {/* starfield */}
      <div aria-hidden="true" style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        {stars.map(s => (
          <div key={s.id} style={{ position: "absolute", left: s.x + "%", top: s.y + "%", width: s.r * 2, height: s.r * 2, borderRadius: "50%", background: "#EDE6F7", "--o": s.o, opacity: s.o, animation: `twinkle ${s.d}s ease-in-out infinite ${s.delay}s` }} />
        ))}
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 20px 60px", position: "relative" }}>

        {/* header */}
        <header style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: "#A6986F", marginBottom: 8 }}>{niceDate}</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 600, fontStyle: "italic", fontSize: 34, margin: 0, color: "#F2EBDA", letterSpacing: 0.5 }}>
            Celestial Daily
          </h1>
          <div style={{ width: 54, height: 1, background: "linear-gradient(90deg, transparent, #E3BC6B, transparent)", margin: "12px auto 0" }} />
        </header>

        {signIndex === null && (
          <section style={{ animation: "rise 0.5s ease" }}>
            <p style={{ textAlign: "center", color: "#9C93B8", fontSize: 14, fontWeight: 300, marginBottom: 22 }}>
              The sky has been writing all night. Choose your sign to read what it left for you.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {SIGNS.map((s, i) => (
                <button key={s.name} className="glyphbtn" onClick={() => { setSignIndex(i); setPeek(false); }}
                  style={{ cursor: "pointer", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(233,226,245,0.12)", borderRadius: 14, padding: "16px 6px 12px", color: "#E9E2F5", textAlign: "center" }}>
                  <div style={{ fontSize: 26, color: "#E3BC6B", lineHeight: 1 }}>{s.glyph}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, marginTop: 7 }}>{s.name}</div>
                  <div style={{ fontSize: 9.5, color: "#7E7499", marginTop: 3, letterSpacing: 0.4 }}>{s.dates}</div>
                </button>
              ))}
            </div>
          </section>
        )}

        {sign && reading && (
          <section style={{ animation: "rise 0.5s ease" }}>

            {/* hero constellation card */}
            <div style={{ position: "relative", border: "1px solid rgba(227,188,107,0.28)", borderRadius: 20, padding: "26px 22px 22px", background: "linear-gradient(165deg, rgba(227,188,107,0.06), rgba(20,14,40,0.4))", textAlign: "center", overflow: "hidden" }}>
              <div aria-hidden="true" style={{ position: "absolute", inset: -60, opacity: 0.06, animation: "slowspin 90s linear infinite", pointerEvents: "none" }}>
                <svg viewBox="0 0 100 100" width="100%" height="100%">
                  <circle cx="50" cy="50" r="46" fill="none" stroke="#E3BC6B" strokeWidth="0.3" strokeDasharray="1 3" />
                  <circle cx="50" cy="50" r="36" fill="none" stroke="#E3BC6B" strokeWidth="0.2" />
                </svg>
              </div>
              <div style={{ fontSize: 10, letterSpacing: 3.5, textTransform: "uppercase", color: "#A6986F" }}>{sign.element} sign {"\u00b7"} {sign.dates}</div>
              <Constellation sign={sign} animateKey={sign.name + dateStr} />
              <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 600, fontSize: 38, margin: "2px 0 4px", color: "#F2EBDA" }}>{sign.name}</h2>
              <div style={{ fontSize: 12.5, color: "#9C93B8", fontWeight: 300 }}>{sign.traits.join(" \u00b7 ")}</div>
              <div style={{ marginTop: 14, display: "inline-block", border: "1px solid rgba(227,188,107,0.35)", borderRadius: 999, padding: "5px 14px", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", color: "#E3BC6B" }}>
                Mood: {reading.mood}
              </div>
            </div>

            {/* reading */}
            <div style={{ marginTop: 18, padding: "4px 6px" }}>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 21, lineHeight: 1.5, color: "#EFE8F8", margin: "0 0 14px" }}>
                {reading.opener}
              </p>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#BBB1D4", fontWeight: 300, margin: "0 0 10px" }}>
                <span style={{ color: "#E3BC6B", fontWeight: 500 }}>Do: </span>{reading.advice}
              </p>
              <p style={{ fontSize: 14.5, lineHeight: 1.65, color: "#BBB1D4", fontWeight: 300, margin: 0 }}>
                <span style={{ color: "#D98E9C", fontWeight: 500 }}>Avoid: </span>{reading.warning}
              </p>
            </div>

            {/* meters */}
            <div style={{ marginTop: 22, border: "1px solid rgba(233,226,245,0.1)", borderRadius: 16, padding: "18px 18px 8px", background: "rgba(255,255,255,0.02)" }}>
              <Meter label="Love" value={reading.love} color="#D98E9C" />
              <Meter label="Career" value={reading.career} color="#8FB8D9" />
              <Meter label="Chaos" value={reading.chaos} color="#E3BC6B" />
            </div>

            {/* lucky row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
              {[
                ["Lucky number", reading.luckyNum],
                ["Power hour", reading.powerHour],
                ["Wear", reading.color],
              ].map(([label, val]) => (
                <div key={label} style={{ border: "1px solid rgba(233,226,245,0.1)", borderRadius: 14, padding: "14px 8px", textAlign: "center", background: "rgba(255,255,255,0.02)" }}>
                  <div style={{ fontSize: 9.5, letterSpacing: 1.8, textTransform: "uppercase", color: "#7E7499", marginBottom: 6 }}>{label}</div>
                  <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 19, color: "#F2EBDA" }}>{val}</div>
                </div>
              ))}
            </div>

            {/* cosmic match */}
            <div style={{ marginTop: 14, border: "1px solid rgba(217,142,156,0.3)", borderRadius: 16, padding: "16px 18px", background: "linear-gradient(150deg, rgba(217,142,156,0.07), transparent)", display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ fontSize: 34, color: "#D98E9C", lineHeight: 1 }}>{SIGNS[reading.matchIdx].glyph}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: "#C99AA5" }}>Cosmic match of the day</div>
                <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, color: "#F2EBDA", margin: "3px 0 2px" }}>
                  {SIGNS[reading.matchIdx].name} {"\u00b7"} {reading.matchPct}%
                </div>
                <div style={{ fontSize: 12.5, color: "#9C93B8", fontWeight: 300 }}>{reading.matchLine}</div>
              </div>
            </div>

            {/* shareable one-liner card */}
            <div style={{ marginTop: 20, border: "1px solid rgba(227,188,107,0.35)", borderRadius: 18, padding: "24px 22px", textAlign: "center", background: "radial-gradient(100% 120% at 50% 0%, rgba(227,188,107,0.1), rgba(13,10,26,0.5))" }}>
              <div style={{ fontSize: 10, letterSpacing: 3, textTransform: "uppercase", color: "#A6986F", marginBottom: 10 }}>Today in one line</div>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontSize: 22, lineHeight: 1.45, color: "#F2EBDA", margin: "0 0 18px" }}>
                {"\u201c"}{sign.name}: {reading.oneliner}{"\u201d"}
              </p>
              <button className="actionbtn" onClick={openShareCard} disabled={generating}
                style={{ cursor: "pointer", border: "none", borderRadius: 999, padding: "12px 30px", fontFamily: "'Outfit', sans-serif", fontSize: 13, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase", color: "#14102A", background: "linear-gradient(120deg, #E3BC6B, #F4E3B2)", boxShadow: "0 4px 20px rgba(227,188,107,0.3)", opacity: generating ? 0.7 : 1 }}>
                {generating ? "Summoning your card" : "Share today's card"}
              </button>
              <div style={{ marginTop: 12 }}>
                <button className="actionbtn" onClick={copyText}
                  style={{ cursor: "pointer", background: "transparent", border: "none", color: "#7E7499", fontSize: 11, letterSpacing: 0.8, fontFamily: "'Outfit', sans-serif", textDecoration: "underline", textUnderlineOffset: 3 }}>
                  {copied ? "Copied" : "or copy as text"}
                </button>
              </div>
            </div>

            {/* tomorrow teaser */}
            <div style={{ marginTop: 16, border: "1px dashed rgba(233,226,245,0.18)", borderRadius: 16, padding: "16px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 10, letterSpacing: 2.5, textTransform: "uppercase", color: "#7E7499", marginBottom: 8 }}>Tomorrow whispers</div>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontSize: 17, color: "#BBB1D4", margin: "0 0 10px", filter: peek ? "none" : "blur(6px)", transition: "filter 0.5s ease", userSelect: peek ? "auto" : "none" }}>
                {"\u201c"}{sign.name}: {tomorrowReading.oneliner}{"\u201d"}
              </p>
              {!peek ? (
                <button className="actionbtn" onClick={() => setPeek(true)}
                  style={{ cursor: "pointer", background: "transparent", border: "1px solid rgba(233,226,245,0.2)", borderRadius: 999, padding: "7px 18px", color: "#9C93B8", fontSize: 11.5, letterSpacing: 1, fontFamily: "'Outfit', sans-serif" }}>
                  Sneak one peek
                </button>
              ) : (
                <div style={{ fontSize: 11, color: "#7E7499" }}>Full reading unlocks at midnight. The stars keep a schedule.</div>
              )}
            </div>

            {/* switch sign */}
            <div style={{ textAlign: "center", marginTop: 24 }}>
              <button className="actionbtn" onClick={() => { setSignIndex(null); setCopied(false); setCardUrl(null); }}
                style={{ cursor: "pointer", background: "transparent", border: "none", color: "#7E7499", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "'Outfit', sans-serif" }}>
                {"\u2190"} Read another sign
              </button>
            </div>
          </section>
        )}

        {/* share card modal */}
        {cardUrl && (
          <div role="dialog" aria-label="Share card preview" onClick={() => setCardUrl(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(5,4,12,0.85)", backdropFilter: "blur(6px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, animation: "rise 0.3s ease" }}>
            <div onClick={(e) => e.stopPropagation()} style={{ maxWidth: 340, width: "100%", textAlign: "center" }}>
              <img src={cardUrl} alt={`${sign.name} daily card`}
                style={{ width: "100%", borderRadius: 18, border: "1px solid rgba(227,188,107,0.35)", boxShadow: "0 20px 60px rgba(0,0,0,0.6)", display: "block" }} />
              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button className="actionbtn" onClick={shareImage}
                  style={{ flex: 1, cursor: "pointer", border: "none", borderRadius: 999, padding: "12px 0", fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: "#14102A", background: "linear-gradient(120deg, #E3BC6B, #F4E3B2)" }}>
                  Share
                </button>
                <button className="actionbtn" onClick={downloadImage}
                  style={{ flex: 1, cursor: "pointer", borderRadius: 999, padding: "12px 0", fontFamily: "'Outfit', sans-serif", fontSize: 12.5, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase", color: "#E9E2F5", background: "transparent", border: "1px solid rgba(233,226,245,0.3)" }}>
                  Save image
                </button>
              </div>
              <div style={{ marginTop: 12, minHeight: 16, fontSize: 11.5, color: "#A6986F", fontFamily: "'Outfit', sans-serif" }}>
                {shareNote}
              </div>
              <button className="actionbtn" onClick={() => setCardUrl(null)}
                style={{ marginTop: 4, cursor: "pointer", background: "transparent", border: "none", color: "#7E7499", fontSize: 11.5, letterSpacing: 1, fontFamily: "'Outfit', sans-serif" }}>
                Close
              </button>
            </div>
          </div>
        )}

        <footer style={{ textAlign: "center", marginTop: 40, fontSize: 10.5, color: "#564E70", fontWeight: 300, letterSpacing: 0.5 }}>
          For cosmic entertainment. The stars are flattered you asked.
        </footer>
      </div>
    </div>
  );
}
