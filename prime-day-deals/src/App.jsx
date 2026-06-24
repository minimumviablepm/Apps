import React, { useState, useMemo, useEffect, useRef } from "react";

// ---------- Prime Day date ----------
// Prime Day 2026 isn't officially announced yet; Amazon has run it in July for
// years, so we target Jul 8, 2026 and let the user override it.
const DEFAULT_PRIME_DAY = "2026-07-08";
const STORE_KEY = "prime-day-deals.v1";

const COLORS = {
  navy: "#0f1111",
  ink: "#131921",
  prime: "#00a8e1",
  gold: "#febd69",
  green: "#067d62",
  red: "#cc0c39",
};

// ---------- persistence ----------
function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
function saveState(state) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  } catch {
    /* ignore quota / private-mode errors */
  }
}

// ---------- helpers ----------
const fmt = (n) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

function diffParts(target, now) {
  let ms = Math.max(0, target - now);
  const day = 86400000, hr = 3600000, min = 60000, sec = 1000;
  const days = Math.floor(ms / day); ms -= days * day;
  const hours = Math.floor(ms / hr); ms -= hours * hr;
  const minutes = Math.floor(ms / min); ms -= minutes * min;
  const seconds = Math.floor(ms / sec);
  return { days, hours, minutes, seconds };
}

let idSeed = Date.now();
const nextId = () => `${idSeed++}`;

