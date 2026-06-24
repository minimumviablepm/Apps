/* The Ultimate Prime Day List — no-build frontend (vanilla JS).
   Talks to the engine API (PRD Section 10). API base is configurable:
   ?api=http://host:port  or  localStorage.PDE_API. Defaults to :8000. */

const API =
  new URLSearchParams(location.search).get("api") ||
  localStorage.getItem("PDE_API") ||
  "http://localhost:8000";

const state = {
  categories: {},
  filters: { category: "", subcategory: "", price_min: "", price_max: "", min_discount: "" },
  sort: "deal_score", // default sort = Monica's Deal Score desc (AC-8)
  page: 1,
  page_size: 24,
  loading: false,
  data: null,
  error: null,
};

const $ = (sel, root = document) => root.querySelector(sel);
const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};
const money = (n) =>
  n == null ? "—" : n.toLocaleString("en-US", { style: "currency", currency: "USD" });

const BAND_STYLE = {
  Elite: "bg-emerald-600 text-white",
  Strong: "bg-prime text-white",
  Solid: "bg-amber-400 text-ink",
};

// ---------------- data ----------------
async function loadCategories() {
  try {
    const r = await fetch(`${API}/api/categories`);
    state.categories = await r.json();
  } catch {
    state.categories = {};
  }
}

function buildQuery() {
  const p = new URLSearchParams();
  const f = state.filters;
  if (f.category) p.set("category", f.category);
  if (f.subcategory) p.set("subcategory", f.subcategory);
  if (f.price_min !== "") p.set("price_min", f.price_min);
  if (f.price_max !== "") p.set("price_max", f.price_max);
  if (f.min_discount !== "") p.set("min_discount", f.min_discount);
  p.set("sort", state.sort);
  p.set("page", state.page);
  p.set("page_size", state.page_size);
  return p.toString();
}

async function loadDeals() {
  state.loading = true;
  state.error = null;
  render();
  try {
    const r = await fetch(`${API}/api/deals?${buildQuery()}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    state.data = await r.json();
  } catch (e) {
    state.error = `Could not reach the deal engine at ${API}. Is the API running? (${e.message})`;
    state.data = null;
  } finally {
    state.loading = false;
    render();
  }
}

// ---------------- views ----------------
function header() {
  const h = el("header", "bg-ink text-white");
  h.append(
    el(
      "div",
      "max-w-6xl mx-auto px-4 py-6",
      `<h1 class="text-2xl md:text-3xl font-extrabold">
         The <span class="text-gold">Ultimate</span> <span class="text-prime">Prime Day</span> List</h1>
       <p class="text-sm text-slate-300 mt-1">
         Real discounts · genuinely good products · genuinely rare prices —
         ranked by <strong>Monica's Deal Score</strong>.</p>`
    )
  );
  return h;
}

