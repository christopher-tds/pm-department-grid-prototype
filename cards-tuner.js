/* TEMPORARY: card size panel for the category scroller under the "Men" header. Not part of the design.
   Dials in cards in view, height ratio, gap and label inset separately for desktop, tablet and mobile.
   Values save to localStorage and apply to this page and to the Tablet / Mobile preview frames. */
(() => {
  const KEY = "pm-dept-cards";
  const VIEWS = [["d", "Desktop", 1440], ["t", "Tablet", 820], ["m", "Mobile", 393]];
  const DEFAULTS = {
    d: { per: 3.25, ratio: 1.25, gap: 12, inset: 16 },
    t: { per: 3.5, ratio: 1.25, gap: 12, inset: 12 },
    m: { per: 2.25, ratio: 1.25, gap: 12, inset: 12 },
  };
  const CONTROLS = [
    { k: "per", label: "Cards in view", min: 1, max: 8, step: 0.25, fmt: (x) => String(x) },
    { k: "ratio", label: "Height ratio", min: 0.75, max: 1.75, step: 0.05, fmt: ratioName },
    { k: "gap", label: "Gap", min: 0, max: 32, step: 4, fmt: (x) => x + "px" },
    { k: "inset", label: "Label inset", min: 8, max: 32, step: 4, fmt: (x) => x + "px" },
  ];
  const PAD = 12; // page side padding inside the scroller

  function ratioName(r) {
    const named = { 1: "1:1", 1.25: "4:5", 1.35: "≈3:4", 1.5: "2:3", 1.75: "4:7", 0.8: "5:4" };
    const n = named[Math.round(r * 100) / 100];
    return n ? `${r.toFixed(2)} · ${n}` : r.toFixed(2);
  }

  function load() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { /* storage blocked */ }
    const values = {};
    for (const [v] of VIEWS) values[v] = { ...DEFAULTS[v], ...(saved?.values?.[v] || {}) };
    return { values, open: saved?.open === true, tab: saved?.tab || null };
  }

  const gapsInView = (per) => Math.ceil(per) - 1; // one gap after each whole card

  function apply() {
    const { values } = load();
    const root = document.documentElement.style;
    for (const [v] of VIEWS) {
      const x = values[v];
      root.setProperty(`--c${v}-per`, x.per);
      root.setProperty(`--c${v}-gaps`, gapsInView(x.per));
      root.setProperty(`--c${v}-gap`, x.gap + "px");
      root.setProperty(`--c${v}-ratio`, x.ratio);
      root.setProperty(`--c${v}-inset`, x.inset + "px");
    }
    window.PM_updateScroller?.();
  }
  window.addEventListener("storage", (e) => { if (e.key === KEY) apply(); });
  apply();

  // The panel itself lives in the top window only; the Tablet and Mobile frames just apply values.
  if (window.self !== window.top) return;
  if (new URLSearchParams(location.search).has("clean")) return;

  const state = load();
  const vpNow = () => { try { return localStorage.getItem("pm-dept-viewport") || "desktop"; } catch (e) { return "desktop"; } };
  const vpToTab = { desktop: "d", tablet: "t", mobile: "m" };
  const tabToVp = { d: "desktop", t: "tablet", m: "mobile" };
  if (!state.tab) state.tab = vpToTab[vpNow()] || "d";

  const el = document.createElement("section");
  el.className = "tuner tuner--cards";
  el.setAttribute("aria-label", "Card size panel (temporary)");
  el.innerHTML = `
    <button type="button" class="tuner__toggle" aria-expanded="false">Cards</button>
    <div class="tuner__body" hidden>
      <div class="tuner__tabs" role="group" aria-label="Viewport">
        ${VIEWS.map(([v, label]) => `<button type="button" data-tab="${v}" aria-pressed="false">${label}</button>`).join("")}
      </div>
      ${CONTROLS.map((c) => `
        <label class="tuner__row tuner__row--wide">
          <span>${c.label}</span>
          <input type="range" min="${c.min}" max="${c.max}" step="${c.step}" data-k="${c.k}">
          <output data-out="${c.k}"></output>
        </label>`).join("")}
      <p class="tuner__readout" data-readout></p>
      <div class="tuner__actions">
        <button type="button" data-act="reset">Reset</button>
        <button type="button" data-act="reset-all">Reset all</button>
        <button type="button" data-act="copy">Copy CSS</button>
      </div>
    </div>`;
  const bar = document.querySelector(".review-bar") || document.body;
  bar.append(el);
  const toggle = el.querySelector(".tuner__toggle");
  const body = el.querySelector(".tuner__body");

  function readout() {
    const [, label, w0] = VIEWS.find(([v]) => v === state.tab);
    const w = state.tab === "d" && vpNow() === "desktop" ? window.innerWidth : w0;
    const x = state.values[state.tab];
    const cw = (w - 2 * PAD - gapsInView(x.per) * x.gap) / x.per;
    return `Card ${Math.round(cw)} × ${Math.round(cw * x.ratio)}px at ${label.toLowerCase()} ${w}px`;
  }

  function sync() {
    const x = state.values[state.tab];
    el.querySelectorAll("[data-tab]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.tab === state.tab)));
    for (const c of CONTROLS) {
      el.querySelector(`[data-k="${c.k}"]`).value = x[c.k];
      el.querySelector(`[data-out="${c.k}"]`).textContent = c.fmt(x[c.k]);
    }
    el.querySelector("[data-readout]").textContent = readout();
    body.hidden = !state.open;
    toggle.setAttribute("aria-expanded", String(state.open));
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify({ values: state.values, open: state.open, tab: state.tab })); } catch (e) { /* storage blocked */ }
    apply(); // the frames pick it up through the storage event
  }

  // Only one review panel open at a time.
  function closeOthers() {
    document.querySelectorAll('.review-bar .tuner:not(.tuner--cards) .tuner__toggle[aria-expanded="true"]').forEach((b) => b.click());
  }
  document.querySelector(".review-bar")?.addEventListener("click", (e) => {
    const t = e.target.closest(".tuner:not(.tuner--cards) .tuner__toggle");
    if (t && state.open) { state.open = false; sync(); save(); }
    // Following the viewport picker: switching the preview switches the tab.
    const vp = e.target.closest("[data-vp]");
    if (vp && vpToTab[vp.dataset.vp]) { state.tab = vpToTab[vp.dataset.vp]; sync(); save(); }
  });

  toggle.addEventListener("click", () => {
    state.open = !state.open;
    if (state.open) closeOthers();
    sync();
    save();
  });
  el.addEventListener("input", (e) => {
    const k = e.target.dataset.k;
    if (!k) return;
    state.values[state.tab][k] = parseFloat(e.target.value);
    sync();
    save();
  });
  el.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) {
      state.tab = tab.dataset.tab;
      // Show the viewport being tuned.
      document.querySelector(`.vp-panel [data-vp="${tabToVp[state.tab]}"]`)?.click();
      sync();
      save();
      return;
    }
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "reset") { state.values[state.tab] = { ...DEFAULTS[state.tab] }; sync(); save(); }
    if (a === "reset-all") { for (const [v] of VIEWS) state.values[v] = { ...DEFAULTS[v] }; sync(); save(); }
    if (a === "copy") {
      const decl = (v) => {
        const x = state.values[v];
        return `--pv: ${x.per}; --gn: ${gapsInView(x.per)}; --cg: ${x.gap}px; --cr: ${x.ratio}; --ci: ${x.inset}px;`;
      };
      const css = `.cats__track { ${decl("d")} }\n@media (max-width: 989px) {\n  .cats__track { ${decl("t")} }\n}\n@media (max-width: 749px) {\n  .cats__track { ${decl("m")} }\n}`;
      navigator.clipboard?.writeText(css).then(() => {
        const b = e.target.closest("[data-act]");
        b.textContent = "Copied";
        setTimeout(() => { b.textContent = "Copy CSS"; }, 1200);
      });
    }
  });
  window.addEventListener("resize", () => { if (state.open) sync(); });

  sync();
})();