// ---------- countdown ----------
function Countdown({ targetDate }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const target = useMemo(() => {
    const d = new Date(`${targetDate}T00:00:00`);
    return isNaN(d.getTime()) ? null : d.getTime();
  }, [targetDate]);

  if (!target) return <p style={{ color: COLORS.red }}>Pick a valid date.</p>;

  const live = target - now > 0;
  const { days, hours, minutes, seconds } = diffParts(target, now);
  const cells = [
    ["Days", days],
    ["Hours", hours],
    ["Min", minutes],
    ["Sec", seconds],
  ];

  return (
    <div style={{ textAlign: "center" }}>
      {live ? (
        <div style={{ display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {cells.map(([label, val]) => (
            <div
              key={label}
              style={{
                background: COLORS.ink,
                color: "#fff",
                borderRadius: 12,
                padding: "14px 18px",
                minWidth: 72,
                boxShadow: "0 6px 18px rgba(0,0,0,.25)",
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
                {String(val).padStart(2, "0")}
              </div>
              <div style={{ fontSize: 12, letterSpacing: 1, opacity: 0.7, textTransform: "uppercase" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: COLORS.green,
            color: "#fff",
            borderRadius: 12,
            padding: "18px 22px",
            fontSize: 22,
            fontWeight: 800,
          }}
        >
          🎉 Prime Day is here — go get your deals!
        </div>
      )}
    </div>
  );
}

// ---------- deal row ----------
function DealRow({ deal, onToggle, onRemove }) {
  const savings = Math.max(0, (deal.listPrice || 0) - (deal.targetPrice || 0));
  const pct =
    deal.listPrice > 0 ? Math.round((savings / deal.listPrice) * 100) : 0;
  return (
    <li
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 14px",
        border: "1px solid #e3e6e6",
        borderRadius: 10,
        background: deal.bought ? "#f0faf6" : "#fff",
        marginBottom: 8,
      }}
    >
      <input
        type="checkbox"
        checked={deal.bought}
        onChange={() => onToggle(deal.id)}
        title="Mark as snagged"
        style={{ width: 20, height: 20, accentColor: COLORS.green, cursor: "pointer" }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            textDecoration: deal.bought ? "line-through" : "none",
            color: deal.bought ? "#6b7280" : COLORS.navy,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {deal.name}
        </div>
        <div style={{ fontSize: 13, color: "#565959" }}>
          {fmt(deal.targetPrice)}{" "}
          {deal.listPrice > deal.targetPrice && (
            <>
              <span style={{ textDecoration: "line-through" }}>{fmt(deal.listPrice)}</span>{" "}
              <span style={{ color: COLORS.red, fontWeight: 700 }}>-{pct}%</span>
            </>
          )}
        </div>
      </div>
      {savings > 0 && (
        <div style={{ color: COLORS.green, fontWeight: 700, whiteSpace: "nowrap" }}>
          save {fmt(savings)}
        </div>
      )}
      <button
        onClick={() => onRemove(deal.id)}
        title="Remove"
        style={{
          border: "none",
          background: "transparent",
          color: "#9aa0a6",
          fontSize: 20,
          cursor: "pointer",
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </li>
  );
}

// ---------- main app ----------
export default function PrimeDayDeals() {
  const persisted = useRef(loadState());
  const [targetDate, setTargetDate] = useState(
    () => persisted.current?.targetDate || DEFAULT_PRIME_DAY
  );
  const [deals, setDeals] = useState(() => persisted.current?.deals || []);
  const [name, setName] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [targetPrice, setTargetPrice] = useState("");

  useEffect(() => {
    saveState({ targetDate, deals });
  }, [targetDate, deals]);

  const addDeal = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const list = parseFloat(listPrice) || 0;
    const target = parseFloat(targetPrice) || 0;
    setDeals((d) => [
      { id: nextId(), name: trimmed, listPrice: list, targetPrice: target, bought: false },
      ...d,
    ]);
    setName(""); setListPrice(""); setTargetPrice("");
  };

  const toggle = (id) =>
    setDeals((d) => d.map((x) => (x.id === id ? { ...x, bought: !x.bought } : x)));
  const remove = (id) => setDeals((d) => d.filter((x) => x.id !== id));

  const totals = useMemo(() => {
    let potential = 0, locked = 0;
    for (const d of deals) {
      const s = Math.max(0, (d.listPrice || 0) - (d.targetPrice || 0));
      potential += s;
      if (d.bought) locked += s;
    }
    return { potential, locked, count: deals.length, bought: deals.filter((d) => d.bought).length };
  }, [deals]);

  const inputStyle = {
    padding: "10px 12px",
    border: "1px solid #d5d9d9",
    borderRadius: 8,
    fontSize: 15,
    outline: "none",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#eaeded",
        fontFamily: "'Amazon Ember', system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        color: COLORS.navy,
      }}
    >
      {/* header */}
      <header style={{ background: COLORS.ink, color: "#fff", padding: "20px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>
            <span style={{ color: COLORS.gold }}>prime</span>
            <span style={{ color: COLORS.prime }}> day</span> deals
          </h1>
          <p style={{ margin: "4px 0 0", opacity: 0.75, fontSize: 14 }}>
            Count down to the big day and track the deals you actually want.
          </p>
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px 60px" }}>
        {/* countdown card */}
        <section
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: 22,
            marginBottom: 18,
            boxShadow: "0 1px 4px rgba(0,0,0,.08)",
          }}
        >
          <Countdown targetDate={targetDate} />
          <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#565959" }}>
            <label>
              Prime Day date:{" "}
              <input
                type="date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={{ ...inputStyle, padding: "6px 8px", fontSize: 13 }}
              />
            </label>
          </div>
        </section>

        {/* savings summary */}
        <section
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 18,
            flexWrap: "wrap",
          }}
        >
          {[
            ["Watching", `${totals.count}`, COLORS.ink],
            ["Snagged", `${totals.bought}`, COLORS.green],
            ["Potential savings", fmt(totals.potential), COLORS.prime],
            ["Locked-in savings", fmt(totals.locked), COLORS.green],
          ].map(([label, val, color]) => (
            <div
              key={label}
              style={{
                flex: "1 1 140px",
                background: "#fff",
                borderRadius: 12,
                padding: "14px 16px",
                boxShadow: "0 1px 4px rgba(0,0,0,.08)",
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 800, color }}>{val}</div>
              <div style={{ fontSize: 12, color: "#565959", textTransform: "uppercase", letterSpacing: 0.5 }}>
                {label}
              </div>
            </div>
          ))}
        </section>

        {/* add deal */}
        <section
          style={{
            background: "#fff",
            borderRadius: 14,
            padding: 18,
            marginBottom: 18,
            boxShadow: "0 1px 4px rgba(0,0,0,.08)",
          }}
        >
          <form onSubmit={addDeal} style={{ display: "grid", gap: 10 }}>
            <input
              placeholder="What do you want? (e.g. Echo Dot)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={inputStyle}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <input
                placeholder="List price"
                inputMode="decimal"
                value={listPrice}
                onChange={(e) => setListPrice(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
              <input
                placeholder="Target price"
                inputMode="decimal"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                style={{ ...inputStyle, flex: 1 }}
              />
            </div>
            <button
              type="submit"
              style={{
                background: COLORS.gold,
                border: "1px solid #f0a93a",
                borderRadius: 8,
                padding: "11px 16px",
                fontSize: 15,
                fontWeight: 700,
                cursor: "pointer",
                color: COLORS.navy,
              }}
            >
              + Add to watchlist
            </button>
          </form>
        </section>

        {/* list */}
        <section>
          {deals.length === 0 ? (
            <p style={{ textAlign: "center", color: "#565959", padding: "24px 0" }}>
              Nothing on your watchlist yet. Add the things you're hoping go on sale. 🛒
            </p>
          ) : (
            <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {deals.map((d) => (
                <DealRow key={d.id} deal={d} onToggle={toggle} onRemove={remove} />
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