function controls() {
  const wrap = el("section", "max-w-6xl mx-auto px-4 mt-5");
  const card = el("div", "bg-white rounded-xl shadow-sm p-4 grid gap-3 md:grid-cols-6");

  // category
  const cat = el("select", inputCls());
  cat.append(opt("", "All categories"));
  Object.keys(state.categories).forEach((c) => cat.append(opt(c, c)));
  cat.value = state.filters.category;
  cat.onchange = () => {
    state.filters.category = cat.value;
    state.filters.subcategory = "";
    state.page = 1;
    render();
    loadDeals();
  };

  // subcategory
  const sub = el("select", inputCls());
  sub.append(opt("", "All subcategories"));
  (state.categories[state.filters.category] || []).forEach((s) => sub.append(opt(s, s)));
  sub.value = state.filters.subcategory;
  sub.disabled = !state.filters.category;
  sub.onchange = () => {
    state.filters.subcategory = sub.value;
    state.page = 1;
    loadDeals();
  };

  // price min / max
  const pmin = numInput("Min $", state.filters.price_min, (v) => {
    state.filters.price_min = v;
  });
  const pmax = numInput("Max $", state.filters.price_max, (v) => {
    state.filters.price_max = v;
  });
  // min discount
  const disc = numInput("Min % off", state.filters.min_discount, (v) => {
    state.filters.min_discount = v;
  });

  // sort
  const sort = el("select", inputCls());
  [
    ["deal_score", "Sort: Deal Score"],
    ["discount", "Sort: Discount %"],
    ["price_asc", "Sort: Price ↑"],
    ["price_desc", "Sort: Price ↓"],
  ].forEach(([v, l]) => sort.append(opt(v, l)));
  sort.value = state.sort;
  sort.onchange = () => {
    state.sort = sort.value;
    state.page = 1;
    loadDeals();
  };

  card.append(cat, sub, pmin, pmax, disc, sort);

  // apply / clear row
  const row = el("div", "flex gap-2 mt-3");
  const apply = el("button", "px-4 py-2 rounded-lg bg-prime text-white font-semibold text-sm", "Apply filters");
  apply.onclick = () => {
    state.page = 1;
    loadDeals();
  };
  const clear = el("button", "px-4 py-2 rounded-lg bg-slate-200 text-slate-700 font-semibold text-sm", "Clear");
  clear.onclick = clearFilters;
  row.append(apply, clear);

  const sec = el("section", "max-w-6xl mx-auto px-4");
  sec.append(card, row);
  return sec;
}

function numInput(placeholder, value, onInput) {
  const i = el("input", inputCls());
  i.type = "number";
  i.min = "0";
  i.placeholder = placeholder;
  i.value = value;
  i.oninput = () => onInput(i.value);
  i.onkeydown = (e) => {
    if (e.key === "Enter") {
      state.page = 1;
      loadDeals();
    }
  };
  return i;
}
const inputCls = () =>
  "border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-prime/40";
const opt = (v, l) => {
  const o = el("option");
  o.value = v;
  o.textContent = l;
  return o;
};

function clearFilters() {
  state.filters = { category: "", subcategory: "", price_min: "", price_max: "", min_discount: "" };
  state.sort = "deal_score";
  state.page = 1;
  render();
  loadDeals();
}

function skeleton() {
  const grid = el("div", "grid gap-4 sm:grid-cols-2 lg:grid-cols-3");
  for (let i = 0; i < 6; i++) {
    grid.append(
      el(
        "div",
        "bg-white rounded-xl shadow-sm p-4 animate-pulse",
        `<div class="h-32 bg-slate-200 rounded mb-3"></div>
         <div class="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
         <div class="h-4 bg-slate-200 rounded w-1/2"></div>`
      )
    );
  }
  return grid;
}

function emptyState() {
  const box = el("div", "bg-white rounded-xl shadow-sm p-10 text-center");
  box.append(
    el("p", "text-lg font-semibold", "No deals match these filters"),
    el("p", "text-slate-500 text-sm mt-1", "Try widening your price range or lowering the minimum discount.")
  );
  const btn = el("button", "mt-4 px-4 py-2 rounded-lg bg-prime text-white font-semibold text-sm", "Clear filters");
  btn.onclick = clearFilters;
  box.append(btn);
  return box;
}

function stars(rating) {
  const full = Math.round(rating);
  return "★".repeat(full) + "☆".repeat(5 - full);
}

