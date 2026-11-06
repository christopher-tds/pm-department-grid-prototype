"""Build data.js for the PM Men's department prototype from the live US store.

Usage: python3 tools/build_data.py
Fetches each category collection's public products.json, keeps men's and unisex products, and
writes data.js next to index.html. Re-run to refresh prices, stock and images.
"""
import io
import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
STORE = "https://usa.pedalmafia.cc"

# Section order and copy follow Figma "C3 · Desktop · category sections" (261:8208). Each section is
# the live collection the men's page links to; the grid shows that collection's first products in
# its own merch order, sold out last (PM-12).
SECTIONS = [
    ("jerseys", "Jerseys", "jerseys",
     "Pro Race and Delta for race day, Core and Core Racing for every day, Nomadic for the long way round."),
    ("bibs", "Bibs", "male-bibs",
     "Pro, Race and Delta for the big days, Core and Core Cargo for every day, Sub 0 tights for winter."),
    ("base-layers", "Base layers", "male-baselayers",
     "Pro Merino in short and long sleeve, warm on the climb and dry on the descent."),
    ("vests", "Vests", "male-vests",
     "Core Light for the descent, Core Insulated for the cold start, Pro Sympatex for the rain."),
    ("jackets", "Jackets", "male-jackets",
     "Pro Sub 0 and Midweight for the cold, Core Light and Pro Sympatex for the wind and rain."),
    ("socks", "Socks", "socks",
     "Flight, Core and Pro Race Aero, in solids and collabs from Williams to Kenny Scharf."),
    ("shirts", "Shirts and sweatshirts", "shirts",
     "Hoods, tees and cotton shirts for the café stop, the drive home and the days off."),
    ("shorts", "Shorts", "shorts",
     "Sunday, Gym and Core shorts for everything that isn't the ride."),
    ("headwear", "Headwear", "hats",
     "Cotton Twill and Pro Technical hats, plus baseball caps for the paddock and the café."),
    ("warmers", "Warmers", "warmers",
     "Arm, knee and leg warmers, plus Sub 0 neck warmers and overshoes for the bits that freeze first."),
    ("gloves", "Gloves", "gloves",
     "Pro Race and Aero for speed, Core for every day, Sub 0 and Mid Winter for the cold."),
    ("cycling-caps", "Cycling caps", "cycling-caps",
     "Pro Woven, Pro Technical and classic cotton caps, under the helmet or on their own."),
]

# Collab and print colorways get their own swatch group, separate from solids (PM-9).
COLLABS = ["Jean-Michel Basquiat", "PAC-MAN", "MotoGP", "Williams", "ROADNATS", "Oracle Red Bull Racing",
           "Keith Haring", "Kenny Scharf", "Lawrence Naesen", "Glitch Flow", "Wiggins", "Dusk",
           "Caleb Ewan"]

UA = {"User-Agent": "Mozilla/5.0 (PM department prototype build)"}


def fetch_json(url):
    req = urllib.request.Request(url, headers=UA)
    return json.load(urllib.request.urlopen(req, timeout=30))


def fetch_collection(handle):
    out, page = [], 1
    while True:
        batch = fetch_json(f"{STORE}/collections/{handle}/products.json?limit=250&page={page}")["products"]
        out += batch
        if len(batch) < 250:
            return out
        page += 1


def fetch_img(url, width=160):
    req = urllib.request.Request(url.split("?")[0] + f"?width={width}", headers=UA)
    return Image.open(io.BytesIO(urllib.request.urlopen(req, timeout=30).read())).convert("RGB")


def corners(im):
    w, h = im.size
    return [im.getpixel((2, 2)), im.getpixel((w - 3, 2)), im.getpixel((2, h - 3)), im.getpixel((w - 3, h - 3))]


def is_white(im):
    return min(min(c) for c in corners(im)) >= 235


def is_studio(im):
    # Studio backdrops: low-saturation corners that are close to each other.
    cs = corners(im)
    sat = max(max(c) - min(c) for c in cs)
    spread = max(max(abs(a[i] - b[i]) for i in range(3)) for a in cs for b in cs)
    return sat < 28 and spread < 40


