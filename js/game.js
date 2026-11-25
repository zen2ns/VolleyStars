// =====================================================================
//  VolleyStars game screens: team builder + match flow + animations.
// =====================================================================

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const other = Rules.otherSide;
const byId = (id) => CREATURES.find((c) => c.id === id);

const STATS = [
  ["str", "STR", "#ff8a8a", "Strength"],
  ["ctrl", "CTL", "#7ad8ff", "Control"],
  ["def", "DEF", "#45d483", "Defense"],
  ["per", "PER", "#ffd65c", "Perception"],
];
const CLASS_SHORT = { receiver: "REC", setter: "SET", spiker: "SPK" };

function badgesHTML(c) {
  return `<div class="badges">${c.classes.map((k) => `<span class="badge ${k}">${CLASS_SHORT[k]}</span>`).join("")}</div>`;
}

// ---------------- tooltip ----------------
const tip = $("tooltip");
function tooltipHTML(c) {
  const live = c.cooldown !== undefined
    ? `<div class="tip-ab">${c.cooldown > 0 ? `Ability recharging: ${c.cooldown} rall${c.cooldown === 1 ? "y" : "ies"}` : "Ability ready ✨"}${c.winded > 0 ? "<br>💨 Winded: spikes weaker" : ""}</div>` : "";
  return `<b>${c.name}</b> <span class="muted">${c.classes.join(", ")}</span>` +
    STATS.map(([k, , , full]) => `<div>${full}: ${c[k]}</div>`).join("") +
    `<div class="tip-ab"><i>Passive · ${c.passive.name}:</i> ${c.passive.text}</div>` +
    `<div class="tip-ab"><i>Active · ${c.active.name}:</i> ${c.active.text}</div>` + live;
}
function attachTooltip(el, getCreature) {
  el.addEventListener("mouseenter", () => {
    const c = getCreature();
    if (!c) return;
    tip.innerHTML = tooltipHTML(c);
    tip.classList.remove("hidden");
  });
  el.addEventListener("mousemove", (e) => {
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 235) + "px";
    tip.style.top = Math.min(e.clientY + 14, window.innerHeight - 220) + "px";
  });
  el.addEventListener("mouseleave", () => tip.classList.add("hidden"));
}

// =====================================================================
//  TEAM BUILDER
// =====================================================================
// slots[pos] = creature id; looks[id] = which picture to use
const builder = { slots: {}, looks: {}, selected: null };
Rules.POSITIONS.forEach((p) => { builder.slots[p] = null; });

try {
  const saved = JSON.parse(localStorage.getItem("volleystars-team-v2") || "null");
  if (saved) {
    Rules.POSITIONS.forEach((p) => { builder.slots[p] = saved.slots[p] && byId(saved.slots[p]) ? saved.slots[p] : null; });
    builder.looks = saved.looks || {};
    if (saved.difficulty) $("difficulty").value = saved.difficulty;
  }
} catch (e) { /* no saved team */ }

function saveTeam() {
  try {
    localStorage.setItem("volleystars-team-v2", JSON.stringify({
      slots: builder.slots, looks: builder.looks, difficulty: $("difficulty").value,
    }));
  } catch (e) { /* storage not available */ }
}

// ---------- sprites: trim the empty space around each drawing so all creatures look even ----------
const SPRITE = {};
const spriteSrc = (src) => SPRITE[src] || src;
function trimSprite(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const cv = document.createElement("canvas");
        cv.width = img.width; cv.height = img.height;
        const ctx = cv.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
        let x0 = cv.width, y0 = cv.height, x1 = -1, y1 = -1;
        for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x++) {
          if (d[(y * cv.width + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        }
        if (x1 >= x0) {
          const out = document.createElement("canvas");
          out.width = x1 - x0 + 3; out.height = y1 - y0 + 3;
          out.getContext("2d").drawImage(cv, x0, y0, out.width - 2, out.height - 2, 1, 1, out.width - 2, out.height - 2);
          SPRITE[src] = out.toDataURL();
        }
      } catch (e) { /* e.g. opened as a local file: keep the original picture */ }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}
Promise.all(CREATURES.flatMap((c) => c.looks).map(trimSprite)).then(() => { if (!M) renderBuilder(); });

const lookOf = (c) => spriteSrc(c.looks[builder.looks[c.id] || 0] || c.looks[0]);
const placedPos = (id) => Rules.POSITIONS.find((p) => builder.slots[p] === id);

function renderRoster() {
  const roster = $("roster");
  roster.innerHTML = "";
  CREATURES.forEach((c) => {
    const card = document.createElement("div");
    const placed = placedPos(c.id) !== undefined;
    card.className = "card" + (builder.selected === c.id ? " selected" : "") + (placed ? " placed" : "");
    card.innerHTML = `
      ${c.looks.length > 1 ? '<button class="look-btn" title="Change look">Look ⇄</button>' : ""}
      <img src="${lookOf(c)}" alt="${c.name}">
      <div class="name">${c.name}</div>
      ${badgesHTML(c)}
      ${STATS.map(([k, short, color]) => `
        <div class="stat-row"><span>${short}</span>
          <div class="stat-bar"><div style="width:${c[k]}%;background:${color}"></div></div>
          <span>${c[k]}</span></div>`).join("")}
      <div class="abil"><b>${c.passive.name}</b> (passive)<br><b>${c.active.name}</b> (active)</div>`;
    const lookBtn = card.querySelector(".look-btn");
    if (lookBtn) {
      lookBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        builder.looks[c.id] = ((builder.looks[c.id] || 0) + 1) % c.looks.length;
        renderBuilder();
      });
    }
    card.addEventListener("click", () => {
      if (placed) builder.slots[placedPos(c.id)] = null;
      else builder.selected = builder.selected === c.id ? null : c.id;
      renderBuilder();
    });
    attachTooltip(card, () => c);
    roster.appendChild(card);
  });
}

const POS_NOTE = { 1: "Serves first", 2: "Front right", 3: "Front middle", 4: "Front left", 5: "Back left", 6: "Back middle" };

function renderBuilderGrid() {
  const grid = $("builderGrid");
  grid.innerHTML = "";
  Rules.POSITIONS.forEach((p) => {
    const cell = document.createElement("div");
    cell.style.gridRow = Rules.lane("player", p) + 1;
    cell.style.gridColumn = Rules.isFront(p) ? 2 : 1;
    const id = builder.slots[p];
    cell.className = "bcell" + (id ? " filled" : "");
    cell.innerHTML = `<span class="pos-num">${p}</span>` +
      (id ? `<img src="${lookOf(byId(id))}" alt=""><div class="cname">${byId(id).name}</div>` : "") +
      `<span class="pos-note">${POS_NOTE[p]}</span>`;
    if (id) attachTooltip(cell, () => byId(builder.slots[p]));
    cell.addEventListener("click", () => {
      tip.classList.add("hidden");
      if (builder.selected) {
        builder.slots[p] = builder.selected;
        builder.selected = null;
      } else if (id) {
        builder.slots[p] = null;
      } else {
        $("builderMsg").textContent = "Pick a creature from the list first.";
        return;
      }
      renderBuilder();
    });
    grid.appendChild(cell);
  });
}