function dealCard(d) {
  const card = el("div", "bg-white rounded-xl shadow-sm hover:shadow-md transition cursor-pointer overflow-hidden");
  const band = d.score_band && BAND_STYLE[d.score_band] ? d.score_band : null;
  card.append(
    el(
      "div",
      "relative",
      `<img src="${d.image_url || ""}" alt="" class="h-40 w-full object-cover bg-slate-100"
            onerror="this.style.visibility='hidden'"/>
       <span class="absolute top-2 left-2 text-xs font-bold px-2 py-1 rounded-full ${
         band ? BAND_STYLE[band] : "bg-slate-700 text-white"
       }">Score ${Math.round(d.deal_score)}${band ? " · " + band : ""}</span>
       ${
         d.discount_pct
           ? `<span class="absolute top-2 right-2 text-xs font-bold px-2 py-1 rounded-full bg-rose-600 text-white">-${Math.round(
               d.discount_pct
             )}%</span>`
           : ""
       }`
    )
  );
  const body = el("div", "p-4");
  body.append(
    el("h3", "font-semibold text-sm leading-snug line-clamp-2", d.title),
    el(
      "div",
      "mt-2 text-sm",
      `<span class="font-bold text-base">${money(d.current_price)}</span>
       <span class="text-slate-400 line-through ml-1">${money(d.reference_price)}</span>`
    ),
    el(
      "div",
      "mt-1 text-xs text-slate-500",
      `<span class="text-amber-500">${stars(d.star_rating)}</span>
       ${d.star_rating} · ${d.review_count != null ? d.review_count.toLocaleString() : "—"} reviews
       ${d.review_count_stale ? '<span title="Review count is a snapshot">⚠︎</span>' : ""}`
    )
  );
  card.append(body);
  card.onclick = () => openDetail(d.asin);
  return card;
}

function results() {
  const sec = el("section", "max-w-6xl mx-auto px-4 mt-5 pb-16");
  if (state.loading) {
    sec.append(skeleton());
    return sec;
  }
  if (state.error) {
    sec.append(el("div", "bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-4 text-sm", state.error));
    return sec;
  }
  const data = state.data;
  if (!data || data.total === 0) {
    sec.append(emptyState());
    return sec;
  }

  sec.append(
    el(
      "div",
      "flex items-center justify-between mb-3 text-sm text-slate-600",
      `<span><strong>${data.total.toLocaleString()}</strong> curated deals</span>
       <span>Page ${data.page}</span>`
    )
  );

  const grid = el("div", "grid gap-4 sm:grid-cols-2 lg:grid-cols-3");
  data.results.forEach((d) => grid.append(dealCard(d)));
  sec.append(grid);

  // pagination
  const pages = Math.max(1, Math.ceil(data.total / data.page_size));
  if (pages > 1) {
    const nav = el("div", "flex justify-center gap-2 mt-6");
    const prev = el("button", pageBtnCls(state.page <= 1), "← Prev");
    prev.disabled = state.page <= 1;
    prev.onclick = () => {
      state.page--;
      loadDeals();
    };
    const next = el("button", pageBtnCls(state.page >= pages), "Next →");
    next.disabled = state.page >= pages;
    next.onclick = () => {
      state.page++;
      loadDeals();
    };
    nav.append(prev, el("span", "px-3 py-2 text-sm text-slate-500", `${state.page} / ${pages}`), next);
    sec.append(nav);
  }
  return sec;
}
const pageBtnCls = (disabled) =>
  `px-4 py-2 rounded-lg text-sm font-semibold ${
    disabled ? "bg-slate-200 text-slate-400" : "bg-white shadow-sm hover:shadow"
  }`;