def garment_hex(im):
    w, h = im.size
    px = [im.getpixel((x, y)) for x in range(int(w * .3), int(w * .7), 3) for y in range(int(h * .3), int(h * .7), 3)]
    px = [p for p in px if min(p) < 235] or [(240, 240, 240)]
    px.sort(key=sum)
    return "#%02X%02X%02X" % px[len(px) // 2]


def classify(p):
    """Return (flat image, on-figure image or None, swatch hex)."""
    flat = figure = None
    hexv = None
    studio = lifestyle = None
    for im in p["images"][:8]:
        try:
            small = fetch_img(im["src"])
        except Exception:
            continue
        rec = {"src": im["src"].split("?")[0], "w": im["width"], "h": im["height"]}
        if is_white(small):
            if flat is None:
                flat, hexv = rec, garment_hex(small)
        elif studio is None and is_studio(small) and im["height"] >= im["width"]:
            studio = rec
        elif lifestyle is None and im["height"] >= im["width"]:
            lifestyle = rec
    figure = studio or lifestyle
    if flat is None and p["images"]:
        im = p["images"][0]
        flat = {"src": im["src"].split("?")[0], "w": im["width"], "h": im["height"]}
    return flat, figure, hexv or "#BBBDC0"


def split_title(title):
    t = re.sub(r"\s+", " ", title.strip())
    t = re.sub(r"^(Men's|Mens|Unisex)\s+", "", t)
    m = re.match(r"(.*?)\s+-\s+(.*)$", t)
    return (m.group(1).strip(), m.group(2).strip()) if m else (t, "")


def group_key(style, colorway):
    for c in COLLABS:
        if colorway.lower().startswith(c.lower()) or c.lower() in colorway.lower():
            return f"{style} · {c}"
    return style


def is_mens(p):
    tags = p["tags"]
    if p["title"].strip().lower().startswith("women"):
        return False
    genders = {t for t in tags if t.startswith("Gender: ")}
    return not genders or bool(genders & {"Gender: Men", "Gender: Unisex"})


def main():
    with ThreadPoolExecutor(max_workers=6) as ex:
        raw = list(ex.map(lambda s: fetch_collection(s[2]), SECTIONS))

    products, sections = {}, []
    for (key, title, handle, line), items in zip(SECTIONS, raw):
        # Bundles have their own category (the Bundles link), so they stay out of the garment sections.
        keep = [p for p in items if p["images"] and is_mens(p) and "bundle" not in p["title"].lower()]
        for p in keep:
            products.setdefault(p["id"], p)
        avail = {p["id"]: any(v["available"] for v in p["variants"]) for p in keep}
        ids = [p["id"] for p in keep]
        ids.sort(key=lambda i: not avail[i])  # stable: keeps merch order, sold out last
        prices = [float(v["price"]) for p in keep for v in p["variants"]]
        sections.append({
            "key": key, "title": title, "line": line,
            "url": f"{STORE}/collections/{handle}",
            "count": len(ids), "from": min(prices) if prices else None,
            "ids": ids,
        })

    plist = list(products.values())
    with ThreadPoolExecutor(max_workers=12) as ex:
        imgs = dict(zip([p["id"] for p in plist], ex.map(classify, plist)))

    out = {}
    for p in plist:
        flat, figure, hexv = imgs[p["id"]]
        style, colorway = split_title(p["title"])
        v = p["variants"]
        price = min(float(x["price"]) for x in v)
        cmp_ = max((float(x["compare_at_price"] or 0) for x in v), default=0)
        out[p["id"]] = {
            "id": p["id"],
            "url": f"{STORE}/products/{p['handle']}",
            "style": style,
            "colorway": colorway,
            "price": price,
            "compare": cmp_ if cmp_ > price else None,
            "available": any(x["available"] for x in v),
            "group": group_key(style, colorway),
            "swatch": hexv,
            "flat": flat,
            "figure": figure,
        }

    mens = fetch_collection("mens")
    js = "// Generated by tools/build_data.py from " + STORE + " category collections. Do not edit by hand.\n"
    js += "window.PM_DEPARTMENT = " + json.dumps({
        "title": "Men", "count": len(mens), "sections": sections, "products": list(out.values()),
    }, indent=1, ensure_ascii=False) + ";\n"
    (ROOT / "data.js").write_text(js)
    for s in sections:
        print(f"{s['title']}: {s['count']} products from ${s['from']}")
    print(f"{len(out)} unique products · {sum(1 for x in out.values() if x['figure'])} with on-figure · men's collection {len(mens)}")


if __name__ == "__main__":
    main()