function renderBuilder() {
  const count = Rules.POSITIONS.filter((p) => builder.slots[p]).length;
  renderRoster();
  renderBuilderGrid();
  const ok = count === CONFIG.teamSize;
  $("startMatch").disabled = !ok;
  $("builderMsg").textContent = ok
    ? `Team ready! ${byId(builder.slots[1]).name} serves first.`
    : `${count} / ${CONFIG.teamSize} placed.`;
  saveTeam();
}

$("randomTeam").addEventListener("click", () => {
  const at = AI.buildTeam(CREATURES);
  Rules.POSITIONS.forEach((p) => { builder.slots[p] = at[p].id; });
  builder.selected = null;
  renderBuilder();
});
$("difficulty").addEventListener("change", saveTeam);
$("startMatch").addEventListener("click", startMatch);
renderBuilder();

// =====================================================================
//  MATCH
// =====================================================================
let M = null;
let matchToken = 0;
class Abort extends Error {}
function checkAlive(token) { if (token !== matchToken) throw new Abort(); }
async function wait(ms) { const t = matchToken; await sleep(ms); checkAlive(t); }

const teamOf = (side) => M[side];
const posOf = (team, c) => Rules.POSITIONS.find((p) => team.at[p] === c);
const who = (side, c) => `<span class="${side === "player" ? "you" : "cpu"}">${side === "player" ? "Your" : "CPU's"} ${c.name}</span>`;
const sideWord = (side) => (side === "player" ? "Your" : "CPU's");

function log(html) {
  const line = document.createElement("div");
  line.innerHTML = html;
  $("log").prepend(line);
}

// ---------- court geometry (percent of the court box) ----------
const XS = { player: { back: 17.75, front: 39.25, serve: 5 }, cpu: { front: 60.75, back: 82.25, serve: 95 } };
const LANE_Y = [31, 59, 87];
const HEAD = 23; // how far above the feet the ball sits

function feet(side, pos) {
  return { x: XS[side][Rules.isFront(pos) ? "front" : "back"], y: LANE_Y[Rules.lane(side, pos)] };
}
function headPt(side, pos) { const f = feet(side, pos); return { x: f.x, y: f.y - HEAD, gy: f.y }; }

const elOf = new Map(); // creature instance -> its element on court

function startMatch() {
  const diff = $("difficulty").value;
  const d = CONFIG.difficulty[diff];
  const at = {};
  Rules.POSITIONS.forEach((p) => {
    const base = byId(builder.slots[p]);
    at[p] = Rules.makeInstance(base, builder.looks[base.id] || 0);
  });
  matchToken++;
  M = {
    diff, smart: d.smart,
    player: Rules.makeTeam("player", at, 1),
    cpu: Rules.makeTeam("cpu", AI.buildTeam(CREATURES), d.statMult),
    score: { player: 0, cpu: 0 },
    serving: Math.random() < 0.5 ? "player" : "cpu",
    pending: null, armed: null, freeOn: false,
    mom: 0, poss: null, fx: new Set(),
    ball: { x: 50, y: 50, gy: 60 },
  };
  $("log").innerHTML = "";
  $("builder").classList.add("hidden");
  $("match").classList.remove("hidden");
  buildCourt();
  updateScore();
  buildFlames();
  setMomentum(0);
  refreshControls();
  log(`Match start! ${M.serving === "player" ? "You serve" : "CPU serves"} first. First to ${CONFIG.pointsToWin}.`);
  matchLoop(matchToken);
}

function buildCourt() {
  const holder = $("creatures");
  holder.innerHTML = "";
  $("fxLayer").innerHTML = "";
  elOf.clear();
  ["player", "cpu"].forEach((side) => {
    Rules.POSITIONS.forEach((p) => {
      const c = teamOf(side).at[p];
      const el = document.createElement("div");
      el.className = `crt ${side}`;
      el.innerHTML = `<div class="shadow"></div><div class="jumper"><div class="bob"><img src="${spriteSrc(c.img)}" alt="${c.name}"></div></div><div class="tag">${c.name}</div>`;
      const bob = el.querySelector(".bob");
      bob.style.animationDuration = (2 + Math.random() * 1.2).toFixed(2) + "s";
      bob.style.animationDelay = (-Math.random() * 3).toFixed(2) + "s";
      el.addEventListener("click", () => onCreatureClick(side, c));
      el.addEventListener("mouseenter", () => showBlockers(side, c));
      el.addEventListener("mouseleave", clearBlockers);
      attachTooltip(el, () => c);
      holder.appendChild(el);
      elOf.set(c, el);
    });
  });
  placeAll();
  updateStatus();
  setBall(headPt(M.serving, 1));
}

function placeAll() {
  ["player", "cpu"].forEach((side) => {
    Rules.POSITIONS.forEach((p) => {
      const el = elOf.get(teamOf(side).at[p]);
      const f = feet(side, p);
      el.style.left = f.x + "%";
      el.style.top = f.y + "%";
      el.style.zIndex = 5 + Rules.lane(side, p);
    });
  });
}

// Winded = faded sprite; ability ready = glowing name; buff auras
function updateStatus() {
  ["player", "cpu"].forEach((side) => {
    const T = teamOf(side);
    Rules.POSITIONS.forEach((p) => {
      const c = T.at[p];
      const el = elOf.get(c);
      el.classList.toggle("winded", c.winded > 0);
      el.querySelector(".tag").classList.toggle("ready", c.cooldown === 0);
      el.classList.toggle("hornwall", c.active.id === "hornWall" && !!T.buffs.hornWall);
      el.classList.toggle("roots", c.active.id === "deepRoots" && !!T.buffs.deepRoots);
      el.classList.toggle("stampede", !!T.buffs.stampede);
      el.classList.toggle("poisoned", c.poison > 0);
    });
  });
}

function updateScore() {
  $("scorePlayer").textContent = M.score.player;
  $("scoreCpu").textContent = M.score.cpu;
  $("servePlayer").classList.toggle("on", M.serving === "player");
  $("serveCpu").classList.toggle("on", M.serving === "cpu");
}

