# My Europe Trip Map

A little princess-themed website that shows a map of Europe with the countries our daughter has visited coloured in rainbow shades. Tap a sparkly country to see a crown pop up.

## What's in here

All the site files live in [`docs/`](./docs) so the project can be served straight from GitHub Pages.

```
docs/
├── index.html       Page structure, castle, title, sparkles
├── style.css        Rainbow sky, princess theme, animations
├── app.js           Loads the map and paints visited countries
├── countries.json   The editable list of visited countries
└── castle.png       Castle image shown in the bottom-left corner
```

## How it works

When the page opens, `app.js` does three things:

1. Fetches `countries.json` from the same folder to get the list of visited countries.
2. Fetches the world country shapes (a small TopoJSON file from the [world-atlas](https://github.com/topojson/world-atlas) package) from the jsDelivr CDN.
3. Renders Europe with d3-geo using a Mercator projection centred around lat 50, lon 10. Visited countries get a rainbow colour assigned from a fixed palette and become clickable. Unvisited countries stay cream-coloured.

Tapping a visited country pops a crown above it with the country name (and an optional kid-friendly note). The page also has falling sparkles and a count line ("I visited X countries!") that updates automatically from the JSON.

Because the map data is fetched at runtime, an internet connection is needed on first load.

## How to test it

The browser blocks `fetch("./countries.json")` when you open `index.html` directly via `file://`, so you need a tiny local web server.

### Option 1, Python (recommended, no install needed)

```bash
cd docs
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

### Option 2, Node

```bash
cd docs
npx serve .
```

### Option 3, GitHub Pages

Push the repo to GitHub, enable Pages from the repository settings, and point it at the `/docs` folder on the `main` branch. The site will be live at `https://<username>.github.io/<repo>/`.

If you double-click `index.html` instead of using a server, the map still loads with a built-in fallback list of countries, but custom notes from `countries.json` won't appear.

## How to add a country

Open [`docs/countries.json`](./docs/countries.json) and add an entry to the `visited` array:

```json
{
  "visited": [
    { "name": "Spain",   "notes": "Yummy churros and sunny beaches!" },
    { "name": "Iceland", "notes": "Wow, hot springs and volcanoes!" }
  ]
}
```

Each entry needs a `name`. The optional `notes` field shows up in the crown popup.

The `name` has to match what Natural Earth uses on the map. Common ones include:

- `Czechia` (alias: `Czech Republic`)
- `United Kingdom` (alias: `UK`, `Great Britain`)
- `Bosnia and Herz.` (alias: `Bosnia`, `Bosnia and Herzegovina`)
- `North Macedonia` (alias: `Macedonia`)

If a name doesn't match, the map shows a friendly warning at the top telling you which one wasn't found, so you can fix the spelling. New aliases can be added in `NAME_ALIASES` near the top of `app.js`.

Country colours come from a fixed rainbow palette and are assigned in the order countries appear in `countries.json`, so reordering the list shuffles the colours.

## Customising

A few quick knobs:

- **Theme colours** are CSS variables at the top of `style.css` (`--pink`, `--orange`, etc.). Tweak there and they cascade through the page.
- **Map centre and zoom** live in `buildMap()` in `app.js`, in the `d3.geoMercator()` call.
- **Castle image** is `docs/castle.png`. Replace the file to swap the picture.
- **Sparkle emojis** are in the `SPARKLES` array in `app.js`.

## Credits

- Map shapes: [world-atlas](https://github.com/topojson/world-atlas) (Natural Earth, public domain)
- Map rendering: [d3-geo](https://github.com/d3/d3-geo) and [topojson-client](https://github.com/topojson/topojson-client)
