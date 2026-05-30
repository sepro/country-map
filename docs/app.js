// My Europe Trip Map
//
// Pulls country shapes from the world-atlas TopoJSON via a CDN, then colors
// the countries listed in countries.json with rainbow shades. Tapping a
// visited country pops a little crown above it. A "My Trips" button opens
// a modal listing every visit, with sort controls.

const RAINBOW = [
  "#ff5fa2", "#ff7a3c", "#ffd23f", "#5fd068",
  "#5ec8ff", "#7a6cff", "#c46cff", "#ff7eb9",
];

const NAME_ALIASES = {
  "Netherlands": ["Netherlands", "Holland"],
  "Czechia": ["Czechia", "Czech Republic"],
  "United Kingdom": ["United Kingdom", "UK", "Great Britain"],
  "Bosnia and Herzegovina": ["Bosnia and Herzegovina", "Bosnia", "Bosnia and Herz."],
  "North Macedonia": ["North Macedonia", "Macedonia"],
};

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// Sort state for the visits modal. Default is country A-Z because that view
// is compact (one block per country with visits listed inside).
let visitData = [];
let sortField = "country";   // "date" | "country"
let sortDir   = "asc";       // "asc"  | "desc"

function normalizeName(name) { return name.trim().toLowerCase(); }

function namesMatch(featureName, wanted) {
  const f = normalizeName(featureName);
  const w = normalizeName(wanted);
  if (f === w) return true;
  for (const [canon, aliases] of Object.entries(NAME_ALIASES)) {
    const set = new Set(aliases.map(normalizeName).concat([normalizeName(canon)]));
    if (set.has(f) && set.has(w)) return true;
  }
  return false;
}

function formatYearMonth(ym) {
  const m = /^(\d{4})-(\d{1,2})$/.exec(String(ym).trim());
  if (!m) return ym;
  const month = MONTH_NAMES[parseInt(m[2], 10) - 1];
  return month ? `${month} ${m[1]}` : ym;
}

async function loadVisited() {
  try {
    const res = await fetch("./countries.json", { cache: "no-store" });
    if (!res.ok) throw new Error("countries.json not found");
    const data = await res.json();
    return data.visited || [];
  } catch (err) {
    console.warn("Could not load countries.json - using built-in fallback.", err);
    return [
      { name: "Spain" }, { name: "Italy" }, { name: "Germany" },
      { name: "Belgium" }, { name: "Netherlands" }, { name: "Portugal" },
      { name: "Poland" }, { name: "Denmark" },
    ];
  }
}

async function loadWorld() {
  const url = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error("Could not load map data from the internet.");
  return res.json();
}

function getMapSize() {
  const card = document.querySelector(".map-card");
  const width = Math.max(320, card.clientWidth - 36);
  const height = Math.round(width * 0.72);
  return { width, height };
}

function buildMap(world, visitedList) {
  const svg = d3.select("#map");
  svg.selectAll("*").remove();

  const { width, height } = getMapSize();
  svg.attr("viewBox", `0 0 ${width} ${height}`)
     .attr("preserveAspectRatio", "xMidYMid meet");

  const projection = d3.geoMercator()
    .center([10, 50])
    .scale(width * 0.85)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath(projection);
  const countries = topojson.feature(world, world.objects.countries).features;

  const visitedByName = new Map();
  visitedList.forEach((entry, idx) => {
    const name   = typeof entry === "string" ? entry : entry.name;
    const notes  = typeof entry === "string" ? ""    : (entry.notes  || "");
    const visits = typeof entry === "string" ? []    : (entry.visits || []);
    visitedByName.set(normalizeName(name), {
      displayName: name, notes, visits,
      color: RAINBOW[idx % RAINBOW.length],
    });
  });

  function matchVisited(featureName) {
    const direct = visitedByName.get(normalizeName(featureName));
    if (direct) return direct;
    for (const wantedName of visitedByName.keys()) {
      if (namesMatch(featureName, wantedName)) return visitedByName.get(wantedName);
    }
    return null;
  }

  svg.append("g")
    .selectAll("path")
    .data(countries)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("class", d => "country" + (matchVisited(d.properties.name) ? " visited" : ""))
    .style("fill", d => {
      const v = matchVisited(d.properties.name);
      return v ? v.color : null;
    })
    .attr("data-name", d => d.properties.name)
    .on("click", function (event, d) {
      const v = matchVisited(d.properties.name);
      if (v) popCrown(event, v);
    })
    .append("title")
    .text(d => {
      const v = matchVisited(d.properties.name);
      return v ? `${v.displayName} - You've been here!` : d.properties.name;
    });

  const matchedNames = new Set();
  countries.forEach(c => {
    const v = matchVisited(c.properties.name);
    if (v) matchedNames.add(normalizeName(v.displayName));
  });
  const missed = [];
  visitedByName.forEach((v) => {
    if (!matchedNames.has(normalizeName(v.displayName))) missed.push(v.displayName);
  });
  if (missed.length > 0) {
    const err = document.getElementById("error");
    err.style.display = "block";
    err.textContent = "Hmm, couldn't find these on the map: " + missed.join(", ");
  }

  buildCount(visitedByName);
  buildVisitsModal(visitedByName);
}

function buildCount(visitedByName) {
  const el = document.getElementById("count");
  const n = visitedByName.size;
  el.textContent = `I visited ${n} ${n === 1 ? "country" : "countries"}!`;
}

function buildVisitsModal(visitedByName) {
  // Keep the per-country data so we can group later if sortField is "country".
  visitData = [];
  visitedByName.forEach((v) => visitData.push({
    displayName: v.displayName,
    notes: v.notes,
    color: v.color,
    visits: (v.visits || []).slice(),
  }));
  renderVisitsList();
}