// ---------- HUD ----------
const WORDS = {
  bump: ["BUMP", "w-bump"], set: ["SET", "w-set"], spike: ["SPIKE", "w-spike"],
  free: ["FREE BALL", "w-free"], serve: ["SERVE", "w-serve"], sneaky: ["SNEAKY ATTACK", "w-sneaky"],
};
function setStep(side, touch, word) {
  const [w, cls] = WORDS[word];
  const whoTxt = side === "cpu" ? '<span class="who">CPU · </span>' : side === "player" && word === "serve" ? "YOUR " : "";
  const touchTxt = touch ? `<span class="t">TOUCH ${touch}/3 · </span>` : "";
  $("step").innerHTML = `${whoTxt}${touchTxt}<span class="${cls}">${w}</span>`;
  $("step").classList.toggle("cpu-turn", side === "cpu");
}

// ---------- momentum (shared tug-of-war) + flames around the ball ----------
// M.mom goes from -6 (all CPU) to +6 (all you). Resets every rally.
const levelFor = (side) => Math.max(0, side === "player" ? M.mom : -M.mom);
function setMomentum(v) {
  M.mom = Rules.clamp(v, -CONFIG.momentumMax, CONFIG.momentumMax);
  const fill = $("mFill");
  const pct = (Math.abs(M.mom) / CONFIG.momentumMax) * 50;
  fill.style.width = pct + "%";
  fill.style.left = (M.mom >= 0 ? 50 - pct : 50) + "%";
  const col = M.mom >= 0 ? (M.mom >= 5 ? "#bfe6ff" : "#4fa3ff") : (M.mom <= -5 ? "#ffd0d4" : "#ff5c6c");
  fill.style.background = col;
  fill.style.boxShadow = Math.abs(M.mom) >= 3 ? `0 0 12px ${col}` : "none";
  updateFlames();
}
function swing(side, n, pos, text) {
  if (n <= 0) return;
  setMomentum(M.mom + (side === "player" ? n : -n));
  if (text) pop(side, pos, text, "passive");
}
function setPossession(side) { M.poss = side; updateFlames(); }

const FLAME_COLORS = {
  none: ["#fff3a0", "#ff9a1a"], fire: ["#ffe066", "#ff2a00"], shadow: ["#e9c8ff", "#7a14d8"],
  tidal: ["#e8f8ff", "#1a8cff"], seed: ["#e2ffc4", "#2e9e3a"],
  toxic: ["#eaffc4", "#8a2be2"], lantern: ["#fff0b3", "#ff7a00"],
};
const FX_RING = {
  fire: ["#ff2a00", "#ffb020"], shadow: ["#1a0030", "#b14dff"], tidal: ["#0a5cff", "#9be3ff"], seed: ["#1f7a2a", "#ff6a8a"],
  toxic: ["#7dff5a", "#9b30ff"], lantern: ["#ff7a00", "#8dff6a"],
};
function buildFlames() {
  const f = $("ballFlames");
  f.innerHTML = "";
  for (let i = 0; i < 9; i++) {
    const fl = document.createElement("div");
    fl.className = "flame";
    fl.style.transform = `rotate(${i * 40}deg)`;
    fl.innerHTML = "<i></i>";
    fl.firstChild.style.animationDelay = (-Math.random() * 0.3).toFixed(2) + "s";
    fl.firstChild.style.animationDuration = (0.16 + Math.random() * 0.12).toFixed(2) + "s";
    f.appendChild(fl);
  }
}
function primaryFx() {
  for (const k of ["shadow", "toxic", "tidal", "lantern", "fire", "seed"]) if (M.fx.has(k)) return k;
  return "none";
}
function updateFlames() {
  if (!M) return;
  const lvl = M.poss ? levelFor(M.poss) : 0;
  const f = $("ballFlames");
  f.classList.toggle("on", lvl > 0);
  f.style.width = lvl > 0 ? 4 * (1.6 + 0.4 * lvl) + "%" : "0";
  let [a, b] = FLAME_COLORS[primaryFx()];
  if (primaryFx() === "none" && lvl >= 5) [a, b] = ["#ffffff", "#ffb020"];
  f.style.setProperty("--fa", a);
  f.style.setProperty("--fb", b);
  // ability swirl
  const ring = $("ballFx");
  const kinds = [...M.fx];
  ring.classList.toggle("on", kinds.length > 0);
  if (kinds.length) {
    const stops = kinds.flatMap((k) => FX_RING[k]);
    ring.style.background = `conic-gradient(${[...stops, stops[0]].join(", ")})`;
    ring.style.width = 10 + lvl * 1.2 + "%";
  }
}

// ---------- animation helpers ----------
function anim(c, name) {
  const j = elOf.get(c).querySelector(".jumper");
  j.classList.remove("jump", "dig", "shake");
  void j.offsetWidth;
  j.classList.add(name);
}

function setBall(p) {
  M.ball = { ...p };
  const b = $("ball"), s = $("ballShadow"), a = $("ballFlames"), r = $("ballFx");
  b.style.left = a.style.left = r.style.left = p.x + "%";
  b.style.top = a.style.top = r.style.top = p.y + "%";
  s.style.left = p.x + "%"; s.style.top = p.gy + "%";
}

function setBallFx(list) {
  M.fx = new Set(list.filter(Boolean));
  $("ball").className = "ball " + [...M.fx].join(" ");
  updateFlames();
}

function particle(x, y, kind, drift = null) {
  const el = document.createElement("div");
  el.className = "particle " + kind + (drift ? " drift" : "");
  el.style.left = x + "%";
  el.style.top = y + "%";
  if (drift) { el.style.setProperty("--dx", drift[0] + "px"); el.style.setProperty("--dy", drift[1] + "px"); }
  $("fxLayer").appendChild(el);
  setTimeout(() => el.remove(), 950);
}
function spray(x, y, kind, n = 12, spread = 60) {
  const rises = /fire|ember|smoke/.test(kind); // flames, sparks and smoke drift upward
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, r = spread * (0.4 + Math.random() * 0.6);
    particle(x, y, kind, [Math.cos(a) * r, Math.sin(a) * r * (rises ? 0.5 : 1) - (rises ? r * 0.9 : 10)]);
  }
}
// flat shockwave on the floor
function ripple(x, gy, color, size = 12) {
  const el = document.createElement("div");
  el.className = "ripple";
  el.style.left = x + "%";
  el.style.top = gy + "%";
  el.style.width = size + "%";
  el.style.setProperty("--c", color);
  $("fxLayer").appendChild(el);
  setTimeout(() => el.remove(), 650);
}
// light streaks shooting out from a point
function streaks(x, y, color, n = 8, len = 6) {
  for (let i = 0; i < n; i++) {
    const el = document.createElement("div");
    el.className = "streak";
    el.style.left = x + "%";
    el.style.top = y + "%";
    el.style.setProperty("--a", (i / n) * 360 + Math.random() * 20 + "deg");
    el.style.setProperty("--len", len * (0.6 + Math.random() * 0.6) + "%");
    el.style.setProperty("--c", color);
    $("fxLayer").appendChild(el);
    setTimeout(() => el.remove(), 500);
  }
}
function drops(x, y, n = 12, spread = 70) {
  for (let i = 0; i < n; i++) {
    const dx = (Math.random() - 0.5) * spread * 2;
    particle(x, y, "drop", [dx, -spread * (0.5 + Math.random() * 0.8)]);
  }
}
function flash(color) {
  const el = document.createElement("div");
  el.className = "flash";
  el.style.setProperty("--c", color);
  $("fxLayer").appendChild(el);
  setTimeout(() => el.remove(), 400);
}
function courtShake(size) {
  const c = $("court");
  c.classList.remove("shake-s", "shake-m", "shake-l");
  void c.offsetWidth;
  c.classList.add("shake-" + size);
}

