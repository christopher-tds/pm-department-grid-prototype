/* Pedal Mafia Men's department prototype, grid riff: the category carousel from the department
   prototype over one mixed product grid from the Men's Jerseys PLP prototype (Card A2, filter and
   sort). The grid opens on a mix of every category; the carousel and the Category filter narrow it. */
(() => {
  const DATA = window.PM_DEPARTMENT || { sections: [], products: [] };
  const byId = new Map(DATA.products.map((p) => [p.id, p]));
  const SECTIONS = DATA.sections.filter((s) => s.ids.length);

  // Swatch groups (PM-9): siblings of the same style, collabs and prints grouped separately. Built
  // from the whole catalog, so a card offers every colorway, not just the ones in the grid.
  const groups = new Map();
  for (const p of DATA.products) {
    if (!groups.has(p.group)) groups.set(p.group, []);
    groups.get(p.group).push(p);
  }

  // Which categories each product belongs to (a few live in more than one collection).
  const catsOf = new Map();
  for (const s of SECTIONS) for (const id of s.ids) {
    if (!catsOf.has(id)) catsOf.set(id, new Set());
    catsOf.get(id).add(s.key);
  }
  const lineOf = (p) => (/^Pro\b/.test(p.style) ? "Pro" : /^Core\b/.test(p.style) ? "Core" : "Other");

  // ---------- The mix ----------
  // 56 products (14 rows of 4), one card per style name so the grid shows range rather than
  // colorways (a style's other colorways are on its swatches).
  // In-stock styles only, taken in each collection's merch order. Each category gets a share of the
  // 56 in line with how many styles it has, and never less than one. The categories are then
  // interleaved evenly, so the opening grid reads as a mix, not as blocks.
  const GRID_SIZE = 56;
  const MIX = (() => {
    const used = new Set();
    const usedStyles = new Set();
    const pools = SECTIONS.map((s) => {
      const out = [];
      for (const id of s.ids) {
        const p = byId.get(id);
        if (!p.available || used.has(id) || usedStyles.has(p.style)) continue;
        used.add(id);
        usedStyles.add(p.style);
        out.push(p);
      }
      return { key: s.key, pool: out };
    }).filter((x) => x.pool.length);
    const total = pools.reduce((n, x) => n + x.pool.length, 0);
    const size = Math.min(GRID_SIZE, total);
    // Largest remainder, with a floor of one per category.
    pools.forEach((x) => {
      const exact = (x.pool.length / total) * size;
      x.quota = Math.max(1, Math.floor(exact));
      x.rem = exact - Math.floor(exact);
    });
    let left = size - pools.reduce((n, x) => n + x.quota, 0);
    const byRem = [...pools].sort((a, b) => b.rem - a.rem);
    for (let i = 0; left > 0; i = (i + 1) % byRem.length) {
      if (byRem[i].quota < byRem[i].pool.length) { byRem[i].quota++; left--; }
    }
    for (let i = byRem.length - 1; left < 0; i = (i - 1 + byRem.length) % byRem.length) {
      if (byRem[i].quota > 1) { byRem[i].quota--; left++; }
    }
    // Even interleave: each pick sits at (n + 0.5) / quota along the grid; ties keep page order.
    return pools
      .flatMap((x, order) => x.pool.slice(0, x.quota).map((p, n) => ({ p, at: (n + 0.5) / x.quota, order })))
      .sort((a, b) => a.at - b.at || a.order - b.order)
      .map((x) => x.p);
  })();

  // Breakpoints (PM-3): mobile under 750, tablet 750–989, desktop 990 and up. The grid size picker
  // is hidden for now (index.html), so each size sits on its default.
  const LAYOUTS = {
    desktop: { options: [3, 4, 6, "index"], fallback: 4, index: 8 },
    tablet: { options: [2, "index"], fallback: 2, index: 6 },
    mobile: { options: [1, 2, "index"], fallback: 2, index: 3 },
  };
  // Shows the Product / On figure picker in the filter panel (tablet and mobile use it there).
  const SHOW_VIEW = true;

  const mqDesktop = matchMedia("(min-width: 990px)");
  const mqTablet = matchMedia("(min-width: 750px)");
  const emptyFilters = () => ({ cat: new Set(), line: new Set() });
  const state = {
    device: null,
    cols: null,
    view: "product",
    sort: "featured",
    filters: emptyFilters(),
    selected: new Map(), // card id -> product id currently shown
  };

  const $ = (s, el = document) => el.querySelector(s);
  const grid = $("#grid");
  const money = (n) => "$" + (Number.isInteger(n) ? n : n.toFixed(2));

  function deviceNow() {
    return mqDesktop.matches ? "desktop" : mqTablet.matches ? "tablet" : "mobile";
  }

  function srcset(src) {
    return [360, 540, 720, 900, 1200, 1600].map((w) => `${src}?width=${w} ${w}w`).join(", ");
  }

  function sizesAttr() {
    const cols = state.cols === "index" ? LAYOUTS[state.device].index : state.cols;
    return `calc((100vw - ${24 + (cols - 1) * 12}px) / ${cols})`;
  }

  // ---------- Card images ----------

  // Each card carries two shots: the one for the current view first (flat lay in Product, on figure
  // in On figure), then the other. Desktop hover brings the second shot in with the rack focus;
  // tablet and mobile swipe between them, with a thin bar under the photo showing there's more than
  // one. Products missing one of the shots keep a single image.
  function shotsFor(p) {
    const flat = { ...p.flat, flat: true };
    if (!p.figure) return [flat];
    const fig = { ...p.figure, flat: false };
    return state.view === "figure" ? [fig, flat] : [flat, fig];
  }

  function slidesHTML(p, load) {
    const shots = shotsFor(p);
    const name = `${p.style}${p.colorway ? `, ${p.colorway}` : ""}`;
    return `
            <div class="card__slides">
              ${shots.map((im, i) => `<div class="card__slide${i ? " card__slide--alt" : ""}">
                <img class="${im.flat ? "is-flat" : ""}"${i ? "" : ` data-pid="${p.id}"`} src="${im.src}?width=720" srcset="${srcset(im.src)}"
                  sizes="${sizesAttr()}" width="${im.w}" height="${im.h}" alt="${i ? "" : name}" draggable="false"
                  ${i ? 'loading="lazy"' : load} decoding="async"></div>`).join("")}
            </div>
            ${shots.length > 1 ? `<span class="card__bar" aria-hidden="true" style="--n:${shots.length}"><span class="card__bar-thumb"></span></span>` : ""}`;
  }

  // ---------- Cards ----------

  function swatchList(card) {
    const siblings = groups.get(card.group) || [card];
    // Selected colorway first (PM-9), then the rest in collection order. Order stays fixed while
    // shoppers tap through, so the dots don't jump.
    return [card, ...siblings.filter((s) => s.id !== card.id)];
  }

  function cardHTML(card, eager) {
    const p = byId.get(state.selected.get(card.id) || card.id);
    const swatches = swatchList(card);
    const shown = swatches.slice(0, 4);
    const more = swatches.length - shown.length;
    const sale = p.compare && p.available;
    const badge = !p.available
      ? `<span class="badge badge--sold-out">Sold out</span>`
      : sale ? `<span class="badge badge--sale">On sale</span>` : "";
    return `
      <article class="card${p.available ? "" : " is-sold-out"}" data-card="${card.id}">
        <a class="card__link" href="${p.url}" target="_blank" rel="noopener">
          <div class="card__media">
            ${badge}
            ${slidesHTML(p, eager ? 'fetchpriority="high"' : 'loading="lazy"')}
          </div>
          <div class="card__info">
            <div class="card__row">
              <h2 class="card__name">${p.style}</h2>
              <span class="card__price">${money(p.price)}</span>
              ${sale ? `<span class="card__compare"><span class="visually-hidden">Regular price </span>${money(p.compare)}</span>` : ""}
            </div>
            <p class="card__color"><span class="snf__layer is-rest">${p.colorway}</span><span class="snf__layer" aria-hidden="true"></span></p>
          </div>
        </a>
        ${swatches.length > 1 ? `
        <div class="swatches" role="group" aria-label="Colors for ${p.style}">
          ${shown.map((s) => `<button type="button" class="swatch${s.available ? "" : " is-sold-out"}"
              style="--c:${s.swatch}" data-swatch="${s.id}" aria-pressed="${s.id === p.id}"
              aria-label="${s.colorway}${s.available ? "" : " (sold out)"}" title="${s.colorway}"></button>`).join("")}
          ${more > 0 ? `<span class="swatch-more">+${more}</span>` : ""}
        </div>` : ""}
      </article>`;
  }

  // ---------- Filtering and sorting ----------

  const matches = (p, f, skip) =>
    (skip === "cat" || !f.cat.size || [...catsOf.get(p.id)].some((k) => f.cat.has(k))) &&
    (skip === "line" || !f.line.size || f.line.has(lineOf(p)));

  function filtered() {
    let list = MIX.filter((p) => matches(p, state.filters));
    if (state.sort !== "featured") {
      const dir = state.sort === "price-asc" ? 1 : -1;
      list = [...list].sort((a, b) => dir * (a.price - b.price));
    }
    return list;
  }

  const filtersActive = () => state.filters.cat.size + state.filters.line.size;

  function render() {
    const list = filtered();
    const cols = state.cols;
    grid.dataset.cols = String(cols);
    grid.dataset.view = state.view;
    grid.style.setProperty("--cols", cols === "index" ? LAYOUTS[state.device].index : cols);
    grid.innerHTML = list.map((p, i) => cardHTML(p, i < 8)).join("");
    observeCards(grid.querySelectorAll(".card"));

    $("#count").textContent = list.length;
    $("#empty").hidden = list.length > 0;
    const n = filtersActive();
    $("#filter-count").textContent = n ? ` (${n})` : "";
    syncCats();
    renderGridOptions();
  }

  function renderGridOptions() {
    const box = $("#grid-size");
    const opts = LAYOUTS[state.device].options;
    box.innerHTML = `<span class="toolbar__label">Grid</span>` + opts.map((o) =>
      `<button class="opt" type="button" data-cols="${o}" aria-pressed="${o === state.cols}"
        aria-label="${o === "index" ? "Index view, images only" : `${o} column${o === 1 ? "" : "s"}`}">${o === "index" ? "Index" : o}</button>`
    ).join("");
  }

  function setDevice() {
    const device = deviceNow();
    if (device === state.device) return;
    state.device = device;
    const opts = LAYOUTS[device].options;
    if (!opts.includes(state.cols)) state.cols = LAYOUTS[device].fallback;
    render();
  }

  // ---------- Category carousel ----------
  // One card per category. Tapping a card filters the grid to that category; tapping it again goes
  // back to everything. It stays in sync with the Category filter in the panel.

  // Hand-picked covers, chosen on the department prototype's covers.html (2026-11-05). Categories not
  // listed use their first on-figure shot.
  const CDN = "https://cdn.shopify.com/s/files/1/0320/7643/1499/";
  const COVERS = {
    jerseys: CDN + "files/PRO-NOMADIC-ECOM-1-15.jpg",
    bibs: CDN + "files/PEWR-1-2.jpg",
    vests: CDN + "files/CORE-LIGHT-LOOKBOOK-WR-52.jpg",
    jackets: CDN + "files/PRO-WINTER-WR-3_c5677bf4-4d83-494f-aa22-0b6f0d4f9eb1.jpg",
    socks: CDN + "files/KHxPM-WR-105.jpg",
    shirts: CDN + "files/PMxSBW-WR-39.jpg",
    gloves: CDN + "files/PRO-GLITCH-WR-1-3.jpg",
    headwear: CDN + "files/T-HAT.C-SHORT-WR-3.jpg",
    warmers: CDN + "products/CORE_ECOM_LB_WEB_REZ-74_1.jpg",
  };

  function categoryImage(s) {
    if (COVERS[s.key]) return { src: COVERS[s.key] };
    const shots = s.ids.map((id) => byId.get(id)).filter((p) => p.figure);
    const p = shots.find((x) => x.figure.h / x.figure.w >= 1.2) || shots[0];
    return p ? p.figure : byId.get(s.ids[0]).flat;
  }

  // Phosphor arrow-right, Bold, inline so it takes the text color. Bold is a designer exception to
  // C16 (Regular only), 2026-11-05.
  const ARROW = `<span class="dept-section__arrow" aria-hidden="true"><svg viewBox="0 0 256 256" width="16" height="16" fill="currentColor"><path d="M224.49,136.49l-72,72a12,12,0,0,1-17-17L187,140H40a12,12,0,0,1,0-24H187L135.51,64.48a12,12,0,0,1,17-17l72,72A12,12,0,0,1,224.49,136.49Z"/></svg></span>`;

  const track = $("#cats");
  function renderCats() {
    track.innerHTML = SECTIONS.map((s, i) => {
      const img = categoryImage(s);
      return `<li><button class="cat" type="button" data-cat="${s.key}" aria-pressed="false">
        <img src="${img.src}?width=540" srcset="${srcset(img.src)}" sizes="(min-width: 990px) 15vw, (min-width: 750px) 28vw, 44vw"
          alt="" ${i < 6 ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">
        <span class="cat__name"><span>${s.title}</span>${ARROW}</span>
      </button></li>`;
    }).join("");
  }

  function syncCats() {
    const on = state.filters.cat;
    track.classList.toggle("has-active", on.size > 0);
    track.querySelectorAll("[data-cat]").forEach((b) => b.setAttribute("aria-pressed", String(on.has(b.dataset.cat))));
    // Filters set in the panel can pick categories that are off screen in the row: bring the first
    // selected card into view.
    const first = track.querySelector('[aria-pressed="true"]');
    if (!first) return;
    const slot = first.parentElement;
    const pad = parseFloat(getComputedStyle(track).scrollPaddingLeft) || 0;
    const left = slot.offsetLeft - track.offsetLeft - pad;
    const visible = left >= track.scrollLeft - 1 && left + slot.offsetWidth <= track.scrollLeft + track.clientWidth - pad;
    if (!visible) track.scrollTo({ left, behavior: motionOff() ? "auto" : "smooth" });
  }

  track.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    const key = b.dataset.cat;
    const only = state.filters.cat.size === 1 && state.filters.cat.has(key);
    state.filters = { ...state.filters, cat: only ? new Set() : new Set([key]) };
    render();
  });

  // Scroller (C14): swipe, trackpad or arrows; never auto-advances. Arrows and the progress bar show
  // only when the row overflows.
  const arrows = $("#cats-arrows");
  const progress = $("#cats-progress");

  function updateScroller() {
    const overflow = track.scrollWidth - track.clientWidth > 1;
    arrows.hidden = progress.hidden = !overflow;
    if (!overflow) return;
    const max = track.scrollWidth - track.clientWidth;
    const share = track.clientWidth / track.scrollWidth;
    const bar = progress.firstElementChild;
    bar.style.width = share * 100 + "%";
    bar.style.transform = `translateX(${(track.scrollLeft / max) * (1 / share - 1) * 100}%)`;
    const [prev, next] = arrows.querySelectorAll("button");
    prev.disabled = track.scrollLeft <= 1;
    next.disabled = track.scrollLeft >= max - 1;
  }
  track.addEventListener("scroll", updateScroller, { passive: true });
  window.PM_updateScroller = updateScroller; // the card size panel changes widths without a resize
  new ResizeObserver(updateScroller).observe(track);
  arrows.addEventListener("click", (e) => {
    const b = e.target.closest("[data-dir]");
    if (!b) return;
    const step = track.querySelector("li").offsetWidth + parseFloat(getComputedStyle(track).columnGap);
    const page = Math.max(1, Math.floor(track.clientWidth / step) - 1) * step;
    track.scrollBy({ left: Number(b.dataset.dir) * page, behavior: reduceMotion.matches ? "auto" : "smooth" });
  });

  // ---------- Rack focus transition ----------
  // Tiles resolve from a soft blur into focus as they scroll into view, staggered across each batch
  // that arrives together (a row, the first screen on load, or a new set of results).
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const motionOff = () => reduceMotion.matches || document.documentElement.classList.contains("rack-off");

  const io = new IntersectionObserver((entries) => {
    const batch = entries.filter((e) => e.isIntersecting).map((e) => e.target)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    batch.forEach((el) => io.unobserve(el));
    if (batch.length) reveal(batch);
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.15 });

  // The carousel animates the card inside each slot, not the slot: the slot is the scroll-snap
  // target, and Chrome re-snaps the row to follow a transformed snap target.
  const TILES = ".cats__track .cat, .card";

  // Tiles already on screen play straight away; the rest play as they scroll in.
  function observeCards(els) {
    const now = [];
    els.forEach((el) => {
      if (!motionOff()) el.classList.add("rack-wait");
      const r = el.getBoundingClientRect();
      if (r.height && r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0) now.push(el);
      else io.observe(el);
    });
    if (now.length) reveal(now);
  }

  // Hold the batch until its images decode (or 700ms), so focus resolves onto photos.
  function reveal(els) {
    if (motionOff()) { els.forEach((el) => el.classList.remove("rack-wait")); return; }
    els.forEach((el, n) => el.style.setProperty("--i", Math.min(n, 11)));
    const decoded = els.flatMap((el) => [...el.querySelectorAll("img")].slice(0, 1).map((img) => img.decode().catch(() => {})));
    Promise.race([Promise.all(decoded), new Promise((r) => setTimeout(r, 700))]).then(() => {
      els.forEach((el) => {
        if (!el.isConnected) return;
        el.classList.remove("rack-wait");
        void el.offsetWidth; // restart the animation
        el.classList.add("rack");
        settle(el, "rack", "rack");
      });
    });
  }

  // Drop the animation class once it finishes. WebKit (Safari, and Chrome on iOS) can keep painting
  // the last blurred frame of a held filter animation, most often when the photo finishes loading
  // mid-animation, so the tile would stay soft. Removing the class leaves no filter to get stuck.
  // The timer is a backstop for when animationend never fires.
  function settle(el, cls, name) {
    clearTimeout(el._settle);
    const done = () => { clearTimeout(el._settle); el.removeEventListener("animationend", onEnd); el.classList.remove(cls); };
    const onEnd = (e) => { if (e.target === el && e.animationName === name) done(); };
    el.addEventListener("animationend", onEnd);
    const css = getComputedStyle(el);
    const ms = (v) => Math.max(...v.split(",").map((t) => parseFloat(t) * (t.trim().endsWith("ms") ? 1 : 1000)));
    el._settle = setTimeout(done, ms(css.animationDuration) + ms(css.animationDelay) + 200);
  }

  function rackImage(img) {
    if (motionOff()) return;
    img.classList.remove("rack-img");
    void img.offsetWidth;
    img.classList.add("rack-img");
    settle(img, "rack-img", "rack-img");
  }

  // Swap the two stacked colorway layers: the new name fades up in, the old one fades up and out.
  function fadeColorway(label, name) {
    if (!label) return;
    const layers = label.querySelectorAll(".snf__layer");
    const out = [...layers].find((l) => !l.hasAttribute("aria-hidden"));
    const next = [...layers].find((l) => l !== out);
    if (!out || !next || out.textContent === name) return;
    next.textContent = name;
    out.classList.remove("is-in", "is-rest");
    out.classList.add("is-out");
    out.setAttribute("aria-hidden", "true");
    next.classList.remove("is-out");
    next.classList.add("is-in");
    next.removeAttribute("aria-hidden");
  }

  // Replace a card's shots with another colorway's (hover previews), back on the first shot.
  function swapSlides(article, p) {
    const media = article.querySelector(".card__media");
    media.querySelectorAll(".card__slides, .card__bar").forEach((el) => el.remove());
    media.insertAdjacentHTML("beforeend", slidesHTML(p, 'loading="eager"'));
  }

  // Tablet and mobile: the bar's thumb follows the swipe. Scroll events don't bubble, so listen in
  // the capture phase for any card's strip.
  document.addEventListener("scroll", (e) => {
    const strip = e.target;
    if (!strip.classList || !strip.classList.contains("card__slides")) return;
    const max = strip.scrollWidth - strip.clientWidth;
    strip.parentElement.style.setProperty("--p", max > 0 ? Math.min(1, strip.scrollLeft / max) : 0);
  }, true);

  // Mouse drag for the strips, so the Tablet and Mobile frames can be swiped on a desktop. Touch
  // and trackpads scroll natively. A drag that moves doesn't open the product.
  let drag = null;
  let dragged = false;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const strip = e.target.closest(".card__slides");
    if (!strip || strip.scrollWidth <= strip.clientWidth + 1) return;
    e.preventDefault(); // no native image or link drag
    drag = { strip, x: e.clientX, left: strip.scrollLeft, moved: false };
  });
  window.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) < 6) return;
    if (!drag.moved) { drag.moved = true; drag.strip.classList.add("is-dragging"); }
    drag.strip.scrollLeft = drag.left - dx;
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    const { strip, left, moved } = drag;
    drag = null;
    if (!moved) return;
    dragged = true;
    setTimeout(() => { dragged = false; });
    const w = strip.clientWidth;
    const from = Math.round(left / w);
    const delta = strip.scrollLeft - left;
    const last = strip.children.length - 1;
    const to = Math.abs(delta) > w * 0.15 ? Math.max(0, Math.min(last, from + Math.sign(delta))) : from;
    strip.scrollTo({ left: to * w, behavior: motionOff() ? "auto" : "smooth" });
    const end = () => { clearTimeout(t); strip.classList.remove("is-dragging"); };
    const t = setTimeout(end, 700);
    strip.addEventListener("scrollend", end, { once: true });
  });
  document.addEventListener("click", (e) => {
    if (dragged && e.target.closest(".card__slides")) { e.preventDefault(); e.stopPropagation(); }
  }, true);

  // Show a colorway on a card's image and colorway line (used for hover previews).
  function showColorway(article, p) {
    const img = article.querySelector(".card__media img");
    if (!img || Number(img.dataset.pid) === p.id) return;
    swapSlides(article, p);
    fadeColorway(article.querySelector(".card__color"), p.colorway);
    rackImage(article.querySelector(".card__media img"));
  }

  // ---------- Toolbar ----------

  $("#grid-size").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cols]");
    if (!b) return;
    state.cols = b.dataset.cols === "index" ? "index" : Number(b.dataset.cols);
    render();
  });

  // View lives in the toolbar (desktop and tablet) and in the filter panel (all sizes); both stay in
  // sync. Both are hidden for now.
  function setView(view) {
    state.view = view;
    document.querySelectorAll("[data-view]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.view === view)));
    render();
  }
  $("#view").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b) setView(b.dataset.view);
  });

  const sortBtn = $("#sort-btn"), sortMenu = $("#sort-menu");
  const closeSort = () => { sortMenu.hidden = true; sortBtn.setAttribute("aria-expanded", "false"); };
  sortBtn.addEventListener("click", () => {
    const open = sortMenu.hidden;
    sortMenu.hidden = !open;
    sortBtn.setAttribute("aria-expanded", String(open));
    if (open) sortMenu.querySelector('[aria-checked="true"]').focus();
  });
  sortMenu.addEventListener("click", (e) => {
    const b = e.target.closest("[data-sort]");
    if (!b) return;
    state.sort = b.dataset.sort;
    sortMenu.querySelectorAll("[data-sort]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    sortBtn.textContent = b.textContent;
    closeSort();
    sortBtn.focus();
    render();
  });
  document.addEventListener("click", (e) => { if (!e.target.closest(".sort")) closeSort(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !sortMenu.hidden) { closeSort(); sortBtn.focus(); } });

  // Tapping a swatch swaps the tile to that colorway in place (locked decision).
  grid.addEventListener("click", (e) => {
    const b = e.target.closest("[data-swatch]");
    if (!b) return;
    const article = b.closest("[data-card]");
    const cardId = Number(article.dataset.card);
    const pid = Number(b.dataset.swatch);
    const previewed = Number(article.querySelector(".card__media img").dataset.pid) === pid;
    state.selected.set(cardId, pid);
    const temp = document.createElement("div");
    temp.innerHTML = cardHTML(byId.get(cardId), false);
    const next = temp.firstElementChild;
    next.querySelectorAll("img").forEach((im) => { im.loading = "eager"; });
    article.replaceWith(next);
    if (!previewed) rackImage(next.querySelector(".card__media img"));
    next.querySelector(`[data-swatch="${pid}"]`).focus();
  });

  // Hovering a swatch (mouse only) previews that colorway; leaving the swatches returns to the
  // selected one. Both use the rack focus.
  grid.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const b = e.target.closest("[data-swatch]");
    if (b) showColorway(b.closest("[data-card]"), byId.get(Number(b.dataset.swatch)));
  });
  grid.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const box = e.target.closest(".swatches");
    if (!box || box.contains(e.relatedTarget)) return;
    const article = box.closest("[data-card]");
    const id = Number(article.dataset.card);
    showColorway(article, byId.get(state.selected.get(id) || id));
  });

  // ---------- Filter drawer (Option A) ----------

  const dialog = $("#filters");
  const GROUPS = [
    { key: "cat", title: "Category", values: SECTIONS.map((s) => [s.key, s.title]) },
    { key: "line", title: "Line", values: [["Pro", "Pro"], ["Core", "Core"]] },
  ];
  let draft;

  const countFor = (key, value) => MIX.filter((p) => matches(p, draft, key) &&
    (key === "cat" ? catsOf.get(p.id).has(value) : lineOf(p) === value)).length;
  const draftCount = () => MIX.filter((p) => matches(p, draft)).length;

  const VIEWS = [["product", "Product"], ["figure", "On figure"]];

  function renderDrawer() {
    $("#filter-groups").innerHTML = (SHOW_VIEW ? `
      <div class="fgroup fgroup--view" role="group" aria-labelledby="fview-title">
        <h3 id="fview-title">View</h3>
        <div class="fview">${VIEWS.map(([v, label]) =>
          `<button class="opt" type="button" data-view="${v}" aria-pressed="${state.view === v}">${label}</button>`).join("")}</div>
      </div>` : "") + GROUPS.map((g) => `
      <fieldset class="fgroup">
        <legend class="visually-hidden">${g.title}</legend>
        <h3 aria-hidden="true">${g.title}</h3>
        ${g.values.map(([v, label]) => { const n = countFor(g.key, v); return n || draft[g.key].has(v) ? `
          <label class="fopt"><input type="checkbox" data-key="${g.key}" value="${v}" ${draft[g.key].has(v) ? "checked" : ""}>
            <span>${label}</span><span class="n">${n}</span></label>` : ""; }).join("")}
      </fieldset>`).join("");
    $("#filter-apply").textContent = `Show ${draftCount()} products`;
  }

  $("#filter-open").addEventListener("click", () => {
    draft = { cat: new Set(state.filters.cat), line: new Set(state.filters.line) };
    renderDrawer();
    dialog.showModal();
  });
  // View applies straight away (it changes images, not results), so the grid updates behind the panel.
  $("#filter-groups").addEventListener("click", (e) => {
    const b = e.target.closest("[data-view]");
    if (b) setView(b.dataset.view);
  });
  $("#filter-groups").addEventListener("change", (e) => {
    const i = e.target;
    if (i.checked) draft[i.dataset.key].add(i.value);
    else draft[i.dataset.key].delete(i.value);
    renderDrawer();
  });
  $("#filter-clear").addEventListener("click", () => {
    draft = emptyFilters();
    renderDrawer();
  });
  // Desktop plays the exit (fade left) before closing; tablet and mobile close straight away.
  function closeDrawer(value) {
    if (!dialog.open || dialog.classList.contains("is-closing")) return;
    if (!mqDesktop.matches || reduceMotion.matches) { dialog.close(value); return; }
    dialog.classList.add("is-closing");
    dialog.addEventListener("animationend", function done(e) {
      if (e.animationName !== "drawer-out") return;
      dialog.removeEventListener("animationend", done);
      dialog.classList.remove("is-closing");
      dialog.close(value);
    });
  }
  $("#filter-form").addEventListener("submit", (e) => {
    e.preventDefault();
    closeDrawer(e.submitter ? e.submitter.value : "");
  });
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); closeDrawer(""); }); // Escape
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "apply") { state.filters = draft; render(); }
  });
  dialog.addEventListener("click", (e) => { if (e.target === dialog) closeDrawer(""); });
  $("#empty-clear").addEventListener("click", () => {
    state.filters = emptyFilters();
    render();
  });

  // Temporary transition tuning (see tuner.js): saved values apply here too, including inside the
  // Tablet and Mobile frames, which hear changes through storage events.
  const RACK_KEY = "pm-dept-rack";
  function applyRack() {
    let t = null;
    try { t = JSON.parse(localStorage.getItem(RACK_KEY) || "null"); } catch (e) { /* storage blocked */ }
    const html = document.documentElement;
    // Saved tuner values only apply while the tuner is loaded (its script tag in index.html).
    if (!t || !document.querySelector('script[src="tuner.js"]')) return;
    for (const [k, v] of Object.entries(t.vars || {})) html.style.setProperty(k, v);
    html.classList.toggle("rack-off", t.enabled === false);
  }
  // Replay: back to the top, and every tile plays again as it scrolls into view.
  window.PM_replay = () => {
    window.scrollTo(0, 0);
    const tiles = document.querySelectorAll(TILES);
    tiles.forEach((el) => { io.unobserve(el); el.classList.remove("rack"); });
    track.scrollLeft = 0;
    requestAnimationFrame(() => observeCards(tiles));
  };
  window.PM_applyRack = applyRack;
  window.addEventListener("storage", (e) => { if (e.key === RACK_KEY) applyRack(); }); // the tuner triggers replays itself
  applyRack();

  renderCats();
  observeCards(track.querySelectorAll(".cat"));
  mqDesktop.addEventListener("change", setDevice);
  mqTablet.addEventListener("change", setDevice);
  setDevice();
  updateScroller();
})();