function renderVisitsList() {
  const list = document.getElementById("visits-list");
  list.innerHTML = "";

  if (visitData.length === 0) {
    list.innerHTML = `<li class="empty">No visits recorded yet.</li>`;
    return;
  }

  if (sortField === "country") {
    renderByCountry(list);
  } else {
    renderByDate(list);
  }
}

// Country mode: one block per country with the name, comment, and a sub-list
// of visits (newest first within each block, regardless of outer direction).
function renderByCountry(list) {
  const countries = visitData
    .filter(c => (c.visits || []).length > 0)
    .slice()
    .sort((a, b) => {
      const cmp = a.displayName.localeCompare(b.displayName);
      return sortDir === "asc" ? cmp : -cmp;
    });

  for (const c of countries) {
    const visits = c.visits.slice().sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
    const li = document.createElement("li");
    li.className = "country-group";
    li.innerHTML = `
      <div class="cg-header">
        <span class="dot" style="background:${c.color}"></span>
        <span class="country">${c.displayName}</span>
      </div>
      ${c.notes ? `<div class="cg-notes">${c.notes}</div>` : ""}
      <ul class="cg-visits">
        ${visits.map(ym => `<li>${formatYearMonth(ym)}</li>`).join("")}
      </ul>
    `;
    list.appendChild(li);
  }
}

// Date mode: flat list, one row per visit, sorted by YYYY-MM.
function renderByDate(list) {
  const rows = [];
  visitData.forEach(c => (c.visits || []).forEach(ym => {
    rows.push({ ym, displayName: c.displayName, notes: c.notes, color: c.color });
  }));
  rows.sort((a, b) => {
    const cmp = a.ym < b.ym ? -1 : a.ym > b.ym ? 1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  for (const row of rows) {
    const li = document.createElement("li");
    li.className = "flat-row";
    li.innerHTML = `
      <span class="date">${formatYearMonth(row.ym)}</span>
      <span class="dot" style="background:${row.color}"></span>
      <span class="country">${row.displayName}</span>
      ${row.notes ? `<span class="notes">${row.notes}</span>` : ""}
    `;
    list.appendChild(li);
  }
}

// Direction labels swap with the field. Country uses A-Z / Z-A, date uses Newest/Oldest.
function updateDirLabels() {
  const isDate = sortField === "date";
  const desc = document.querySelector(".dir-label-desc");
  const asc  = document.querySelector(".dir-label-asc");
  if (desc) desc.textContent = isDate ? "Newest first" : "Z → A";
  if (asc)  asc.textContent  = isDate ? "Oldest first" : "A → Z";
}

function wireVisitsModal() {
  const modal = document.getElementById("visits-modal");
  const openBtn = document.getElementById("open-visits");

  function open()  { modal.hidden = false; document.body.style.overflow = "hidden"; }
  function close() { modal.hidden = true;  document.body.style.overflow = ""; }

  openBtn.addEventListener("click", open);
  modal.addEventListener("click", (e) => {
    if (e.target.matches("[data-close]")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
  });

  function activate(group, btn) {
    group.forEach(b => b.setAttribute("aria-pressed", b === btn ? "true" : "false"));
  }

  const fieldPills = Array.from(document.querySelectorAll("#sort-controls .pill[data-field]"));
  fieldPills.forEach(btn => btn.addEventListener("click", () => {
    sortField = btn.dataset.field;
    activate(fieldPills, btn);
    updateDirLabels();
    renderVisitsList();
  }));

  const dirPills = Array.from(document.querySelectorAll("#sort-controls .pill[data-dir]"));
  dirPills.forEach(btn => btn.addEventListener("click", () => {
    sortDir = btn.dataset.dir;
    activate(dirPills, btn);
    renderVisitsList();
  }));

  // Make sure the direction-label text matches whichever field is active at load.
  updateDirLabels();
}

function popCrown(event, visited) {
  const card = document.querySelector(".map-card");
  const rect = card.getBoundingClientRect();
  const pop = document.createElement("div");
  pop.className = "crown-pop";
  pop.style.left = (event.clientX - rect.left) + "px";
  pop.style.top  = (event.clientY - rect.top)  + "px";
  pop.innerHTML = `
    \u{1F451}
    <span class="label">${visited.displayName}
      ${visited.notes ? `<span class="note">${visited.notes}</span>` : ""}
    </span>
  `;
  card.appendChild(pop);
  setTimeout(() => pop.remove(), 1700);
}

function startSparkles() {
  const SPARKLES = ["✨", "⭐", "\u{1F496}", "\u{1F338}", "\u{1F984}", "\u{1F308}", "\u{1F451}"];
  setInterval(() => {
    const s = document.createElement("div");
    s.className = "sparkle";
    s.textContent = SPARKLES[Math.floor(Math.random() * SPARKLES.length)];
    s.style.left = (Math.random() * 100) + "vw";
    s.style.animationDuration = (5 + Math.random() * 5) + "s";
    s.style.fontSize = (18 + Math.random() * 18) + "px";
    document.body.appendChild(s);
    setTimeout(() => s.remove(), 10000);
  }, 800);
}

async function main() {
  try {
    const [world, visited] = await Promise.all([loadWorld(), loadVisited()]);
    document.getElementById("loading").style.display = "none";
    buildMap(world, visited);
    window.addEventListener("resize", () => buildMap(world, visited));
    wireVisitsModal();
    startSparkles();
  } catch (err) {
    console.error(err);
    document.getElementById("loading").style.display = "none";
    const e = document.getElementById("error");
    e.style.display = "block";
    e.textContent = "Oh no! Couldn't load the map. Check your internet and reload.";
  }
}

main();