// Fly the ball from where it is to `to` in an arc. arc = peak height in % of court height.
function flyBall(to, ms, arc) {
  const token = matchToken;
  const from = { ...M.ball };
  return new Promise((resolve, reject) => {
    const start = performance.now();
    let frame = 0;
    function step(now) {
      if (token !== matchToken) return reject(new Abort());
      const t = Math.min(1, (now - start) / ms);
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * arc;
      const gy = from.gy + (to.gy - from.gy) * t;
      setBall({ x, y, gy });
      const kinds = [...M.fx];
      if (M.poss && levelFor(M.poss) >= 2) kinds.push("ember");
      if (kinds.length && frame % 2 === 0) particle(x, y, kinds[(frame / 2) % kinds.length]);
      frame++;
      if (t < 1) requestAnimationFrame(step);
      else { setBall(to); resolve(); }
    }
    requestAnimationFrame(step);
  });
}

// Floating text above a creature. Several at once stack instead of overlapping.
const popStack = new Map();
function pop(side, pos, text, kind = "") {
  const f = feet(side, pos);
  const key = side + pos + (kind === "passive" ? "p" : "");
  const n = popStack.get(key) || 0;
  popStack.set(key, n + 1);
  const el = document.createElement("div");
  el.className = "pop " + kind;
  el.textContent = text;
  el.style.left = f.x + "%";
  // passive text sits just under the name tag; everything else above the head
  el.style.top = (kind === "passive" ? f.y + 7 + n * 3.5 : f.y - 13 - n * 5) + "%";
  $("court").appendChild(el);
  setTimeout(() => { el.remove(); popStack.set(key, Math.max(0, (popStack.get(key) || 1) - 1)); }, 1300);
}
function popAt(x, y, text, kind = "") {
  const el = document.createElement("div");
  el.className = "pop " + kind;
  el.textContent = text;
  el.style.left = x + "%";
  el.style.top = y + "%";
  $("court").appendChild(el);
  setTimeout(() => el.remove(), 1300);
}
function popPassives(side, pos, list) { (list || []).forEach((t) => pop(side, pos, t, "passive")); }

async function showBanner(title, sub, lose) {
  const b = $("banner");
  $("bannerTitle").textContent = title;
  $("bannerSub").textContent = sub;
  b.classList.toggle("lose", lose);
  b.classList.remove("hidden");
  b.style.animation = "none"; void b.offsetWidth; b.style.animation = "";
  try { await wait(1500); } finally { b.classList.add("hidden"); }
}

function setHolder(side, pos) {
  elOf.forEach((el) => el.classList.remove("holder"));
  if (side) elOf.get(teamOf(side).at[pos]).classList.add("holder");
}

// ---------- ability visuals ----------
function abilityFx(side, team, pos) {
  const c = team.at[pos];
  const f = feet(side, pos);
  const h = headPt(side, pos);
  pop(side, pos, c.active.name + "!", "ability");
  log(`<span class="abil">${who(side, c)} used ${c.active.name}!</span>`);
  switch (c.active.id) {
    case "fireball": spray(h.x, h.y + 6, "fire", 18, 55); streaks(h.x, h.y + 6, "#ff7a1a", 10, 5); break;
    case "shadowStrike": spray(h.x, h.y + 6, "smoke", 8, 40); streaks(h.x, h.y + 6, "#b14dff", 10, 5); break;
    case "tidalSet": drops(h.x, h.y + 8, 18, 60); ripple(f.x, f.y, "#4fc3ff", 14); ripple(f.x, f.y, "#bfeaff", 8); break;
    case "sneakySeed": spray(h.x, h.y + 6, "seed", 12, 40); break;
    case "venomSpike": spray(h.x, h.y + 6, "toxic", 16, 50); spray(h.x, h.y + 6, "bubble", 8, 40); streaks(h.x, h.y + 6, "#7dff5a", 8, 5); break;
    case "lanternSet": {
      spray(h.x, h.y + 6, "lantern", 14, 50); spray(h.x, h.y + 6, "ghost", 6, 60);
      // the other team's front row gets spooked
      const oSide = other(side), O = teamOf(oSide);
      Rules.FRONT.forEach((bp) => { anim(O.at[bp], "shake"); pop(oSide, bp, "Spooked!", "bad"); const g = headPt(oSide, bp); spray(g.x, g.y + 8, "ghost", 3, 30); });
      break;
    }
    case "hornWall": streaks(f.x, f.y - 10, "#ffb347", 8, 5); addShield(side, pos); break;
    case "deepRoots": spray(f.x, f.y - 3, "leaf", 14, 40); ripple(f.x, f.y, "#5fd35f", 10); break;
    case "stampede":
      Rules.POSITIONS.forEach((p) => {
        const ff = feet(side, p);
        spray(ff.x, ff.y - 1, "dust", 6, 30);
        anim(team.at[p], "dig");
      });
      courtShake("s");
      break;
  }
  updateStatus();
}
function addShield(side, pos) {
  const el = document.createElement("div");
  el.className = "shield";
  el.dataset.side = side;
  el.style.left = (side === "player" ? 46.5 : 53.5) + "%";
  el.style.top = feet(side, pos).y - 12 + "%";
  $("fxLayer").appendChild(el);
}
function clearRallyFx() {
  document.querySelectorAll(".shield").forEach((el) => el.remove());
}

