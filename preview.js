/* Viewport switcher for reviewing the prototype: Desktop shows the page as-is; Tablet and Mobile load the
   same page in a frame at true device size (never scaled), so the real 750 / 990 breakpoints apply. */
(() => {
  if (window.self !== window.top) return; // inside the device frame: no panel
  if (new URLSearchParams(location.search).has("clean")) return; // clean capture (share image)

  const DEVICES = {
    desktop: { label: "Desktop" },
    tablet: { label: "Tablet", w: 820, h: 1180 },
    mobile: { label: "Mobile", w: 393, h: 852 },
  };
  const KEY = "pm-dept-viewport";
  let current = "desktop";
  try { current = localStorage.getItem(KEY) || "desktop"; } catch (e) { /* storage blocked */ }
  if (!DEVICES[current]) current = "desktop";

  const panel = document.createElement("div");
  panel.className = "vp-panel";
  panel.setAttribute("role", "group");
  panel.setAttribute("aria-label", "Preview viewport");
  panel.innerHTML = Object.entries(DEVICES).map(([key, d]) =>
    `<button type="button" data-vp="${key}" aria-pressed="false" title="${d.w ? `${d.w} × ${d.h}` : "Full window"}">${d.label}</button>`
  ).join("");
  document.body.appendChild(panel);

  const stage = document.createElement("div");
  stage.className = "vp-stage";
  stage.hidden = true;
  stage.innerHTML = `<div class="vp-device"><iframe title="Prototype at device size"></iframe></div><p class="vp-size"></p>`;
  document.body.appendChild(stage);
  const frame = stage.querySelector("iframe");

  function set(key) {
    current = key;
    try { localStorage.setItem(KEY, key); } catch (e) { /* storage blocked */ }
    panel.querySelectorAll("[data-vp]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vp === key)));
    const d = DEVICES[key];
    document.documentElement.classList.toggle("vp-framed", !!d.w);
    if (!d.w) {
      stage.hidden = true;
      frame.removeAttribute("src");
      return;
    }
    stage.hidden = false;
    frame.style.width = d.w + "px";
    frame.style.height = d.h + "px";
    stage.querySelector(".vp-size").textContent = `${d.label} · ${d.w} × ${d.h}`;
    place();
    const src = location.pathname + "?embed=1";
    if (!frame.src.endsWith(src)) frame.src = src;
  }

  // Center on whole pixels: a half-pixel offset (e.g. a 393px frame in a 1440px window) lets a 1px
  // sliver of the canvas show at the frame's edges.
  function place() {
    const d = DEVICES[current];
    if (!d.w) return;
    const left = Math.max(0, Math.floor((stage.clientWidth - 48 - d.w) / 2)) + "px";
    stage.querySelector(".vp-device").style.marginLeft = left;
    stage.querySelector(".vp-size").style.marginLeft = left;
  }
  window.addEventListener("resize", place);

  panel.addEventListener("click", (e) => {
    const b = e.target.closest("[data-vp]");
    if (b) set(b.dataset.vp);
  });
  set(current);
})();