// ---------------- detail (UC-6, FR-17/18/19) ----------------
async function openDetail(asin) {
  const overlay = el("div", "fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50");
  overlay.onclick = (e) => {
    if (e.target === overlay) overlay.remove();
  };
  const panel = el("div", "bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-auto p-6");
  panel.append(el("p", "text-sm text-slate-400", "Loading…"));
  overlay.append(panel);
  document.body.append(overlay);

  let d;
  try {
    const r = await fetch(`${API}/api/deals/${asin}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    d = await r.json();
  } catch (e) {
    panel.innerHTML = `<p class="text-rose-600">Could not load deal (${e.message}).</p>`;
    return;
  }

  const pillar = (label, val, weight, desc) => `
    <div class="mb-3">
      <div class="flex justify-between text-sm">
        <span class="font-medium">${label} <span class="text-slate-400">(${weight})</span></span>
        <span class="font-bold">${Math.round(val)}</span>
      </div>
      <div class="h-2 bg-slate-200 rounded mt-1"><div class="h-2 rounded bg-prime" style="width:${Math.max(
        0,
        Math.min(100, val)
      )}%"></div></div>
      <p class="text-xs text-slate-500 mt-1">${desc}</p>
    </div>`;

  const flags = [];
  if (d.review_count_stale) flags.push("Review count is a snapshot, not live");
  if (d.short_history) flags.push("Limited price history — exclusivity capped");
  if (d.thin_peer_set) flags.push("Thin peer set — judged on quality alone");

  panel.innerHTML = `
    <div class="flex items-start justify-between gap-3">
      <h2 class="text-lg font-bold leading-snug">${d.title}</h2>
      <button class="text-slate-400 text-2xl leading-none" id="x">&times;</button>
    </div>
    <div class="flex items-center gap-3 mt-3">
      <div class="text-3xl font-extrabold">${Math.round(d.deal_score)}</div>
      <div>
        <div class="text-xs uppercase tracking-wide text-slate-400">Monica's Deal Score</div>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full ${
          BAND_STYLE[d.score_band] || "bg-slate-200"
        }">${d.score_band || ""}</span>
      </div>
    </div>

    <div class="mt-4 text-sm">
      <span class="text-2xl font-bold">${money(d.current_price)}</span>
      <span class="text-slate-400 line-through ml-2">${money(d.reference_price)}</span>
      ${d.discount_pct ? `<span class="text-rose-600 font-bold ml-2">-${Math.round(d.discount_pct)}%</span>` : ""}
      <div class="text-xs text-slate-500 mt-1">Reference = trailing 90-day average · all-time low ${money(
        d.all_time_low
      )}</div>
    </div>

    <div class="mt-2 text-sm text-amber-500">${stars(d.star_rating)}
      <span class="text-slate-600">${d.star_rating} · ${
    d.review_count != null ? d.review_count.toLocaleString() : "—"
  } reviews</span></div>

    <hr class="my-4"/>
    <h3 class="text-sm font-semibold mb-2">Why it scored this way</h3>
    ${pillar("Deal Strength", d.pillar_deal_strength, "40%", "How deep the discount is and how close to the all-time low.")}
    ${pillar("Exclusivity", d.pillar_exclusivity, "30%", `Priced at/below this on ${
      d.days_at_or_below_price_365d ?? "—"
    } of the last 365 days.`)}
    ${pillar("Quality vs Peers", d.pillar_quality, "30%", `Bayesian rating ${
      d.bayesian_rating?.toFixed(2) ?? "—"
    }${d.peer_percentile != null ? ` · ${Math.round(d.peer_percentile)}th percentile in its peer set` : ""}.`)}

    ${
      flags.length
        ? `<div class="text-xs bg-amber-50 border border-amber-200 rounded p-2 text-amber-800 mb-3">⚠︎ ${flags.join(
            " · "
          )}</div>`
        : ""
    }

    <div class="text-xs text-slate-400 mb-3">Last checked ${new Date(
      d.last_ingested_at
    ).toLocaleString()} — price may have changed since.</div>

    <div class="grid grid-cols-2 gap-2">
      <a href="${d.affiliate_url}" target="_blank" rel="noopener"
         class="text-center px-4 py-2 rounded-lg bg-gold text-ink font-bold text-sm">View on Amazon →</a>
      <a href="${d.camel_url}" target="_blank" rel="noopener"
         class="text-center px-4 py-2 rounded-lg border border-slate-300 font-semibold text-sm">Verify price history</a>
    </div>`;
  $("#x", panel).onclick = () => overlay.remove();
}

// ---------------- render ----------------
function render() {
  const app = $("#app");
  app.innerHTML = "";
  app.append(header(), controls(), results());
}

(async function init() {
  render();
  await loadCategories();
  render();
  await loadDeals();
})();