// Big, satisfying hit landing: the effect matches the ball's ability, and gets
// bigger and brighter with more power and momentum.
function spikeImpact(pt, power, level) {
  const tier = power >= 105 || level >= 5 ? 3 : power >= 88 || level >= 3 ? 2 : power >= 70 ? 1 : 0;
  const kinds = [...M.fx];
  if (!kinds.length) kinds.push(level >= 2 ? "flame" : "spark");
  const x = pt.x, y = pt.y + 8, gy = pt.gy;
  const main = { fire: "#ff6a00", shadow: "#b14dff", tidal: "#4fc3ff", seed: "#5fd35f", flame: "#ffb020", spark: "#ffd65c", toxic: "#7dff5a", lantern: "#ff8c1a" };
  if (tier >= 1) courtShake(["s", "s", "m", "l"][tier]);
  kinds.forEach((k) => {
    const n = 6 + tier * 6;
    switch (k) {
      case "fire":
      case "flame":
        spray(x, y, "fire big", n, 45 + tier * 25);
        spray(x, y, "ember", n, 70 + tier * 25);
        streaks(x, y, "#ff7a1a", 6 + tier * 3, 5 + tier * 2);
        break;
      case "shadow":
        spray(x, y, "smoke", 4 + tier * 3, 40 + tier * 20);
        streaks(x, y, "#c77dff", 8 + tier * 3, 6 + tier * 2);
        spray(x, y, "shadow", n, 60 + tier * 25);
        break;
      case "tidal":
        drops(x, y, n + 6, 50 + tier * 20);
        streaks(x, y, "#9be3ff", 6 + tier * 2, 5 + tier * 2);
        ripple(x, gy, "#bfeaff", 10 + tier * 5);
        break;
      case "seed":
        spray(x, y, "leaf", n, 50 + tier * 20);
        spray(x, y, "seed", n, 40 + tier * 20);
        break;
      case "toxic":
        spray(x, y, "toxic", n, 50 + tier * 20);
        spray(x, y, "bubble", 4 + tier * 3, 40 + tier * 20);
        spray(x, y, "smoke", 2 + tier * 2, 40);
        streaks(x, y, "#7dff5a", 6 + tier * 3, 5 + tier * 2);
        break;
      case "lantern":
        spray(x, y, "fire big", n, 45 + tier * 20);
        spray(x, y, "ghost", 3 + tier * 2, 60 + tier * 20);
        streaks(x, y, "#ff9a1a", 6 + tier * 3, 5 + tier * 2);
        break;
      default:
        streaks(x, y, "#ffd65c", 6 + tier * 3, 4 + tier * 2);
        spray(x, y, "spark", n, 40 + tier * 20);
    }
  });
  ripple(x, gy, main[kinds[0]], 8 + tier * 6);
  if (tier >= 2) flash(main[kinds[0]]);
  if (tier >= 3) { flash("#ffffff"); streaks(x, y, "#ffffff", 12, 12); }
}

// ---------- abilities (player) ----------
const ARMABLE = ["fireball", "shadowStrike", "venomSpike", "tidalSet", "lanternSet", "sneakySeed"];
const SPIKE_ABILITIES = ["fireball", "shadowStrike", "venomSpike"];
const SET_ABILITIES = ["tidalSet", "lanternSet"];

function abilityCtx() {
  const p = M && M.pending;
  if (!p) return null;
  return { holderPos: p.holderPos, touch: p.touch, canSpike: p.canSpike, serve: p.serve };
}

function renderAbilityButtons() {
  document.querySelectorAll(".abil-btn").forEach((b) => b.remove());
  const ctx = abilityCtx();
  if (!ctx) return;
  Rules.POSITIONS.forEach((pos) => {
    const c = M.player.at[pos];
    const armed = M.armed && M.armed.c === c;
    if (!armed && !Rules.abilityReady(M.player, pos, ctx)) return;
    const btn = document.createElement("button");
    btn.className = "abil-btn" + (armed ? " armed" : "");
    btn.textContent = armed ? `${c.active.name} ✓` : c.active.name;
    btn.title = c.active.text;
    btn.addEventListener("click", (e) => { e.stopPropagation(); onAbilityClick(c); });
    btn.addEventListener("mouseenter", (e) => e.stopPropagation());
    elOf.get(c).appendChild(btn);
  });
}

function onAbilityClick(c) {
  const ctx = abilityCtx();
  if (!ctx) return;
  const pos = posOf(M.player, c);
  if (M.armed && M.armed.c === c) { M.armed = null; refreshControls(); return; } // un-arm
  if (!Rules.abilityReady(M.player, pos, ctx)) return;
  if (ARMABLE.includes(c.active.id)) {
    M.armed = { c, id: c.active.id };
  } else {
    Rules.useAbility(M.player, pos);
    abilityFx("player", M.player, pos);
  }
  refreshControls();
}

// ---------- player input ----------
function askPlayer(opts) {
  return new Promise((resolve) => {
    M.pending = { ...opts, resolve };
    M.armed = null;
    M.freeOn = false;
    refreshControls();
  });
}

function askServeType() {
  return new Promise((resolve) => {
    const box = $("servePick");
    box.classList.remove("hidden");
    const done = (t) => {
      box.classList.add("hidden");
      $("serveFloat").onclick = $("serveHard").onclick = null;
      resolve(t);
    };
    $("serveFloat").onclick = () => done("float");
    $("serveHard").onclick = () => done("hard");
    M.cancelServe = () => done("float");
  });
}

function clearAuras() {
  elOf.forEach((el) => {
    el.classList.remove("pick-mate", "pick-opp", "suggest", "armed", "blocker-warn");
    el.style.setProperty("--k", 0);
  });
}

function refreshControls() {
  if (!M) return;
  const p = M.pending;
  clearAuras();
  renderAbilityButtons();
  $("freeToggle").classList.add("hidden");
  if (!p) return;
  if (M.armed) elOf.get(M.armed.c).classList.add("armed");

  const markOpp = (fn, list = Rules.POSITIONS) => list.forEach((q) => {
    const el = elOf.get(M.cpu.at[q]);
    el.classList.add("pick-opp");
    el.style.setProperty("--k", Rules.clamp(fn(q), 0, 1).toFixed(2));
  });

  if (p.serve) {
    setStep("player", 0, "serve");
    const power = Rules.servePowerEstimate(M.player, p.serveType);
    markOpp((q) => Rules.shankChance(M.cpu, q, power, "serve") * 2.2, Rules.serveTargets(p.serveType));
    return;
  }
  const holder = M.player.at[p.holderPos];
  const sneaky = M.armed && M.armed.id === "sneakySeed";
  const attackTouch = p.canSpike || p.touch >= 3;

  if (sneaky) {
    setStep("player", p.touch, "sneaky");
    const power = 40 + holder.str * 0.35 + 5;
    markOpp((q) => Rules.shankChance(M.cpu, q, power * (1 + CONFIG.comboPowerPerLevel * levelFor("player")), "spike", 0.75) * 2);
  } else if (p.canSpike && !M.freeOn) {
    setStep("player", p.touch, "spike");
    const special = M.armed && SPIKE_ABILITIES.includes(M.armed.id) ? M.armed.id : null;
    markOpp((q) => Rules.killChance(M.player, p.holderPos, p.quality, M.cpu, q, levelFor("player"), special).kill * 1.8);
    $("freeToggle").classList.remove("hidden");
    $("freeToggle").classList.toggle("on", M.freeOn);
  } else if (attackTouch) {
    setStep("player", p.touch, "free");
    markOpp((q) => Rules.shankChance(M.cpu, q, 40, "free") * 3);
    if (p.canSpike) { $("freeToggle").classList.remove("hidden"); $("freeToggle").classList.add("on"); }
  } else {
    setStep("player", p.touch, p.touch === 1 ? "bump" : "set");
    Rules.POSITIONS.forEach((q) => {
      if (q === p.holderPos) return;
      const m = M.player.at[q];
      const el = elOf.get(m);
      el.classList.add("pick-mate");
      const good = p.touch === 1 ? Rules.has(m, "setter") : Rules.has(m, "spiker") && m.winded === 0;
      if (good) el.classList.add("suggest");
    });
  }
}

