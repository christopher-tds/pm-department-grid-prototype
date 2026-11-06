# Pedal Mafia Men's department grid prototype

A riff on the Men's department prototype (`pm-department-prototype`). It keeps the category carousel
but swaps the per-category sections for one mixed product grid, with the toolbar, filter panel and
card from the Men's Jerseys PLP prototype (`pm-plp-prototype`). The demo is that you start on "all"
and can narrow it down to what you're after. Built on the live US catalog.

Live at https://christopher-tds.github.io/pm-department-grid-prototype/ (GitHub Pages from `main`).

## What it does

- **Header:** "Men" with the number of products in the grid, then the category carousel: one card
  per category (4:5, on-figure photo, name bottom left). 3.25 cards show on desktop, 3.5 on tablet
  and 2.25 on mobile. Arrows (desktop) and a progress bar appear only when the row overflows (C14).
- **The carousel filters the grid.** Tapping a category card shows just that category, and the other
  cards darken. Tapping it again goes back to everything. It stays in sync with the Category filter
  in the panel. When the panel selects a category that's off screen, the row scrolls to it.
- **The grid opens on a mix of 56 products** (14 rows of 4): one per style name, in stock only, taken
  in each collection's merch order. Each of the 12 categories gets a share in line with how many
  styles it has, never less than one, and the categories are interleaved so the grid reads as a mix.
  `GRID_SIZE` in `app.js` sets the cap.
- **Toolbar:** same as the PLP prototype. Filter, grid size (3, 4, 6 or Index), Product / On figure
  and Sort on desktop. Tablet and mobile show Filter and Sort, and the view picker moves into the
  filter panel.
- **Filter panel:** View (tablet and mobile), Category (12) and Line (Pro, Core), with counts and a live "Show N products"
  button. A side panel on desktop, a bottom sheet on tablet and mobile.
- **Sort:** Featured (the mix order), price low to high, price high to low.
- **Cards:** same as the PLP prototype. Tapping a swatch swaps the tile in place; hovering previews
  the colorway. Desktop hover brings in the second shot; tablet and mobile swipe between the two,
  with a 1px bar right under the photo.
- **Rack focus + fade up:** tiles resolve into focus as they scroll in, and again for each new set of
  results. Off with reduced motion.
- **Review tools:** viewport switcher (Desktop / Tablet 820 × 1180 / Mobile 393 × 852), the
  transitions tuner and the temporary **Cards** panel for the carousel card sizes. `?clean=1` hides
  them.

## Run locally

```bash
python3 serve.py 5193
```

Then open http://localhost:5193. The server live-reloads on file changes.

## Refresh the product data

```bash
python3 tools/build_data.py
```

It fetches each category collection's `products.json` and writes `data.js`. The mix is worked out in
the browser from that data, so a refresh updates it too. Needs Pillow (`pip install pillow`).

## Notes

- Inter stands in for ABC Whyte, the brand font, which is licensed and not bundled here.
- Product images load from Shopify's CDN; nothing is copied into the repo.
- Some products live in two collections (a cap in both Headwear and Cycling caps), so the category
  counts add up to a little more than 56.
- The share image (`assets/og-image.jpg`, 1200 × 630) is a capture of the page top with `?clean=1`.
