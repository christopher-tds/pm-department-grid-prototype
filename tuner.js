/* TEMPORARY: transition tuner for reviewing the rack focus + fade up. Not part of the design.
   Values save to localStorage, apply to this page and to the Tablet / Mobile preview frames. */
(() => {
  if (window.self !== window.top) return; // the frames pick up changes from storage events
  if (new URLSearchParams(location.search).has("clean")) return; // clean capture (share image)

  const KEY = "pm-dept-rack";
  const CONTROLS = [
    { v: "--rack-dur", label: "Duration", min: 200, max: 2500, step: 50, unit: "ms", value: 1200 },
    { v: "--rack-stagger", label: "Stagger", min: 0, max: 250, step: 10, unit: "ms", value: 120 },
    { v: "--rack-blur", label: "Blur", min: 0, max: 40, step: 1, unit: "px", value: 10 },
    { v: "--rack-rise", label: "Rise", min: 0, max: 80, step: 2, unit: "px", value: 24 },
    { v: "--rack-scale", label: "Scale", min: 1, max: 1.1, step: 0.005, unit: "", value: 1 },
    { v: "--rack-fade", label: "Fade length", min: 0.1, max: 1, step: 0.05, unit: "", value: 0.4, fmt: (x) => Math.round(x * 100) + "%" },
    { v: "--rack-img-dur", label: "Hover swap", min: 150, max: 1500, step: 50, unit: "ms", value: 700 },
  ];
  const EASES = [
    ["Soft out", "cubic-bezier(0.25, 0.6, 0.3, 1)"],
    ["Expo out", "cubic-bezier(0.16, 1, 0.3, 1)"],
    ["Standard", "cubic-bezier(0.4, 0, 0.2, 1)"],
    ["Ease out", "ease-out"],
    ["Linear", "linear"],
  ];

  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { /* storage blocked */ }
  const state = { enabled: saved?.enabled !== false, open: saved?.open === true, values: {}, ease: saved?.vars?.["--rack-ease"] || EASES[0][1] };
  for (const c of CONTROLS) {
    const raw = saved?.vars?.[c.v];
    state.values[c.v] = raw !== undefined ? parseFloat(raw) : c.value;
  }

  const el = document.createElement("section");
  el.className = "tuner";
  el.setAttribute("aria-label", "Transition tuner (temporary)");
  el.innerHTML = `
    <button type="button" class="tuner__toggle" aria-expanded="false">Transitions</button>
    <div class="tuner__body" hidden>
      <label class="tuner__row tuner__row--switch"><span>Enabled</span><input type="checkbox" data-enabled></label>
      ${CONTROLS.map((c) => `
        <label class="tuner__row">
          <span>${c.label}</span>
          <input type="range" min="${c.min}" max="${c.max}" step="${c.step}" data-var="${c.v}">
          <output data-out="${c.v}"></output>
        </label>`).join("")}
      <label class="tuner__row"><span>Easing</span>
        <select data-ease>${EASES.map(([n, v]) => `<option value="${v}">${n}</option>`).join("")}</select></label>
      <div class="tuner__actions">
        <button type="button" data-act="replay">Replay</button>
        <button type="button" data-act="reset">Reset</button>
        <button type="button" data-act="copy">Copy CSS</button>
      </div>
    </div>`;
  // Sits in the top-right review bar, just right of the viewport picker (preview.js runs first).
  const bar = document.createElement("div");
  bar.className = "review-bar";
  const vp = document.querySelector(".vp-panel");
  if (vp) bar.append(vp);
  bar.append(el);
  document.body.appendChild(bar);

  const body = el.querySelector(".tuner__body");
  const toggle = el.querySelector(".tuner__toggle");

  function vars() {
    const out = { "--rack-ease": state.ease };
    for (const c of CONTROLS) out[c.v] = state.values[c.v] + c.unit;
    return out;
  }

  function sync() {
    el.querySelector("[data-enabled]").checked = state.enabled;
    el.querySelector("[data-ease]").value = state.ease;
    for (const c of CONTROLS) {
      el.querySelector(`[data-var="${c.v}"]`).value = state.values[c.v];
      el.querySelector(`[data-out="${c.v}"]`).textContent = c.fmt ? c.fmt(state.values[c.v]) : state.values[c.v] + c.unit;
    }
    body.hidden = !state.open;
    toggle.setAttribute("aria-expanded", String(state.open));
  }

  function save(replay) {
    try { localStorage.setItem(KEY, JSON.stringify({ enabled: state.enabled, open: state.open, vars: vars() })); } catch (e) { /* storage blocked */ }
    if (window.PM_applyRack) window.PM_applyRack();
    if (replay) {
      window.PM_replay && window.PM_replay();
      const frame = document.querySelector(".vp-stage:not([hidden]) iframe");
      frame?.contentWindow?.PM_applyRack?.();
      frame?.contentWindow?.PM_replay?.();
    }
  }

  let t;
  el.addEventListener("input", (e) => {
    const i = e.target;
    if (i.dataset.var) state.values[i.dataset.var] = parseFloat(i.value);
    if (i.dataset.ease !== undefined) state.ease = i.value;
    if (i.dataset.enabled !== undefined) state.enabled = i.checked;
    sync();
    clearTimeout(t);
    t = setTimeout(() => save(true), 250); // replay once the slider settles
  });
  toggle.addEventListener("click", () => { state.open = !state.open; sync(); save(false); });
  el.addEventListener("click", (e) => {
    const a = e.target.closest("[data-act]")?.dataset.act;
    if (a === "replay") save(true);
    if (a === "reset") {
      for (const c of CONTROLS) state.values[c.v] = c.value;
      state.ease = EASES[0][1];
      state.enabled = true;
      sync();
      save(true);
    }
    if (a === "copy") {
      const css = ":root {\n" + Object.entries(vars()).map(([k, v]) => `  ${k}: ${v};`).join("\n") + "\n}";
      navigator.clipboard?.writeText(css).then(() => {
        const b = e.target.closest("[data-act]");
        b.textContent = "Copied";
        setTimeout(() => { b.textContent = "Copy CSS"; }, 1200);
      });
    }
  });

  sync();
})();