// While aiming a spike, hovering a target shows the blockers in the ball's path
function showBlockers(side, c) {
  const p = M && M.pending;
  if (!p || side !== "cpu" || p.serve || !p.canSpike || M.freeOn) return;
  if (M.armed && M.armed.id === "shadowStrike") return;
  const target = posOf(M.cpu, c);
  const hitter = M.player.at[p.holderPos];
  Rules.blockChances(M.player, p.holderPos, M.cpu, target, hitter.str * 0.9).forEach((b) => {
    if (b.chance < 0.04) return;
    const el = elOf.get(M.cpu.at[b.pos]);
    el.classList.add("blocker-warn");
    el.style.setProperty("--b", Math.min(1, b.chance * 3).toFixed(2));
  });
}
function clearBlockers() { elOf.forEach((el) => el.classList.remove("blocker-warn")); }

function onCreatureClick(side, c) {
  const p = M && M.pending;
  if (!p) return;
  const el = elOf.get(c);
  const team = teamOf(side);
  const pos = posOf(team, c);
  let action = null;
  if (p.serve && side === "cpu") action = { type: "serve", target: pos };
  else if (side === "player" && el.classList.contains("pick-mate")) {
    const special = M.armed && SET_ABILITIES.includes(M.armed.id) ? M.armed.id : null;
    action = { type: p.touch === 1 ? "bump" : "set", target: pos, special };
  } else if (side === "cpu" && el.classList.contains("pick-opp")) {
    if (M.armed && M.armed.id === "sneakySeed") action = { type: "sneaky", target: pos, special: "sneakySeed" };
    else if (p.canSpike && !M.freeOn) {
      const special = M.armed && SPIKE_ABILITIES.includes(M.armed.id) ? M.armed.id : null;
      action = { type: "spike", target: pos, special };
    } else action = { type: "free", target: pos };
  }
  if (!action) return;
  M.pending = null;
  M.armed = null;
  M.freeOn = false;
  tip.classList.add("hidden");
  refreshControls();
  p.resolve(action);
}

$("freeToggle").addEventListener("click", () => { if (M && M.pending) { M.freeOn = !M.freeOn; refreshControls(); } });

// ---------- timing bar (spikes and hard serves) ----------
function runTiming(ctrl) {
  const token = matchToken;
  return new Promise((resolve) => {
    const good = 10 + ctrl * 0.12;          // % width of the green zone
    const perfect = good / 3;               // % width of the gold zone
    const center = 25 + Math.random() * 50;
    const box = $("timing");
    $("timingGood").style.left = center - good / 2 + "%";
    $("timingGood").style.width = good + "%";
    $("timingPerfect").style.left = center - perfect / 2 + "%";
    $("timingPerfect").style.width = perfect + "%";
    box.classList.remove("hidden");
    const start = performance.now();
    const period = 850; // ms for one sweep
    let pos = 0, done = false;

    function finish(grade) {
      if (done) return;
      done = true;
      box.classList.add("hidden");
      $("court").removeEventListener("pointerdown", onHit);
      document.removeEventListener("keydown", onKey);
      resolve(grade);
    }
    function onHit(e) {
      if (e) e.preventDefault();
      const d = Math.abs(pos - center);
      finish(d <= perfect / 2 ? "perfect" : d <= good / 2 ? "good" : d <= good ? "ok" : d <= good * 2 ? "poor" : "miss");
    }
    function onKey(e) { if (e.code === "Space") onHit(e); }
    function step(now) {
      if (done) return;
      if (token !== matchToken) return finish("miss");
      const el = now - start;
      if (el > period * 4) return finish("miss");
      const phase = (el % (period * 2)) / period;
      pos = phase <= 1 ? phase * 100 : (2 - phase) * 100;
      $("timingMarker").style.left = pos + "%";
      requestAnimationFrame(step);
    }
    setTimeout(() => {
      $("court").addEventListener("pointerdown", onHit);
      document.addEventListener("keydown", onKey);
    }, 120);
    requestAnimationFrame(step);
  });
}

// ---------- match flow ----------
async function matchLoop(token) {
  try {
    while (true) {
      const { winner, reason } = await playRally();
      checkAlive(token);
      setHolder(null);
      M.poss = null;
      setBallFx([]);
      setMomentum(0);
      clearAuras();
      M.score[winner]++;
      const sideOut = winner !== M.serving;
      M.serving = winner;
      Rules.endRally(M.player);
      Rules.endRally(M.cpu);
      clearRallyFx();
      updateScore();
      updateStatus();
      log(`<span class="point">Point ${winner === "player" ? "YOU" : "CPU"}: ${reason} (${M.score.player}–${M.score.cpu})</span>`);
      const { player: a, cpu: b } = M.score;
      const over = (a >= CONFIG.pointsToWin || b >= CONFIG.pointsToWin) && Math.abs(a - b) >= CONFIG.winBy;
      await showBanner(winner === "player" ? "POINT!" : "CPU POINT", reason + (sideOut && !over ? " · Side out, rotate!" : ""), winner !== "player");
      if (over) {
        $("endTitle").textContent = a > b ? "You win! 🏐" : "CPU wins!";
        $("endScore").textContent = `Final score: ${a} – ${b}`;
        $("endOverlay").classList.remove("hidden");
        return;
      }
      if (sideOut) {
        Rules.rotate(teamOf(winner));
        placeAll();
        await wait(800);
      }
    }
  } catch (e) {
    if (!(e instanceof Abort)) throw e;
  }
}

const FX_OF = { fireball: "fire", shadowStrike: "shadow", tidalSet: "tidal", sneakySeed: "seed", venomSpike: "toxic", lanternSet: "lantern" };

// Plays one rally. Returns { winner, reason }.
async function playRally() {
  const token = matchToken;
  const offSide = M.serving, defSide = other(offSide);
  const off = teamOf(offSide);
  const server = off.at[1];
  setMomentum(0);
  setPossession(offSide);
  setBallFx([]);

  // CPU may switch on defensive abilities at the start of a rally
  AI.preRally(M.cpu, defSide === "cpu", M.smart).forEach((p) => abilityFx("cpu", M.cpu, p));

  // ----- server walks behind the back line -----
  const sEl = elOf.get(server);
  const lane = Rules.lane(offSide, 1);
  sEl.style.left = XS[offSide].serve + "%";
  setHolder(offSide, 1);
  setStep(offSide, 0, "serve");
  await flyBall({ x: XS[offSide].serve, y: LANE_Y[lane] - HEAD, gy: LANE_Y[lane] }, 650, 8);

  let target, serveType, timing = "ok";
  if (offSide === "player") {
    serveType = await askServeType();
    checkAlive(token);
    target = (await askPlayer({ serve: true, serveType })).target;
    checkAlive(token);
    if (serveType === "hard") { timing = await runTiming(server.ctrl); checkAlive(token); }
  } else {
    await wait(700);
    serveType = AI.serveType(M.smart);
    timing = AI.timing(M.smart);
    target = AI.easyTarget(M.player, M.smart, Rules.servePowerEstimate(off, serveType), Rules.serveTargets(serveType));
  }
  // toss and hit
  await flyBall({ x: XS[offSide].serve, y: LANE_Y[lane] - HEAD - 14, gy: LANE_Y[lane] }, 350, 0);
  anim(server, "jump");
  if (serveType === "hard") pop(offSide, 1, CONFIG.timing[timing].label, timing === "perfect" ? "big" : timing === "poor" || timing === "miss" ? "bad" : "good");
  else pop(offSide, 1, "Float serve", "passive");
  await wait(150);
  const sv = Rules.serve(off, serveType, timing);
  setHolder(null);
  sEl.style.left = feet(offSide, 1).x + "%"; // walk back in
  if (sv.fault) {
    const tg = headPt(defSide, target);
    await flyBall({ x: offSide === "player" ? 99 : 1, y: tg.y, gy: tg.gy }, 700, 25);
    popAt(offSide === "player" ? 92 : 8, tg.y, "OUT!", "bad");
    log(`${who(offSide, server)}'s hard serve went out.`);
    await wait(400);
    return { winner: defSide, reason: `${sideWord(offSide)} ${server.name}'s serve went out` };
  }
  log(`${who(offSide, server)} ${serveType === "hard" ? "rips a hard serve" : "floats a serve"}.`);
  await flyBall(headPt(defSide, target), serveType === "hard" ? 700 : 1000, serveType === "hard" ? 22 : 32);
  if (serveType === "hard" && sv.power > 75) courtShake("s");

  let incoming = { fromOpp: true, side: defSide, pos: target, power: sv.power, kind: "serve", aim: 1 };

  // ----- rally loop -----
  while (true) {
    const side = incoming.side;
    const T = teamOf(side), O = teamOf(other(side));
    let holder, q, touch, isSet;

    if (incoming.fromOpp) {
      M.poss = side;
      setBallFx([]);
      const rc = T.at[incoming.pos];
      const r = Rules.receive(T, incoming.pos, incoming.power, incoming.kind, incoming.aim);
      if (r.error) {
        anim(rc, "shake");
        const f = feet(side, incoming.pos);
        await flyBall({ x: f.x + (side === "player" ? -4 : 4), y: f.y, gy: f.y }, 250, 0);
        pop(side, incoming.pos, incoming.kind === "serve" ? "ACE!" : "Shanked!", "bad");
        ripple(f.x, f.y, "#ffffff", 10);
        log(`${who(side, rc)} couldn't dig it${incoming.kind === "serve" ? ". Ace!" : "."}`);
        await wait(500);
        return {
          winner: other(side),
          reason: incoming.kind === "serve" ? `Ace! ${sideWord(side)} ${rc.name} couldn't return the serve`
            : `${sideWord(side)} ${rc.name} couldn't dig it`,
        };
      }
      if (r.savedBy) {
        // Nine Lives: Felimelon dives in and takes the ball
        anim(rc, "shake");
        pop(side, r.savedBy, "Nine Lives!", "ability");
        const fp = headPt(side, r.savedBy);
        spray(fp.x, fp.y + 10, "seed", 12, 50);
        await flyBall(fp, 350, 8);
        anim(T.at[r.savedBy], "dig");
        holder = r.savedBy;
      } else {
        anim(rc, "dig");
        holder = incoming.pos;
        if (r.ability) {
          pop(side, holder, r.ability, "ability");
          const f = feet(side, holder);
          spray(f.x, f.y - 6, "leaf", 14, 50);
          ripple(f.x, f.y, "#5fd35f", 12);
        } else {
          const [w, k] = r.quality >= 80 ? ["Perfect pass!", "good"] : r.quality >= 55 ? ["Nice dig!", "good"] : r.quality >= 30 ? ["Okay", ""] : ["Shaky…", "bad"];
          pop(side, holder, w, k);
        }
        popPassives(side, holder, r.passives);
        if (rc.passive.id === "prickly" && incoming.kind === "spike" && incoming.attacker) {
          incoming.attacker.poison = 3;
          const ap = posOf(teamOf(incoming.attackerSide), incoming.attacker);
          pop(side, holder, "Prickly", "passive");
          pop(incoming.attackerSide, ap, "Poisoned!", "ability");
          const g = headPt(incoming.attackerSide, ap);
          spray(g.x, g.y + 10, "toxic", 8, 30);
        }
      }
      q = r.quality; touch = 1; isSet = false;
      const bigDig = incoming.kind === "spike" && incoming.power >= 80 && q >= 55;
      swing(side, bigDig ? 2 : Rules.comboGain("pass", q), holder, bigDig ? "Big dig! Momentum swing" : null);
      updateStatus();
    } else {
      holder = incoming.pos; q = incoming.quality; touch = incoming.touch; isSet = incoming.isSet;
    }

    setHolder(side, holder);
    const hc = T.at[holder];
    const canSpike = isSet && Rules.has(hc, "spiker");

    let action;
    if (side === "player") {
      action = await askPlayer({ holderPos: holder, touch, canSpike, quality: q });
      checkAlive(token);
    } else {
      setStep("cpu", touch, canSpike ? "spike" : touch === 3 ? "free" : touch === 1 ? "bump" : "set");
      await wait(600);
      action = AI.decide(T, O, holder, touch, isSet, q, levelFor(side), M.smart);
      if (action.type === "sneaky") setStep("cpu", touch, "sneaky");
    }
    if (action.special) {
      Rules.useAbility(T, holder);
      abilityFx(side, T, holder);
      setBallFx([...M.fx, FX_OF[action.special]]);
      if (action.special !== "sneakySeed") swing(side, 1, holder);
    }

    // ----- bump / set to a teammate -----
    if (action.type === "bump" || action.type === "set") {
      const asSet = action.type === "set";
      const mate = T.at[action.target];
      const p = asSet ? Rules.set(T, holder, action.target, q, action.special === "tidalSet", action.special === "lanternSet") : Rules.bump(T, holder, action.target, q);
      anim(hc, asSet ? "jump" : "dig");
      setHolder(null);
      if (p.error) {
        const mid = feet(side, action.target);
        await flyBall({ x: (mid.x + feet(side, holder).x) / 2, y: mid.y, gy: mid.y }, 500, 15);
        pop(side, holder, asSet ? "Bad set!" : "Mishit!", "bad");
        log(`${who(side, hc)} ${asSet ? "botched the set" : "mishit the pass"}.`);
        await wait(500);
        return { winner: other(side), reason: `${sideWord(side)} ${hc.name} ${asSet ? "botched the set" : "mishit the pass"}` };
      }
      popPassives(side, holder, p.passives);
      if (action.special === "lanternSet") swing(side, 2, holder);
      swing(side, Rules.comboGain(asSet ? "set" : "pass", p.quality), holder, p.quality >= 80 && !action.special ? (asSet ? "Perfect set!" : "Perfect pass!") : null);
      log(`${who(side, hc)} ${asSet ? "sets" : "bumps"} to ${mate.name}.`);
      await flyBall(headPt(side, action.target), asSet ? 650 : 600, asSet ? 24 : 18);
      incoming = { fromOpp: false, side, pos: action.target, quality: p.quality, touch: touch + 1, isSet: asSet };
      continue;
    }

    // ----- spike -----
    if (action.type === "spike") {
      const timing = side === "player" ? await runTiming(hc.ctrl) : action.timing;
      checkAlive(token);
      const t = CONFIG.timing[timing];
      anim(hc, "jump");
      pop(side, holder, t.label, timing === "perfect" ? "big" : timing === "poor" || timing === "miss" ? "bad" : "good");
      const comboAtHit = levelFor(side);
      swing(side, t.combo, holder);
      await wait(180);
      setHolder(null);
      const res = Rules.spike(T, holder, q, O, action.target, timing, action.special, comboAtHit);
      popPassives(side, holder, res.passives);
      updateStatus();
      const tgt = headPt(other(side), action.target);
      if (res.out) {
        await flyBall({ x: side === "player" ? 99 : 1, y: tgt.y + 4, gy: tgt.gy + 4 }, 450, 6);
        popAt(side === "player" ? 92 : 8, tgt.y, "OUT!", "bad");
        log(`${who(side, hc)} spikes… out!`);
        await wait(400);
        return { winner: other(side), reason: `${sideWord(side)} ${hc.name}'s spike went out` };
      }
      if (res.blocked) {
        const blocker = O.at[res.blockerPos];
        const bp = headPt(other(side), res.blockerPos);
        anim(blocker, "jump");
        await flyBall({ x: side === "player" ? 48 : 52, y: bp.y - 4, gy: bp.gy }, 260, 2);
        pop(other(side), res.blockerPos, "BLOCKED!", "big");
        popPassives(other(side), res.blockerPos, res.blockerPassives);
        streaks(side === "player" ? 49 : 51, bp.y + 6, "#7ad8ff", 10, 6);
        courtShake("s");
        setBallFx([]);
        const fall = feet(side, holder);
        await flyBall({ x: side === "player" ? 44 : 56, y: fall.y, gy: fall.y }, 380, 8);
        log(`${who(side, hc)} spikes. Stuffed by ${who(other(side), blocker)}!`);
        await wait(400);
        return { winner: other(side), reason: `${sideWord(other(side))} ${blocker.name} blocked it` };
      }
      const lvl = levelFor(side);
      log(`${who(side, hc)} spikes${lvl >= 4 ? " with huge power" : ""}!`);
      await flyBall(tgt, Math.max(220, 400 - lvl * 30), 4);
      spikeImpact(tgt, res.power, lvl);
      if (res.poison) {
        const victim = O.at[action.target];
        victim.poison = 3; // this rally + the next two
        pop(other(side), action.target, "Poisoned!", "ability");
        log(`<span class="abil">${who(other(side), victim)} is Poisoned!</span>`);
        updateStatus();
      }
      incoming = { fromOpp: true, side: other(side), pos: action.target, power: res.power, kind: "spike", aim: res.aimMult, attacker: hc, attackerSide: side };
      continue;
    }

    // ----- sneaky seed (attack on 2) -----
    if (action.type === "sneaky") {
      anim(hc, "jump");
      setHolder(null);
      const res = Rules.sneaky(T, holder, levelFor(side));
      const tgt = headPt(other(side), action.target);
      if (res.out) {
        await flyBall({ x: side === "player" ? 99 : 1, y: tgt.y, gy: tgt.gy }, 500, 10);
        log(`${who(side, hc)}'s sneaky attack went out!`);
        return { winner: other(side), reason: `${sideWord(side)} ${hc.name}'s sneaky attack went out` };
      }
      log(`${who(side, hc)} attacks on the 2nd touch!`);
      await flyBall(tgt, 450, 10);
      spray(tgt.x, tgt.y + 6, "seed", 10, 40);
      incoming = { fromOpp: true, side: other(side), pos: action.target, power: res.power, kind: "spike", aim: res.aimMult };
      continue;
    }

    // ----- free ball -----
    anim(hc, "dig");
    setHolder(null);
    const res = Rules.freeBall(T, holder);
    const tgt = headPt(other(side), action.target);
    if (res.out) {
      await flyBall({ x: side === "player" ? 99 : 1, y: tgt.y, gy: tgt.gy }, 700, 25);
      log(`${who(side, hc)} sends it over… out!`);
      return { winner: other(side), reason: `${sideWord(side)} ${hc.name}'s free ball went out` };
    }
    log(`${who(side, hc)} sends a free ball over.`);
    await flyBall(tgt, 850, 30);
    incoming = { fromOpp: true, side: other(side), pos: action.target, power: res.power, kind: "free", aim: 1 };
  }
}

function backToBuilder() {
  matchToken++;
  if (M && M.pending) { const p = M.pending; M.pending = null; p.resolve({ type: "abort" }); }
  if (M && M.cancelServe) M.cancelServe();
  M = null;
  ["timing", "banner", "servePick", "endOverlay", "match"].forEach((id) => $(id).classList.add("hidden"));
  $("builder").classList.remove("hidden");
  tip.classList.add("hidden");
  renderBuilder();
}
$("quitMatch").addEventListener("click", backToBuilder);
$("playAgain").addEventListener("click", backToBuilder);
