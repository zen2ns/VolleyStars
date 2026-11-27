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
function rankHTML(c) {
  const r = RANKS[c.rank] || RANKS.D;
  return `<span class="rk rk-${c.rank}" style="--rk:${r.color}">${c.rank}</span>`;
}
function tooltipHTML(c) {
  const live = c.cooldown !== undefined
    ? `<div class="tip-ab">${c.cooldown > 0 ? `Ability recharging: ${c.cooldown} rall${c.cooldown === 1 ? "y" : "ies"}` : "Ability ready ✨"}${c.winded > 0 ? "<br>💨 Winded: spikes weaker" : ""}</div>` : "";
  // rank only shows on the team select screen (in a match, creatures carry a cooldown field)
  return `${c.cooldown === undefined ? rankHTML(c) + " " : ""}<b>${c.name}</b> <span class="muted">${c.classes.join(", ")}</span>` +
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
const builder = { slots: {}, looks: {}, selected: null, ult: "nuclear" };
Rules.POSITIONS.forEach((p) => { builder.slots[p] = null; });

try {
  const saved = JSON.parse(localStorage.getItem("volleystars-team-v2") || "null");
  if (saved) {
    Rules.POSITIONS.forEach((p) => { builder.slots[p] = saved.slots[p] && byId(saved.slots[p]) ? saved.slots[p] : null; });
    builder.looks = saved.looks || {};
    if (saved.ult && CONFIG.ultimates[saved.ult]) builder.ult = saved.ult;
    if (saved.difficulty) $("difficulty").value = saved.difficulty;
  }
} catch (e) { /* no saved team */ }

function saveTeam() {
  if (builder.mode === "story") { Story.saveTeam(builder.slots, builder.looks, builder.ult); return; }
  try {
    localStorage.setItem("volleystars-team-v2", JSON.stringify({
      slots: builder.slots, looks: builder.looks, difficulty: $("difficulty").value, ult: builder.ult,
    }));
  } catch (e) { /* storage not available */ }
}

// ---------- sprites: trim the empty space around each drawing so all creatures look even ----------
const SPRITE = {};
const SPRITE_DIM = {}; // trimmed drawing size in pixels, used to size creatures on court
const spriteSrc = (src) => SPRITE[src] || src;
// Inline style that shrinks small-drawing Stars (their "size") in menus, same as on court.
const sizeStyle = (c, flip = false) => {
  const t = (flip ? "scaleX(-1) " : "") + (c.size && c.size !== 1 ? `scale(${c.size})` : "");
  return t ? ` style="transform:${t.trim()};transform-origin:50% 100%"` : "";
};
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
          SPRITE_DIM[src] = { w: x1 - x0 + 1, h: y1 - y0 + 1 };
        }
      } catch (e) { /* e.g. opened as a local file: keep the original picture */ }
      resolve();
    };
    img.onerror = () => resolve();
    img.src = src;
  });
}
Promise.all(CREATURES.flatMap((c) => [...c.looks, ...(c.recolors || []).map((r) => r.img)]).map(trimSprite)).then(() => { if (!M) renderBuilder(); });

const lookOf = (c) => spriteSrc(skinImg(c)); // the Locker Room skin (or default look)
const placedPos = (id) => Rules.POSITIONS.find((p) => builder.slots[p] === id);
const usedCount = (id) => Rules.POSITIONS.filter((p) => builder.slots[p] === id).length;
const storyLimit = (id) => (builder.mode === "story" ? Story.owned(id) : Infinity);

// Open the team builder for "free" play or a "story" battle ({ region, battle }).
// Free play and story each remember their own last team.
function enterBuilder(mode, opts = {}) {
  if (builder.mode !== "story") builder._free = { slots: { ...builder.slots }, looks: { ...builder.looks }, ult: builder.ult };
  builder.mode = mode;
  builder.selected = null;
  if (mode === "story") {
    builder.region = opts.region;
    builder.battle = opts.battle;
    const t = Story.team();
    builder.slots = t.slots; builder.looks = t.looks; builder.ult = t.ult;
    // drop anything you no longer have enough copies of
    Rules.POSITIONS.forEach((p) => { const id = builder.slots[p]; if (id && usedCount(id) > Story.owned(id)) builder.slots[p] = null; });
  } else if (builder._free) {
    builder.slots = builder._free.slots; builder.looks = builder._free.looks; builder.ult = builder._free.ult || "nuclear";
  }
  setupOpponent();
  renderBuilder();
  showScreen("builder");
}

function renderRoster() {
  const roster = $("roster");
  roster.innerHTML = "";
  const order = "SABCD";
  const list = builder.mode === "story" ? CREATURES.filter((c) => Story.owned(c.id) > 0) : CREATURES;
  [...list].sort((a, b) => order.indexOf(a.rank) - order.indexOf(b.rank)).forEach((c) => {
    const card = document.createElement("div");
    const count = usedCount(c.id);
    card.className = "card" + (builder.selected === c.id ? " selected" : "");
    card.innerHTML = `
      ${builder.mode === "story" ? `<span class="on-team${count >= Story.owned(c.id) ? " full" : ""}">${count} / ${Story.owned(c.id)}</span>`
        : count ? `<span class="on-team">×${count}</span>` : ""}
      <img src="${lookOf(c)}" alt="${c.name}"${sizeStyle(c)}>
      <div class="name">${rankHTML(c)} ${c.name}</div>
      ${badgesHTML(c)}
      ${STATS.map(([k, short, color]) => `
        <div class="stat-row"><span>${short}</span>
          <div class="stat-bar"><div style="width:${c[k]}%;background:${color}"></div></div>
          <span>${c[k]}</span></div>`).join("")}
      <div class="abil"><b>${c.passive.name}</b> (passive)<br><b>${c.active.name}</b> (active)</div>`;
    card.addEventListener("click", () => {
      builder.selected = builder.selected === c.id ? null : c.id;
      Sound.play("click");
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
      (id ? `<img src="${lookOf(byId(id))}" alt=""${sizeStyle(byId(id))}><div class="cname">${byId(id).name}</div>` : "") +
      `<span class="pos-note">${POS_NOTE[p]}</span>`;
    if (id) attachTooltip(cell, () => byId(builder.slots[p]));
    cell.addEventListener("click", () => {
      tip.classList.add("hidden");
      if (builder.selected) {
        if (builder.slots[p] !== builder.selected && usedCount(builder.selected) >= storyLimit(builder.selected)) {
          $("builderMsg").textContent = `You only have ${Story.owned(builder.selected)} ${byId(builder.selected).name}. Recruit more in Story battles!`;
          Sound.play("miss");
          return;
        }
        builder.slots[p] = builder.selected; // stays selected so you can place copies
        Sound.play("click");
      } else if (id) {
        builder.slots[p] = null;
      } else {
        $("builderMsg").textContent = "Pick a Star from the list first.";
        return;
      }
      renderBuilder();
    });
    grid.appendChild(cell);
  });
}

function renderUltPick() {
  const box = $("ultPick");
  box.innerHTML = "";
  let ids = Object.keys(CONFIG.ultimates);
  if (builder.mode === "story") {
    ids = Story.ults();
    if (!ids.includes(builder.ult)) builder.ult = ids[0] || null;
    if (!ids.length) {
      box.innerHTML = '<p class="muted small ult-none">No ultimates yet. Win a Regional Championship to unlock one!</p>';
      return;
    }
  }
  ids.map((id) => [id, CONFIG.ultimates[id]]).forEach(([id, u]) => {
    const b = document.createElement("button");
    b.className = "ult-card" + (builder.ult === id ? " on" : "");
    b.innerHTML = `<b>${u.name}</b><span>${u.text}</span>`;
    b.addEventListener("click", () => { builder.ult = id; Sound.play("click"); renderBuilder(); });
    box.appendChild(b);
  });
}

// ---------- opponent (path checkpoint or random CPU team) ----------
const DIFF_NAME = { easy: "Easy", normal: "Medium", hard: "Hard" };
function setupOpponent() {
  if (builder.mode === "story") {
    const reg = REGIONS[builder.region], bt = reg.battles[builder.battle];
    const sk = storySkill(builder.region, builder.battle);
    builder.opp = {
      team: { ...bt.team }, looks: {}, ult: bt.ult, smart: sk.smart, timing: sk.timing,
      name: bt.name, tagline: `${reg.name} · ${bt.champion ? "Regional Championship" : `Battle ${builder.battle + 1} of 5`}`,
    };
    return;
  }
  const diff = $("difficulty").value, d = CONFIG.difficulty[diff];
  const at = AI.buildTeam(CREATURES, d.team);
  const team = {}, looks = {};
  Rules.POSITIONS.forEach((p) => { team[p] = at[p].id; looks[p] = at[p].looks.indexOf(at[p].img); });
  builder.opp = {
    team, looks, ult: Object.keys(CONFIG.ultimates)[Math.floor(Math.random() * 3)],
    smart: d.smart, timing: d.timing, name: "Random CPU team", tagline: `${DIFF_NAME[diff]} difficulty`,
  };
}
function renderOpponent() {
  if (!builder.opp) setupOpponent();
  const o = builder.opp;
  $("oppName").textContent = o.name;
  $("oppTag").textContent = o.tagline;
  const grid = $("oppGrid");
  grid.innerHTML = "";
  Rules.POSITIONS.forEach((p) => {
    const c = byId(o.team[p]);
    const cell = document.createElement("div");
    cell.style.gridRow = Rules.lane("cpu", p) + 1;
    cell.style.gridColumn = Rules.isFront(p) ? 1 : 2;
    cell.className = "bcell filled opp-cell";
    const src = spriteSrc(c.looks[o.looks[p] || 0] || c.looks[0]);
    const flip = sizeStyle(c, (c.faces || "left") === "right");
    cell.innerHTML = `<span class="pos-num">${p}</span><img src="${src}" alt=""${flip}><div class="cname">${rankHTML(c)} ${c.name}</div>`;
    attachTooltip(cell, () => c);
    grid.appendChild(cell);
  });
  const skill = o.smart >= 0.6 ? "Hard" : o.smart >= 0.2 ? "Medium" : "Easy";
  $("oppInfo").innerHTML = `Ultimate: <b>${o.ult ? CONFIG.ultimates[o.ult].name : "None"}</b> · CPU skill: <b>${skill}</b>`;
}

function renderBuilder() {
  renderUltPick();
  renderOpponent();
  const path = builder.mode === "story";
  $("builderTitle").textContent = path
    ? `${REGIONS[builder.region].name}: ${REGIONS[builder.region].battles[builder.battle].champion ? "🏆 Championship" : `Battle ${builder.battle + 1}`}`
    : "Free Play";
  $("diffLabel").classList.toggle("hidden", path);
  $("oppReroll").classList.toggle("hidden", path);
  $("startMatch").textContent = path ? "Challenge!" : "Start match";
  $("randomTeam").classList.toggle("hidden", path);
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
$("difficulty").addEventListener("change", () => { saveTeam(); setupOpponent(); renderBuilder(); });
$("oppReroll").addEventListener("click", () => { setupOpponent(); Sound.play("click"); renderBuilder(); });
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
const HEAD = 16; // how far above the feet the ball sits

function feet(side, pos) {
  return { x: XS[side][Rules.isFront(pos) ? "front" : "back"], y: LANE_Y[Rules.lane(side, pos)] };
}
// How tall the creature's drawing is on court (in % of court height); bigger creatures hold the ball higher
function headH(side, pos) { const c = M && teamOf(side).at[pos]; return c && c._headH ? c._headH : HEAD - 2.5; }
function headPt(side, pos) { const f = feet(side, pos); return { x: f.x, y: f.y - headH(side, pos) - 2.5, gy: f.y }; }
// Creatures show bigger when their drawing is bigger; S and A ranks get a minimum boost.
function sizeOf(c) {
  const dim = SPRITE_DIM[c.img];
  const byArt = dim ? Rules.clamp(Math.max(dim.w, dim.h) / 140, 1, 1.9) : 1;
  const r = RANKS[c.rank] || RANKS.D;
  return Math.max(r.minSize, byArt) * (r.sizeBoost || 1) * (c.size || 1);
}

const elOf = new Map(); // creature instance -> its element on court

function startMatch() {
  const diff = $("difficulty").value;
  const o = builder.opp;
  const cpuAt = {};
  Rules.POSITIONS.forEach((p) => { cpuAt[p] = Rules.makeInstance(byId(o.team[p]), o.looks[p] || 0); });
  const at = {};
  Rules.POSITIONS.forEach((p) => {
    const base = byId(builder.slots[p]);
    at[p] = Rules.makeInstance(base, 0);
    at[p].img = skinImg(base);
  });
  matchToken++;
  M = {
    diff, smart: o.smart, timingSkill: o.timing, mode: builder.mode, region: builder.region, battle: builder.battle,
    player: Rules.makeTeam("player", at, 1, builder.ult),
    cpu: Rules.makeTeam("cpu", cpuAt, 1, o.ult),
    score: { player: 0, cpu: 0 },
    serving: Math.random() < 0.5 ? "player" : "cpu",
    pending: null, armed: null, freeOn: false, ultArmed: false,
    mom: 0, poss: null, fx: new Set(),
    ball: { x: 50, y: 50, gy: 60 },
  };
  setupTeams();
  $("log").innerHTML = "";
  $("builder").classList.add("hidden");
  $("match").classList.remove("hidden");
  buildCourt();
  updateScore();
  buildFlames();
  setMomentum(0);
  updateUltHUD();
  refreshControls();
  if (M.mode === "story") {
    const champ = REGIONS[M.region].battles[M.battle].champion;
    M.pointsToWin = champ ? 7 : 3;
    M.winBy = champ ? 2 : 1;
  } else {
    M.pointsToWin = CONFIG.pointsToWin;
    M.winBy = CONFIG.winBy;
  }
  log(`Match start! ${M.serving === "player" ? "You serve" : "CPU serves"} first. First to ${M.pointsToWin}.`);
  matchLoop(matchToken);
}

// ---------- team identity: names, logos and colors (Story mode) ----------
function mixHex(hex, to, t) { // blend a "#rrggbb" color toward another by t (0-1)
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const a = p(hex), b = p(to);
  return "#" + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, "0")).join("");
}
function setupTeams() {
  const story = M.mode === "story";
  const bt = story ? REGIONS[M.region].battles[M.battle] : null;
  const me = Story.teamInfo();
  M.teams = story
    ? { player: { name: me.name, logo: me.logo, color: me.color }, cpu: { name: bt.name, logo: bt.logo || "ball", color: bt.color || "#d93a3a" } }
    : { player: { name: "YOU", color: "#1f63c9" }, cpu: { name: "CPU", color: "#c92a3a" } };
  const root = document.documentElement.style;
  ["player", "cpu"].forEach((side) => {
    const col = M.teams[side].color, k = side === "player" ? "you" : "cpu";
    root.setProperty(`--${k}-c`, col);
    root.setProperty(`--${k}-l`, mixHex(col, "#ffffff", 0.35)); // lighter, for text and the momentum bar
    root.setProperty(`--${k}-xl`, mixHex(col, "#ffffff", 0.75));
  });
  if (!story) { // Free Play keeps the classic blue vs red
    root.setProperty("--you-l", "#4fa3ff"); root.setProperty("--cpu-l", "#ff5c6c");
    root.setProperty("--you-xl", "#bfe6ff"); root.setProperty("--cpu-xl", "#ffd0d4");
  }
  document.querySelector(".score-box.you .label").textContent = story ? me.name : "YOU";
  document.querySelector(".score-box.cpu .label").textContent = story ? bt.name : "CPU";
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
      // face the net: player team looks right, CPU team looks left
      const facesLeft = (c.faces || "left") === "left";
      el.className = `crt ${side}` + ((side === "player") === facesLeft ? " flip" : "");
      el.innerHTML = `<div class="badge-fx"></div><div class="shadow"></div><div class="jumper"><div class="bob"><img src="${spriteSrc(c.img)}" alt="${c.name}"></div></div><div class="tag">${c.name}</div>`;
      const size = sizeOf(c);
      el.style.width = 7.5 * size + "%";
      const dim = SPRITE_DIM[c.img] || { w: 1, h: 1 };
      c._headH = 2 * 7.5 * size * Math.min(0.9, dim.h / dim.w); // drawing height as % of court height
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
  $("court").style.setProperty("--px", fxScale() + "px");
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
      // a little pixel flame over the head shows buffs and poison (green glow only ever means "pass here")
      const buffOn = (["deepRoots", "cactusCover", "leapBlock", "hornWall", "greatWall", "bubblePass", "slipstream", "splashGuard",
        "highTide", "coldSnap", "snowdrift", "glacier"].includes(c.active.id) && !!T.buffs[c.active.id]);
      const buffFlame = { hornWall: "flame_gold", greatWall: "flame_gold", bubblePass: "flame_tidal", slipstream: "flame_tidal", splashGuard: "flame_tidal",
        highTide: "flame_tidal", coldSnap: "flame_ice", snowdrift: "flame_ice", glacier: "flame_ice" }[c.active.id] || "flame_seed";
      const badge = c.burn > 0 ? "flame_fire" : c.poison > 0 ? "flame_toxic" : c.chill > 0 ? "flame_ice" : buffOn ? buffFlame : null;
      setBadge(el, badge);
      el.classList.toggle("recovering", !!c.recovering);
      el.classList.toggle("fortress", !!T.buffs.fortress && Rules.isFront(p));
      el.classList.toggle("roots", (c.active.id === "deepRoots" && !!T.buffs.deepRoots) || (c.active.id === "cactusCover" && !!T.buffs.cactusCover));
    });
  });
}

// tiny looping pixel flames used as status badges
const badgeEls = new Set();
function setBadge(el, name) {
  const b = el.querySelector(".badge-fx");
  if (!name) { b.style.display = "none"; badgeEls.delete(b); return; }
  const S = fxScale(), w = 14 * S, h = 20 * S;
  b.style.display = "block";
  b.style.width = w + "px"; b.style.height = h + "px";
  b.style.backgroundImage = `url(assets/fx/${name}.png)`;
  b.style.backgroundSize = `${6 * w}px ${h}px`;
  b._w = w;
  badgeEls.add(b);
}
let badgeFrame = 0;
setInterval(() => {
  badgeFrame = (badgeFrame + 1) % 6;
  badgeEls.forEach((b) => { b.style.backgroundPosition = `${-badgeFrame * b._w}px 0`; });
}, 100);

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
  block: ["BLOCK?", "w-bump"],
};
function setStep(side, touch, word) {
  const [w, cls] = WORDS[word];
  const whoTxt = side === "cpu" ? '<span class="who">CPU · </span>' : side === "player" && word === "serve" ? "YOUR " : "";
  const touchTxt = touch ? `<span class="t">TOUCH ${touch}/3 · </span>` : "";
  $("step").innerHTML = `${whoTxt}${touchTxt}<span class="${cls}">${w}</span>`;
  $("step").classList.toggle("cpu-turn", side === "cpu");
}

// ---------- pixel effect sprites (assets/fx, made by tools/make_fx.py) ----------
// Every sheet is a row of frames. Effects are drawn on the same 2-pixel grid as the
// creature art; fxScale() turns one effect pixel into whole screen pixels so they stay crisp.
function sheetInfo(name) {
  if (name.startsWith("ring_")) { const t = +name.slice(-1); const w = [0, 48, 60, 72][t]; return { w, h: w, frames: 8 }; }
  if (name.startsWith("boom_")) return { w: 64, h: 64, frames: 10 };
  if (name.startsWith("puff_")) return { w: 32, h: 32, frames: 10 };
  if (name.startsWith("wave_")) return { w: 64, h: 24, frames: 6 };
  if (name.startsWith("flame_")) return { w: 14, h: 20, frames: 6 };
  if (name === "shield") return { w: 14, h: 44, frames: 4 };
  if (name === "sparkle") return { w: 24, h: 24, frames: 6 };
  return { w: 32, h: 32, frames: 1 };
}
const FX_NAMES = [
  ...["fire", "hot", "shadow", "tidal", "toxic", "seed", "lantern", "ice", "volt"].flatMap((k) => [1, 2, 3].map((t) => `ring_${k}_${t}`)),
  ...["fire", "shadow", "toxic", "seed", "lantern", "tidal", "ice", "volt"].map((k) => "boom_" + k),
  ...["fire", "shadow", "toxic", "seed", "lantern", "ghost", "dust", "gold", "tidal", "ice", "volt"].map((k) => "puff_" + k),
  ...["white", "gold", "orange", "purple", "blue", "green", "toxic"].map((k) => "wave_" + k),
  ...["fire", "shadow", "tidal", "toxic", "seed", "lantern", "gold", "ice", "volt"].map((k) => "flame_" + k),
  "shield", "sparkle",
];
FX_NAMES.forEach((n) => { const i = new Image(); i.src = `assets/fx/${n}.png`; }); // preload

function fxScale() {
  const w = $("court").getBoundingClientRect().width || 1000;
  return Math.max(1, Math.round(w / 650));
}
// Play a sprite sheet at (x%, y%) of the court. anchor "center" or "bottom" (bottom sits on the point).
function playSprite(name, x, y, { scale = fxScale(), frameMs = 70, loop = false, anchor = "center", layer = "fxLayer" } = {}) {
  const info = sheetInfo(name);
  const el = document.createElement("div");
  el.className = "fx-sprite";
  const w = info.w * scale, h = info.h * scale;
  el.style.width = w + "px";
  el.style.height = h + "px";
  el.style.left = x + "%";
  el.style.top = y + "%";
  el.style.marginLeft = -w / 2 + "px";
  el.style.marginTop = (anchor === "bottom" ? -h : -h / 2) + "px";
  el.style.backgroundImage = `url(assets/fx/${name}.png)`;
  el.style.backgroundSize = `${info.frames * w}px ${h}px`;
  $(layer).appendChild(el);
  let f = 0;
  const token = M ? matchToken : -1;
  const tick = () => {
    if (!el.isConnected) return;
    if (M && token !== matchToken) { el.remove(); return; }
    el.style.backgroundPosition = `${-f * w}px 0`;
    f++;
    if (f >= info.frames) {
      if (!loop) { setTimeout(() => el.remove(), frameMs); return; }
      f = 0;
    }
    el._timer = setTimeout(tick, frameMs);
  };
  tick();
  return el;
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
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  const col = M.mom >= 0 ? css(M.mom >= 5 ? "--you-xl" : "--you-l") : css(M.mom <= -5 ? "--cpu-xl" : "--cpu-l");
  fill.style.background = col;
  fill.style.boxShadow = Math.abs(M.mom) >= 3 ? `0 0 12px ${col}` : "none";
  updateFlames();
}
function swing(side, n, pos, text) {
  if (n <= 0) return;
  const T = teamOf(side);
  if (T.buffs.comboStar) n *= 2; // Combo Star ultimate
  const wasReady = Rules.ultReady(T);
  Rules.chargeUlt(T, n);
  if (!wasReady && Rules.ultReady(T)) { Sound.play("perfect"); log(`<span class="abil">${side === "player" ? "Your" : "CPU's"} ultimate is ready!</span>`); }
  updateUltHUD();
  Sound.play("swing");
  setMomentum(M.mom + (side === "player" ? n : -n));
  if (text) pop(side, pos, text, "passive");
}
function setPossession(side) { M.poss = side; updateFlames(); }

// Which pixel flame ring the ball wears: the ability's color, or plain fire for momentum
const RING_OF = { none: "fire", fire: "hot", shadow: "shadow", tidal: "tidal", toxic: "toxic", seed: "seed", lantern: "lantern", volt: "volt" };
function buildFlames() { /* the ring is a sprite now; nothing to build */ }
function primaryFx() {
  for (const k of ["shadow", "toxic", "volt", "tidal", "lantern", "fire", "seed"]) if (M.fx.has(k)) return k;
  return "none";
}
let ringFrame = 0, ringInfo = null;
setInterval(() => {
  if (!ringInfo) return;
  ringFrame = (ringFrame + 1) % ringInfo.frames;
  $("ballFlames").style.backgroundPosition = `${-ringFrame * ringInfo.w * ringInfo.s}px 0`;
}, 90);
function updateFlames() {
  if (!M) return;
  const lvl = M.poss ? levelFor(M.poss) : 0;
  const kind = primaryFx();
  const f = $("ballFlames");
  const show = lvl > 0 || kind !== "none";
  f.classList.toggle("on", show);
  if (!show) { ringInfo = null; return; }
  const tier = lvl >= 5 ? 3 : lvl >= 3 ? 2 : 1;
  const pal = kind === "none" && lvl >= 5 ? "hot" : RING_OF[kind];
  const name = `ring_${pal}_${tier}`;
  const info = sheetInfo(name), sc = fxScale();
  ringInfo = { ...info, s: sc };
  const w = info.w * sc;
  f.style.width = f.style.height = w + "px";
  f.style.marginLeft = f.style.marginTop = -w / 2 + "px";
  f.style.backgroundImage = `url(assets/fx/${name}.png)`;
  f.style.backgroundSize = `${info.frames * w}px ${w}px`;
  f.style.backgroundPosition = `${-ringFrame * w}px 0`;
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

function particle(x, y, kind, drift = null, color = null) {
  const el = document.createElement("div");
  el.className = "particle " + kind + (drift ? " drift" : "");
  if (color) el.style.setProperty("--pc", color);
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
// flat pixel shockwave on the floor
const WAVE_OF = { "#ffffff": "white", "#ffd65c": "gold", "#ffcc33": "gold", "#ffb347": "gold", "#ff6a00": "orange", "#ffb020": "orange",
  "#ff8c1a": "orange", "#b14dff": "purple", "#4fc3ff": "blue", "#bfeaff": "blue", "#5fd35f": "green", "#7dff5a": "toxic" };
function ripple(x, gy, color, size = 12) {
  const k = Math.max(1, Math.round(size / 12));
  playSprite("wave_" + (WAVE_OF[color] || "gold"), x, gy, { scale: fxScale() * k, frameMs: 60 });
}
// little pixel sparks shooting outward
function streaks(x, y, color, n = 8, len = 6) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.3, r = len * (9 + Math.random() * 6);
    particle(x, y, "spark", [Math.cos(a) * r, Math.sin(a) * r], color);
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
function flyBall(to, ms, arc, { wobble = 0, trail = null } = {}) {
  const token = matchToken;
  const from = { ...M.ball };
  const ballEl = $("ball");
  ballEl.dataset.flying = "1"; // the ball only spins while it's in the air
  return new Promise((resolve, reject) => {
    const start = performance.now();
    let frame = 0;
    function step(now) {
      if (token !== matchToken) { delete ballEl.dataset.flying; return reject(new Abort()); }
      const t = Math.min(1, (now - start) / ms);
      const x = from.x + (to.x - from.x) * t + Math.sin(t * Math.PI * 5) * wobble * (1 - t);
      const y = from.y + (to.y - from.y) * t - Math.sin(Math.PI * t) * arc + Math.cos(t * Math.PI * 4) * wobble * 0.6 * Math.sin(Math.PI * t);
      const gy = from.gy + (to.gy - from.gy) * t;
      setBall({ x, y, gy });
      const kinds = [...M.fx];
      if (trail) kinds.push(trail);
      if (M.poss && levelFor(M.poss) >= 2) kinds.push("ember");
      if (kinds.length && frame % 2 === 0) particle(x, y, kinds[(frame / 2) % kinds.length]);
      frame++;
      if (t < 1) requestAnimationFrame(step);
      else { setBall(to); delete ballEl.dataset.flying; resolve(); }
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
  el.style.top = (kind === "passive" ? f.y + 7 + n * 3.5 : f.y - headH(side, pos) - 1.5 - n * 4) + "%";
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
    case "fireball": playSprite("puff_fire", h.x, h.y + 4); streaks(h.x, h.y + 6, "#ffc83a", 8, 5); break;
    case "shadowStrike": playSprite("puff_shadow", h.x, h.y + 4); streaks(h.x, h.y + 6, "#c58bff", 8, 5); break;
    case "venomSpike": playSprite("puff_toxic", h.x, h.y + 4); streaks(h.x, h.y + 6, "#9dff5a", 8, 5); break;
    case "tidalSet": playSprite("puff_tidal", f.x, f.y, { anchor: "bottom" }); ripple(f.x, f.y, "#4fc3ff", 14); break;
    case "sneakySeed": playSprite("puff_seed", h.x, h.y + 4); break;
    case "lanternSet": {
      playSprite("puff_lantern", h.x, h.y + 4);
      // the other team's front row gets spooked: little purple ghost flames over each blocker
      const oSide = other(side), O = teamOf(oSide);
      Rules.FRONT.forEach((bp) => {
        anim(O.at[bp], "shake");
        pop(oSide, bp, "Spooked!", "bad");
        const g = headPt(oSide, bp);
        const a = playSprite("flame_shadow", g.x - 1.2, g.y + 4, { anchor: "bottom", loop: true, frameMs: 80 });
        const b = playSprite("flame_shadow", g.x + 1.4, g.y + 6, { anchor: "bottom", loop: true, frameMs: 95 });
        setTimeout(() => { a.remove(); b.remove(); }, 1400);
      });
      break;
    }
    case "hornWall": playSprite("puff_gold", f.x, f.y - 8); addShield(side, pos); break;
    case "deepRoots": playSprite("puff_seed", f.x, f.y - 4); ripple(f.x, f.y, "#5fd35f", 12); break;
    case "coldSnap": case "snowdrift":
      playSprite("puff_ice", h.x, h.y + 4); ripple(f.x, f.y, "#4fc3ff", 12); break;
    case "glacier":
      Rules.POSITIONS.forEach((p) => { const ff = feet(side, p); playSprite("puff_ice", ff.x, ff.y - 6); });
      flash("#bfe9ff"); break;
    case "highTide":
      Rules.POSITIONS.forEach((p) => { const ff = feet(side, p); playSprite("puff_tidal", ff.x, ff.y, { anchor: "bottom" }); });
      Sound.play("water"); break;
    case "joltSet": playSprite("puff_volt", h.x, h.y + 4); streaks(h.x, h.y + 6, "#fff27a", 8, 5); break;
    case "thunderSet":
      playSprite("puff_volt", h.x, h.y + 4, { scale: fxScale() + 1 }); streaks(h.x, h.y + 6, "#fff27a", 14, 8);
      flash("#fff27a"); courtShake("s"); break;
    case "headbutt": playSprite("puff_gold", h.x, h.y + 6); courtShake("s"); break;
    case "frostfireSet": playSprite("puff_fire", h.x - 2, h.y + 4); playSprite("puff_ice", h.x + 2, h.y + 4); break;
    case "undertowSet": playSprite("puff_tidal", h.x, h.y + 4); streaks(h.x, h.y + 6, "#4fc3ff", 8, 5); break;
    case "groundPound": playSprite("puff_dust", f.x, f.y, { anchor: "bottom" }); ripple(f.x, f.y, "#c9a56a", 14); courtShake("s"); break;
    case "jumpstart": case "overcharge": playSprite("puff_volt", h.x, h.y + 4); streaks(h.x, h.y + 6, "#fff27a", 8, 5); break;
    case "eruption":
      playSprite("puff_fire", h.x, h.y + 4, { scale: fxScale() + 1 }); streaks(h.x, h.y + 6, "#ff7a1a", 12, 7); courtShake("s"); break;
    case "magmaSpit": playSprite("puff_fire", h.x, h.y + 4); streaks(h.x, h.y + 6, "#ff7a1a", 8, 5); break;
    case "bubblePass": case "slipstream": case "splashGuard":
      playSprite("puff_tidal", f.x, f.y, { anchor: "bottom" }); ripple(f.x, f.y, "#4fc3ff", 12); Sound.play("water"); break;
    case "greatWall":
      playSprite("puff_gold", f.x, f.y - 8);
      [0, 1, 2].forEach((ln) => {
        const el = playSprite("shield", side === "player" ? 47 : 53, LANE_Y[ln] - 9, { loop: true, frameMs: 110 });
        el.classList.add("shield-fx");
      });
      Sound.play("shield");
      break;
    case "cactusCover":
      playSprite("puff_seed", f.x, f.y - 6);
      Rules.POSITIONS.filter((p) => p !== pos && Rules.dist(side, p, pos) === 1).forEach((p) => {
        const ff = feet(side, p);
        ripple(ff.x, ff.y, "#5fd35f", 10);
      });
      break;
    case "stampede":
      Rules.POSITIONS.forEach((p) => {
        const ff = feet(side, p);
        playSprite("puff_dust", ff.x, ff.y, { anchor: "bottom" });
        anim(team.at[p], "dig");
      });
      courtShake("s");
      break;
  }
  updateStatus();
}
function addShield(side, pos) {
  const el = playSprite("shield", side === "player" ? 47 : 53, feet(side, pos).y - 9, { loop: true, frameMs: 110 });
  el.classList.add("shield-fx");
}
function clearRallyFx() {
  document.querySelectorAll(".shield-fx").forEach((el) => el.remove());
}

// Big, satisfying hit landing: a pixel explosion that matches the ball's ability,
// drawn bigger (chunkier) and with more shake the more power and momentum there is.
const BOOM_OF = { fire: "fire", flame: "fire", shadow: "shadow", toxic: "toxic", tidal: "tidal", seed: "seed", lantern: "lantern", volt: "volt" };
const WAVE_COLOR = { fire: "#ff6a00", flame: "#ffb020", shadow: "#b14dff", toxic: "#7dff5a", tidal: "#4fc3ff", seed: "#5fd35f", lantern: "#ff8c1a", spark: "#ffd65c", volt: "#4fc3ff" };
function spikeImpact(pt, power, level, nuke = false) {
  // Big explosions only for genuinely huge spikes (about one every three rallies)
  const tier = nuke || power >= CONFIG.bigBoomPower ? 3 : power >= CONFIG.boomPower ? 2 : power >= 80 ? 1 : 0;
  Sound.play(nuke ? "nuke" : tier >= 3 ? "bigboom" : tier === 2 ? "boom" : tier === 1 ? "dig" : "spark");
  if (nuke) {
    const S0 = fxScale();
    playSprite("boom_fire", pt.x, pt.y + 2, { scale: S0 + 3, frameMs: 75 });
    setTimeout(() => M && playSprite("boom_fire", pt.x - 4, pt.y + 10, { scale: S0 + 1, frameMs: 70 }), 120);
    setTimeout(() => M && playSprite("boom_fire", pt.x + 4, pt.y + 8, { scale: S0 + 1, frameMs: 70 }), 200);
    setTimeout(() => M && flash("#ffffff"), 150);
  }
  const kinds = [...M.fx];
  if (!kinds.length) kinds.push(tier >= 2 ? "flame" : "spark");
  const x = pt.x, y = pt.y + 8, gy = pt.gy;
  const S = fxScale();
  if (tier >= 1) courtShake(["s", "s", "m", "l"][tier]);
  kinds.forEach((k, i) => {
    setTimeout(() => {
      if (!M) return;
      if (k === "spark") {
        playSprite(tier >= 1 ? "puff_gold" : "sparkle", x, y, { scale: S + (tier >= 1 ? 1 : 0) });
      } else if (tier === 0) {
        playSprite("puff_" + BOOM_OF[k], x, y, { scale: S + 1 });
      } else {
        const name = "boom_" + BOOM_OF[k];
        playSprite(name, x, k === "tidal" ? gy : y, { scale: S + (tier >= 2 ? 1 : 0) + (tier >= 3 ? 1 : 0), anchor: k === "tidal" ? "bottom" : "center", frameMs: 60 });
      }
    }, i * 70);
  });
  ripple(x, gy, WAVE_COLOR[kinds[0]], 8 + tier * 6);
  if (tier >= 2) streaks(x, y, WAVE_COLOR[kinds[0]], 6 + tier * 3, 5 + tier);
  if (tier >= 2) flash(WAVE_COLOR[kinds[0]]);
  if (tier >= 3) flash("#ffffff");
}

// ---------- huge spikes: a slow-motion windup, then a blur of a smash ----------
function slowmo(on, x, y) {
  const el = $("slowmo");
  if (on) { el.style.setProperty("--sx", x + "%"); el.style.setProperty("--sy", y + "%"); }
  el.classList.toggle("on", on);
}
function jumperOf(side, pos) {
  const j = elOf.get(teamOf(side).at[pos]).querySelector(".jumper");
  j.classList.remove("jump", "dig", "shake", "smash", "hang", "hang-high", "crouch-deep", "crouch", "lean", "ghosting");
  void j.offsetWidth;
  return j;
}
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Crazy spikes get one of several windups at random (never the same one twice in a row)
const EPIC_STYLES = ["charge", "skyhigh", "quake", "timestop"];
async function spikeWindup(side, pos, kind) {
  const style = pick(EPIC_STYLES.filter((s) => s !== M.lastEpic));
  M.lastEpic = style;
  const j = jumperOf(side, pos);
  const h = headPt(side, pos);
  const color = WAVE_COLOR[kind] || "#ffd65c";
  const r = $("court").getBoundingClientRect();
  const toPx = (dx, dy) => [(dx * r.width) / 100, (dy * r.height) / 100];
  Sound.play("ult");

  if (style === "charge") {
    // hangs in the air while energy gathers into the ball
    j.classList.add("hang");
    slowmo(true, h.x, h.y);
    const lift = flyBall({ x: M.ball.x, y: M.ball.y - 6, gy: M.ball.gy }, 820, 0);
    const charge = setInterval(() => {
      if (!M) return;
      for (let i = 0; i < 3; i++) {
        const a = Math.random() * Math.PI * 2, d = 6 + Math.random() * 5;
        const ox = Math.cos(a) * d, oy = Math.sin(a) * d * 2;
        particle(M.ball.x + ox, M.ball.y + oy, "spark", toPx(-ox, -oy), color);
      }
    }, 90);
    try { await lift; } finally { clearInterval(charge); }
    await wait(120);
  } else if (style === "skyhigh") {
    // tosses the ball sky-high, leaps after it and hammers it down like a meteor
    slowmo(true, h.x, Math.max(h.y - 25, 5));
    const top = { x: M.ball.x, y: -6, gy: M.ball.gy };
    await flyBall(top, 420, 0);
    j.classList.add("hang-high");
    await wait(380);
    const hit = { x: h.x + (side === "player" ? 2 : -2), y: h.y - 14, gy: M.ball.gy };
    streaks(hit.x, hit.y - 8, color, 8, 6);
    await flyBall(hit, 300, 0);
    playSprite("sparkle", hit.x, hit.y);
  } else if (style === "quake") {
    // crouches deep while the court rumbles harder and harder, then rockets up
    j.classList.add("crouch-deep");
    slowmo(true, h.x, h.y);
    const f = feet(side, pos);
    flyBall({ x: M.ball.x, y: M.ball.y + 2, gy: M.ball.gy }, 300, 0);
    for (let k = 0; k < 4; k++) {
      courtShake(k < 2 ? "s" : "m");
      ripple(f.x, f.y, color, 8 + k * 6);
      playSprite("puff_dust", f.x + (k % 2 ? 3 : -3), f.y, { anchor: "bottom" });
      if (k === 3) playSprite("puff_dust", f.x, f.y, { anchor: "bottom", scale: fxScale() + 1 });
      Sound.play("bump");
      await wait(200 - k * 30);
    }
    const jj = jumperOf(side, pos);
    jj.classList.add("hang-high");
    streaks(f.x, f.y - 4, color, 10, 6);
    await flyBall({ x: h.x + (side === "player" ? 1.5 : -1.5), y: h.y - 16, gy: M.ball.gy }, 300, 0);
    await wait(120);
  } else {
    // time stops: the colour drains out, the spiker flickers with afterimages, then BANG
    const sm = $("slowmo");
    sm.classList.add("timestop");
    slowmo(true, h.x, h.y);
    j.classList.add("hang", "ghosting");
    await flyBall({ x: M.ball.x, y: M.ball.y - 4, gy: M.ball.gy }, 250, 0);
    for (let k = 0; k < 3; k++) {
      await wait(180);
      Sound.play("tick");
      ripple(M.ball.x, M.ball.y, "#ffffff", 4 + k * 3);
    }
    await wait(120);
    sm.classList.remove("timestop");
  }
  const jj = jumperOf(side, pos);
  jj.classList.add("smash");
  slowmo(false);
  flash("#ffffff");
}

// Normal spikes: a quick, slightly different little windup each time so the hit reads
async function quickWindup(side, pos) {
  const j = jumperOf(side, pos);
  const h = headPt(side, pos);
  const style = pick(["hop", "lean", "toss"]);
  j.style.setProperty("--lean", side === "player" ? "-14deg" : "14deg");
  if (style === "hop") {
    j.classList.add("crouch");
    await wait(90 + Math.random() * 50);
    flyBall({ x: h.x, y: h.y - 4, gy: M.ball.gy }, 140, 0);
    await wait(80);
  } else if (style === "lean") {
    j.classList.add("lean");
    await flyBall({ x: h.x - (side === "player" ? 1 : -1), y: h.y - 3, gy: M.ball.gy }, 150 + Math.random() * 60, 0);
  } else {
    await flyBall({ x: h.x, y: h.y - 6 - Math.random() * 2, gy: M.ball.gy }, 180, 0);
    j.classList.add("crouch");
    await wait(60);
  }
  jumperOf(side, pos);
  anim(teamOf(side).at[pos], "jump");
}
// Where a spike that beats the receiver hits the floor: just in front of them
function groundPt(side, pos) {
  const f = feet(side, pos);
  const toNet = side === "player" ? 1 : -1;
  return { x: f.x + toNet * 2, y: f.y, gy: f.y };
}
// The spike's flight, decided once we know whether it gets dug
async function landSpike(side, pos, fl, missed) {
  raiseBlock();
  const dest = missed ? groundPt(side, pos) : headPt(side, pos);
  if (fl.epic) {
    const from = { ...M.ball };
    streaks((from.x + dest.x) / 2, (from.y + dest.y) / 2, WAVE_COLOR[[...M.fx].pop()] || "#ffffff", 10, 9);
  }
  await flyBall(dest, missed ? fl.ms * 0.85 : fl.ms, missed ? fl.groundArc || 0 : fl.arc);
  // the explosion goes off on the floor (missed) or at the receiver (dug)
  spikeImpact(missed ? { x: dest.x, y: dest.y - 8, gy: dest.gy } : dest, fl.power, fl.lvl, fl.nuke);
  if (missed) { playSprite("puff_dust", dest.x, dest.y, { anchor: "bottom" }); courtShake(fl.power >= CONFIG.bounceSpikePower ? "m" : "s"); }
  if (fl.after) fl.after();
  releaseBlock();
  if (!missed && fl.epic) await wait(160); // a beat of hit-stop on a big dig
}
// After smashing into the floor the ball keeps going: front row pops up high,
// back row skims low and fast off the back of the court. Harder spikes go farther.
// Blockers jump as the ball is hit and stay up until it's well past them
function raiseBlock() { (M.blockEls || []).forEach((el) => el && el.classList.add("blockup")); }
function releaseBlock() {
  const els = M.blockEls || [];
  const leap = M.blockLeap;
  M.blockEls = []; M.blockLeap = false;
  setTimeout(() => {
    els.forEach((el) => el && el.classList.remove("blockup", "blocking"));
    if (leap && M) placeAll();
  }, CONFIG.blockHoldMs);
}
async function ballBounce(side, pos, power, far = false) {
  const f = feet(side, pos);
  const dir = side === "player" ? -1 : 1; // away from the net
  const k = Rules.clamp((power - 40) / 80, 0.35, 1.4); // bounce strength
  let x = M.ball.x, y = f.y;
  const hop = async (dx, dy, ms, arc, mark) => {
    x += dir * dx; y += dy;
    await flyBall({ x, y, gy: y }, ms, arc);
    if (mark && x > 0 && x < 100) ripple(x, y, "#ffffff", mark);
  };
  if (Rules.isFront(pos) && !far) {
    await hop(9 * k, 2, 420, 18 * k, 8);
    Sound.play("bump");
    await hop(6 * k, 1, 300, 7 * k, 5);
    await hop(3 * k, 0, 200, 2, 0);
  } else if (k < 0.75 && !far) {
    // a soft spike just skips back and rolls to a stop
    await hop(10 * k, 1, 260, 5 * k, 6);
    await hop(5 * k, 1, 220, 1.5, 0);
  } else {
    // skims out the back, off the court and out of sight
    await hop(18 * k, 2, 200 / Math.min(k, 1.2), 4 * k, 9);
    Sound.play("bump");
    const target = side === "player" ? -8 : 108;
    await flyBall({ x: target, y: y + 2, gy: y + 2 }, 260 / Math.min(k, 1.2), 2.5 * k);
  }
}

// ---------- ultimates ----------
function updateUltHUD() {
  if (!M) return;
  [["player", "Player"], ["cpu", "Cpu"]].forEach(([side, k]) => {
    const T = teamOf(side);
    $("ultFill" + k).parentElement.parentElement.style.visibility = T.ult ? "visible" : "hidden";
    if (!T.ult) return;
    $("ultName" + k).textContent = CONFIG.ultimates[T.ult].name.toUpperCase() + (T.buffs.comboStar && T.ult === "comboStar" || T.buffs.fortress && T.ult === "fortress" ? " · ACTIVE" : "");
    $("ultFill" + k).style.width = (T.ultCharge / CONFIG.ultMax) * 100 + "%";
    $("ultFill" + k).parentElement.parentElement.classList.toggle("full", Rules.ultReady(T));
  });
}
// When can the player fire their ultimate right now?
function ultUsable() {
  const p = M && M.pending;
  if (!p || !Rules.ultReady(M.player)) return false;
  const u = M.player.ult;
  if (u === "nuclear") return !!(p.canSpike && !M.freeOn && !p.serve && !p.blockChoice);
  if (u === "comboStar") return !M.player.buffs.comboStar;
  if (u === "fortress") return !M.player.buffs.fortress;
  return false;
}
function renderUltButton() {
  const b = $("ultBtn");
  const show = ultUsable() || M.ultArmed;
  b.classList.toggle("hidden", !show);
  if (!show) return;
  b.textContent = (M.ultArmed ? "✓ " : "") + CONFIG.ultimates[M.player.ult].name.toUpperCase() + (M.ultArmed ? " ARMED" : "!");
  b.classList.toggle("armed", M.ultArmed);
}
$("ultBtn").addEventListener("click", () => {
  if (!M || !M.pending) return;
  const u = M.player.ult;
  if (u === "nuclear") { M.ultArmed = !M.ultArmed; Sound.play("click"); refreshControls(); return; }
  if (!ultUsable()) return;
  Rules.useUlt(M.player);
  ultFx("player", u);
  const p = M.pending;
  if (u === "fortress" && p.blockChoice) { // the whole front row blocks: no need to pick
    M.pending = null; refreshControls(); p.resolve({ type: "block", target: null }); return;
  }
  refreshControls();
});
function ultFx(side, u) {
  const T = teamOf(side);
  updateUltHUD();
  updateStatus();
  Sound.play("ult");
  popAt(side === "player" ? 27 : 73, 18, CONFIG.ultimates[u].name + "!", "ult");
  log(`<span class="abil">${side === "player" ? "You" : "CPU"} unleashed ${CONFIG.ultimates[u].name}!</span>`);
  flash(u === "fortress" ? "#7ab8ff" : u === "comboStar" ? "#ffe066" : "#ffffff");
  if (u === "fortress") {
    Sound.play("shield");
    Rules.FRONT.forEach((bp) => {
      const f = feet(side, bp);
      const el = playSprite("shield", side === "player" ? 47 : 53, f.y - 9, { loop: true, frameMs: 110 });
      el.classList.add("shield-fx");
      playSprite("puff_gold", f.x, f.y - 8);
    });
  }
  if (u === "comboStar") {
    Rules.POSITIONS.forEach((p) => { const h = headPt(side, p); playSprite("sparkle", h.x, h.y + 6); });
  }
  if (u === "nuclear") courtShake("m");
}

// ---------- abilities (player) ----------
const ARMABLE = ["fireball", "shadowStrike", "venomSpike", "eruption", "magmaSpit", "tidalSet", "lanternSet", "sneakySeed", "joltSet", "thunderSet", "headbutt",
  "frostfireSet", "undertowSet", "groundPound"];
const SPIKE_ABILITIES = ["fireball", "shadowStrike", "venomSpike", "eruption", "magmaSpit", "groundPound"];
const SET_ABILITIES = ["tidalSet", "lanternSet", "joltSet", "thunderSet", "frostfireSet", "undertowSet"];

function abilityCtx() {
  const p = M && M.pending;
  if (!p) return null;
  return { holderPos: p.holderPos, touch: p.touch, canSpike: p.canSpike, serve: p.serve, justDug: p.justDug };
}

function renderAbilityButtons() {
  document.querySelectorAll(".abil-btn").forEach((b) => b.remove());
  const ctx = abilityCtx();
  if (!ctx) return;
  Rules.POSITIONS.forEach((pos) => {
    const c = M.player.at[pos];
    const armed = M.armed && M.armed.c === c;
    const boost = Rules.digBoostReady(M.player, pos, ctx);
    if (!armed && !boost && !Rules.abilityReady(M.player, pos, ctx)) return;
    const btn = document.createElement("button");
    btn.className = "abil-btn" + (armed ? " armed" : "") + (boost ? " boost" : "");
    btn.textContent = armed ? `${c.active.name} ✓` : c.active.name;
    btn.title = c.active.text;
    btn.addEventListener("click", (e) => { e.stopPropagation(); onAbilityClick(c); });
    // sits beside the creature (on the side away from the net), on a layer above every creature
    const f = feet("player", pos);
    if (ctx.serve && pos === 1) {
      // the server is standing behind the line: put its button on the court side instead
      btn.classList.add("right-side");
      btn.style.left = XS.player.serve + (7.5 * sizeOf(c)) * 0.38 + "%";
    } else btn.style.left = f.x - (7.5 * sizeOf(c)) * 0.38 + "%";
    btn.style.top = f.y - headH("player", pos) * 0.6 + "%";
    $("abilLayer").appendChild(btn);
  });
}

function onAbilityClick(c) {
  const ctx = abilityCtx();
  if (!ctx) return;
  const pos = posOf(M.player, c);
  if (M.armed && M.armed.c === c) { M.armed = null; refreshControls(); return; } // un-arm
  if (Rules.digBoostReady(M.player, pos, ctx)) {
    // used right after a dig: upgrades the pass this Star's team is holding right now
    const q = Rules.digBoost(M.player, pos, M.pending.quality);
    M.pending.quality = q;
    M.pending.justDug = false;
    M.digBoosted = q;
    digBoostFx("player", pos, ctx.holderPos);
    refreshControls();
    return;
  }
  if (!Rules.abilityReady(M.player, pos, ctx)) return;
  if (ARMABLE.includes(c.active.id)) {
    M.armed = { c, id: c.active.id };
  } else {
    Rules.useAbility(M.player, pos);
    abilityFx("player", M.player, pos);
  }
  refreshControls();
}

function digBoostFx(side, pos, holderPos) {
  const T = teamOf(side);
  abilityFx(side, T, pos);
  pop(side, holderPos, "Pass upgraded!", "big");
  const h = headPt(side, holderPos);
  playSprite("puff_tidal", h.x, h.y + 4);
  ripple(feet(side, holderPos).x, feet(side, holderPos).y, "#8fd0ff", 14);
  Sound.play("ability");
  updateStatus();
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
    el.classList.remove("pick-mate", "pick-opp", "suggest", "front", "armed", "blocker-warn", "pick-block");
    el.style.setProperty("--k", 0);
  });
}

function refreshControls() {
  if (!M) return;
  const p = M.pending;
  clearAuras();
  renderAbilityButtons();
  renderUltButton();
  $("freeToggle").classList.add("hidden");
  $("blockAlert").classList.add("hidden");
  $("step").classList.remove("hidden");
  if (!p) return;
  if (M.armed) elOf.get(M.armed.c).classList.add("armed");

  if (p.blockChoice) {
    // "Read the spike": pick one front-row blocker, or no block
    setStep("player", 0, "block");
    Rules.FRONT.forEach((bp) => elOf.get(M.player.at[bp]).classList.add("pick-block"));
    $("blockAlert").classList.remove("hidden");
    $("step").classList.add("hidden");
    return;
  }

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
  const sneaky = M.armed && (M.armed.id === "sneakySeed" || M.armed.id === "headbutt");
  const attackTouch = p.canSpike || p.touch >= 3;

  if (sneaky) {
    setStep("player", p.touch, "sneaky");
    const power = 40 + holder.str * 0.35 + 5;
    markOpp((q) => Rules.shankChance(M.cpu, q, power * (1 + CONFIG.comboPowerPerLevel * levelFor("player")), "spike", 0.75) * 2);
  } else if (p.canSpike && !M.freeOn) {
    setStep("player", p.touch, "spike");
    $("freeToggle").textContent = "Free ball instead";
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
    // you don't have to use all three touches: clicking an opponent sends a free ball over now
    // (its faint red glow shows it's rarely the best option)
    markOpp((q) => Rules.shankChance(M.cpu, q, 40, "free") * 3);
    Rules.POSITIONS.forEach((q) => {
      if (q === p.holderPos) return;
      const m = M.player.at[q];
      if (m.recovering) return; // still getting back into position after blocking
      const el = elOf.get(m);
      el.classList.add("pick-mate");
      const good = p.touch === 1 ? Rules.has(m, "setter") : Rules.has(m, "spiker") && m.winded === 0;
      if (good) el.classList.add("suggest");
      if (good && p.touch === 2 && Rules.isFront(q)) el.classList.add("front"); // front row hits harder: a touch brighter
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
  if (p.blockChoice) {
    if (side === "player" && el.classList.contains("pick-block")) action = { type: "block", target: pos };
  } else if (p.serve && side === "cpu") action = { type: "serve", target: pos };
  else if (side === "player" && el.classList.contains("pick-mate")) {
    const special = M.armed && SET_ABILITIES.includes(M.armed.id) ? M.armed.id : null;
    action = { type: p.touch === 1 ? "bump" : "set", target: pos, special };
  } else if (side === "cpu" && el.classList.contains("pick-opp")) {
    if (M.armed && M.armed.id === "sneakySeed") action = { type: "sneaky", target: pos, special: "sneakySeed" };
    else if (M.armed && M.armed.id === "headbutt") action = { type: "spike", target: pos, special: "headbutt" };
    else if (p.canSpike && !M.freeOn) {
      const special = M.armed && SPIKE_ABILITIES.includes(M.armed.id) ? M.armed.id : null;
      action = { type: "spike", target: pos, special, ult: M.ultArmed };
    } else action = { type: "free", target: pos };
  }
  if (!action) return;
  Sound.play("click");
  M.pending = null;
  M.armed = null;
  M.freeOn = false;
  M.ultArmed = false;
  tip.classList.add("hidden");
  refreshControls();
  p.resolve(action);
}

$("freeToggle").addEventListener("click", () => { if (M && M.pending) { M.freeOn = !M.freeOn; if (M.freeOn) M.ultArmed = false; refreshControls(); } });
$("noBlock").addEventListener("click", () => {
  const p = M && M.pending;
  if (!p || !p.blockChoice) return;
  Sound.play("click");
  M.pending = null;
  refreshControls();
  p.resolve({ type: "block", target: null });
});
// sound toggles
function refreshSoundBtns() {
  $("sfxBtn").classList.toggle("on", Sound.sfxOn);
  $("musicBtn").classList.toggle("on", Sound.musicOn);
}
$("sfxBtn").addEventListener("click", () => { Sound.setSfx(!Sound.sfxOn); refreshSoundBtns(); });
$("musicBtn").addEventListener("click", () => { Sound.setMusic(!Sound.musicOn); refreshSoundBtns(); });
refreshSoundBtns();

// ---------- timing bar (spikes and hard serves) ----------
function runTiming(ctrl, slow = 1) {
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
    const period = 850 * slow; // ms for one sweep (Jolt Set doubles it)
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
      const g = d <= perfect / 2 ? "perfect" : d <= good / 2 ? "good" : d <= good ? "ok" : d <= good * 2 ? "poor" : "miss";
      Sound.play(g === "perfect" ? "perfect" : g === "good" ? "good" : g === "ok" ? "click" : "miss");
      finish(g);
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
// Story mode: the two teams' logos slide in with a big VS
async function versusIntro() {
  const v = $("vsIntro");
  const side = (t) => `${logoCard(t.logo, t.color, "huge")}<div class="vs-name" style="--lc:${t.color}">${escapeHtml(t.name)}</div>`;
  $("vsLeft").innerHTML = side(M.teams.player);
  $("vsRight").innerHTML = side(M.teams.cpu);
  v.classList.remove("hidden", "out");
  void v.offsetWidth;
  v.classList.add("in");
  Sound.play("whoosh");
  await wait(550);
  Sound.play("block");
  courtShake("s");
  await wait(1600);
  v.classList.add("out");
  await wait(350);
  v.classList.add("hidden");
  v.classList.remove("in", "out");
}

async function intro() {
  if (M.mode === "story") await versusIntro();
  const el = $("intro");
  el.classList.remove("hidden");
  el.className = "intro";
  el.textContent = "READY…";
  Sound.play("click");
  await wait(1000);
  el.textContent = "BEGIN!";
  el.className = "intro go";
  Sound.play("whistle");
  ["player", "cpu"].forEach((side) => Rules.POSITIONS.forEach((p) => anim(teamOf(side).at[p], "jump")));
  await wait(900);
  el.classList.add("hidden");
}

async function matchLoop(token) {
  try {
    await intro();
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
      Sound.play("whistle");
      setTimeout(() => Sound.play(winner === "player" ? "cheer" : "lose"), 250);
      updateUltHUD();
      const { player: a, cpu: b } = M.score;
      const over = (a >= M.pointsToWin || b >= M.pointsToWin) && Math.abs(a - b) >= M.winBy;
      await showBanner(winner === "player" ? "POINT!" : "CPU POINT", reason + (sideOut && !over ? " · Side out, rotate!" : ""), winner !== "player");
      if (over) {
        if (a > b) Sound.play("win");
        if (M.mode === "story") { showStoryEnd(a > b); return; }
        $("playAgain").textContent = "Back to team select";
        $("endSecond").textContent = "Main menu";
        endAction = { first: backToBuilder, second: () => { backToBuilder(); showScreen("menu"); } };
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

const FX_OF = { fireball: "fire", shadowStrike: "shadow", tidalSet: "tidal", sneakySeed: "seed", venomSpike: "toxic", lanternSet: "lantern", eruption: "fire", magmaSpit: "fire", joltSet: "volt", thunderSet: "volt", frostfireSet: "fire", undertowSet: "tidal" };

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
    timing = AI.timing(M.timingSkill);
    target = AI.easyTarget(M.player, M.smart, Rules.servePowerEstimate(off, serveType), Rules.serveTargets(serveType));
  }
  // toss and hit
  await flyBall({ x: XS[offSide].serve, y: LANE_Y[lane] - HEAD - 14, gy: LANE_Y[lane] }, 350, 0);
  anim(server, "jump");
  if (serveType === "hard") pop(offSide, 1, CONFIG.timing[timing].label, timing === "perfect" ? "big" : timing === "poor" || timing === "miss" ? "bad" : "good");
  else pop(offSide, 1, "Float serve", "passive");
  await wait(150);
  const sv = Rules.serve(off, serveType, timing);
  Sound.play("serve");
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
  // a strong hitter with good timing: the serve may blast into the floor (decided when it lands)
  const bigServe = serveType === "hard" && (timing === "good" || timing === "perfect") && sv.power >= CONFIG.serveBouncePower;
  let incoming = { fromOpp: true, side: defSide, pos: target, power: sv.power, kind: "serve", aim: 1 };
  if (bigServe) {
    Sound.play("whoosh");
    incoming.flight = { ms: 560, arc: 22, groundArc: 14, power: sv.power, lvl: 0, nuke: false, epic: false, after: null };
  } else {
    await flyBall(headPt(defSide, target), serveType === "hard" ? 700 : 1000, serveType === "hard" ? 22 : 32);
    if (serveType === "hard" && sv.power > 75) courtShake("s");
  }

  // ----- rally loop -----
  while (true) {
    const side = incoming.side;
    const T = teamOf(side), O = teamOf(other(side));
    let holder, q, touch, isSet, justDug = false;

    if (incoming.fromOpp) {
      M.poss = side;
      const coverer = Rules.coverPos(T, incoming.pos, incoming.kind);
      if (coverer !== incoming.pos) {
        // Cactus Cover: Desacti dives in front of a teammate
        pop(side, coverer, "Cactus Cover!", "ability");
        if (!incoming.flight) await flyBall(headPt(side, coverer), 220, 4);
        playSprite("puff_seed", feet(side, coverer).x, feet(side, coverer).y - 6);
        incoming.pos = coverer;
      }
      else {
        // any good receiver next to the target may dive across and take it
        const ac = Rules.autoCover(T, incoming.pos, incoming.kind);
        if (ac) {
          pop(side, ac, "Dive!", "ability");
          anim(T.at[ac], "dig");
          if (!incoming.flight) await flyBall(headPt(side, ac), 200, 3);
          const cf = feet(side, ac);
          playSprite("puff_dust", cf.x, cf.y - 2);
          incoming.pos = ac;
          incoming.aim *= CONFIG.coverDiveMult;
        }
      }
      if (T.at[incoming.pos].recovering) {
        // the blocker is still landing: a teammate has to dive for it
        const np = Rules.availablePos(T, incoming.pos);
        pop(side, incoming.pos, "Recovering!", "passive");
        if (!incoming.flight) await flyBall(headPt(side, np), 200, 4);
        incoming.pos = np;
        incoming.aim *= CONFIG.recoverCoverMult;
      }
      if (incoming.kind === "spike") {
        const weaker = Rules.splashGuard(T, incoming.pos, incoming.power);
        if (weaker !== null) {
          incoming.power = weaker;
          const sp = feet(side, incoming.pos);
          pop(side, incoming.pos, "Splash Guard!", "ability");
          playSprite("puff_tidal", sp.x, sp.y, { anchor: "bottom" });
          Sound.play("water");
          updateStatus();
        }
      }
      // CPU fires Combo Star at the start of a possession
      if (side === "cpu" && Rules.ultReady(T) && T.ult === "comboStar" && Math.random() < 0.7) { Rules.useUlt(T); ultFx("cpu", "comboStar"); }
      const rc = T.at[incoming.pos];
      const r = Rules.receive(T, incoming.pos, incoming.power, incoming.kind, incoming.aim);
      T.buffs.allBack = false;
      // a spike is still in the air: it either meets the receiver or smashes into the floor
      if (incoming.flight) await landSpike(side, incoming.pos, incoming.flight, r.error);
      setBallFx([]);
      Sound.play(r.error ? "shank" : "dig");
      if (r.error) {
        anim(rc, "shake");
        const f = feet(side, incoming.pos);
        if (incoming.flight) {
          const label = incoming.kind === "serve" ? "ACE!" : incoming.power >= CONFIG.bounceSpikePower ? "Too fast!" : "Missed it!";
          pop(side, incoming.pos, label, "bad");
          // a big serve skims away low and fast
          await ballBounce(side, incoming.pos, incoming.kind === "serve" ? incoming.power + 20 : incoming.power, incoming.kind === "serve");
        } else {
          await flyBall({ x: f.x + (side === "player" ? -4 : 4), y: f.y, gy: f.y }, 250, 0);
          pop(side, incoming.pos, incoming.kind === "serve" ? "ACE!" : "Shanked!", "bad");
          ripple(f.x, f.y, "#ffffff", 10);
        }
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
        playSprite("puff_seed", fp.x, fp.y + 8);
        await flyBall(fp, 350, 8);
        anim(T.at[r.savedBy], "dig");
        holder = r.savedBy;
      } else {
        anim(rc, "dig");
        holder = incoming.pos;
        if (r.ability) {
          pop(side, holder, r.ability, "ability");
          const f = feet(side, holder);
          playSprite("puff_seed", f.x, f.y - 6);
          ripple(f.x, f.y, "#5fd35f", 12);
        } else {
          const [w, k] = r.quality >= 80 ? ["Perfect pass!", "good"] : r.quality >= 55 ? ["Nice dig!", "good"] : r.quality >= 30 ? ["Okay", ""] : ["Shaky…", "bad"];
          pop(side, holder, w, k);
        }
        popPassives(side, holder, r.passives);
        if (["chillyTouch", "frozenWall"].includes(rc.passive.id) && incoming.kind === "spike" && incoming.attacker && Rules.afflict(incoming.attacker, "chill")) {
          const ap = posOf(teamOf(incoming.attackerSide), incoming.attacker);
          pop(side, holder, rc.passive.name, "passive");
          pop(incoming.attackerSide, ap, "Chilled!", "ability");
          const g = headPt(incoming.attackerSide, ap);
          playSprite("puff_ice", g.x, g.y + 8);
        }
        if (incoming.kind === "spike" && incoming.setBy && incoming.setBy.passive.id === "thermalShock" && Rules.afflict(T.at[holder], "chill")) {
          pop(side, holder, "Thermal Shock: Chilled!", "ability");
          const g = headPt(side, holder);
          playSprite("puff_ice", g.x, g.y + 8);
        }
        if (incoming.kind === "spike" && incoming.attacker && incoming.attacker.passive.id === "tremor") {
          r.quality = Math.max(0, r.quality - 12);
          pop(incoming.attackerSide, posOf(teamOf(incoming.attackerSide), incoming.attacker), "Tremor", "passive");
        }
        if (rc.passive.id === "prickly" && incoming.kind === "spike" && incoming.attacker) {
          const stuck = Rules.afflict(incoming.attacker, "poison");
          const ap = posOf(teamOf(incoming.attackerSide), incoming.attacker);
          pop(side, holder, "Prickly", "passive");
          pop(incoming.attackerSide, ap, stuck ? "Poisoned!" : "Thick Hide", stuck ? "ability" : "passive");
          const g = headPt(incoming.attackerSide, ap);
          playSprite("puff_toxic", g.x, g.y + 8);
        }
      }
      q = r.quality; touch = 1; isSet = false;
      justDug = incoming.kind === "spike";
      T.buffs.rattled = false;
      if (justDug) T.buffs.dug = true; // Lochlo's Tide Pool
      if (justDug && q >= 55 && T.at[holder].passive.id === "sparkDig") swing(side, 1, holder, "Spark Dig");
      const [dm1, dm2] = CONFIG.digMomentum;
      const digBonus = incoming.kind === "spike" && q >= 55 ? (incoming.power >= dm2 ? 2 : incoming.power >= dm1 ? 1 : 0) : 0;
      const bigDig = digBonus >= 2;
      swing(side, Rules.comboGain("pass", q) + digBonus, holder, digBonus ? (bigDig ? "Big dig! Momentum swing" : "Good dig!") : null);
      if (bigDig && T.at[holder].passive.id === "desertCalm") swing(side, 1, holder, "Desert Calm");
      if (T.buffs.highTide && q >= 75) swing(side, 1, holder, "High Tide");
      updateStatus();
    } else {
      holder = incoming.pos; q = incoming.quality; touch = incoming.touch; isSet = incoming.isSet;
    }

    setHolder(side, holder);
    const hc = T.at[holder];
    const canSpike = isSet && Rules.has(hc, "spiker");

    // ----- the defending team picks a blocker before the spike -----
    if (canSpike) {
      O.blockerPos = null;
      if (other(side) === "player") {
        if (!O.buffs.fortress) {
          setStep("cpu", touch, "spike");
          await wait(350);
          Sound.play("alert");
          const choice = await askPlayer({ blockChoice: true, holderPos: null });
          checkAlive(token);
          if (!O.buffs.fortress) O.blockerPos = choice.target;
        }
      } else {
        if (!O.buffs.fortress && Rules.ultReady(O) && O.ult === "fortress" && (levelFor(side) >= 2 || Math.random() < 0.4)) {
          Rules.useUlt(O); ultFx("cpu", "fortress");
        }
        O.blockerPos = AI.chooseBlocker(O, T, holder, M.smart);
      }
      O.buffs.allBack = !O.blockerPos && !O.buffs.fortress;
      if (O.blockerPos) {
        elOf.get(O.at[O.blockerPos]).classList.add("blocking");
        pop(other(side), O.blockerPos, "Blocking", "passive");
      } else if (O.buffs.allBack) {
        Rules.POSITIONS.forEach((p) => anim(O.at[p], "dig"));
        popAt(other(side) === "player" ? 27 : 73, 8, "Everyone back!", "passive");
      }
      setHolder(side, holder);
    }

    let action;
    if (side === "player") {
      M.digBoosted = null;
      action = await askPlayer({ holderPos: holder, touch, canSpike, quality: q, justDug });
      checkAlive(token);
      if (M.digBoosted != null) { q = M.digBoosted; M.digBoosted = null; }
    } else {
      setStep("cpu", touch, canSpike ? "spike" : touch === 3 ? "free" : touch === 1 ? "bump" : "set");
      await wait(600);
      if (justDug && q < 70) {
        const bctx = { justDug, touch, holderPos: holder };
        const bp = Rules.POSITIONS.find((p) => Rules.digBoostReady(T, p, bctx));
        if (bp && Math.random() < M.smart * 0.8) {
          q = Rules.digBoost(T, bp, q);
          digBoostFx(side, bp, holder);
          await wait(450);
        }
      }
      action = AI.decide(T, O, holder, touch, isSet, q, levelFor(side), M.smart);
      if (action.type === "spike") action.timing = AI.timing(M.timingSkill);
      if (action.type === "sneaky") setStep("cpu", touch, "sneaky");
      if (action.type === "free" && canSpike && O.buffs.fortress) popAt(73, 8, "Too scared to spike!", "passive");
      if (action.type === "spike" && Rules.ultReady(T) && T.ult === "nuclear") action.ult = true;
    }
    if (action.special) {
      Rules.useAbility(T, holder);
      Sound.play({ fireball: "fire", eruption: "fire", magmaSpit: "fire", tidalSet: "water", venomSpike: "poison", lanternSet: "spook", hornWall: "shield" }[action.special] || "ability");
      abilityFx(side, T, holder);
      setBallFx([...M.fx, FX_OF[action.special]]);
      if (action.special !== "sneakySeed") swing(side, 1, holder);
    }

    // ----- bump / set to a teammate -----
    if (action.type === "bump" || action.type === "set") {
      const asSet = action.type === "set";
      const mate = T.at[action.target];
      const p = asSet ? Rules.set(T, holder, action.target, q, action.special === "tidalSet", action.special === "lanternSet", action.special) : Rules.bump(T, holder, action.target, q);
      anim(hc, asSet ? "jump" : "dig");
      Sound.play(asSet ? "set" : "bump");
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
      if (!asSet && hc.passive.id === "tailwind") swing(side, 1, holder, "Tailwind");
      if (asSet && hc.passive.id === "static") swing(side, 1, holder, "Static");
      if (asSet && hc.passive.id === "conductor") pop(side, holder, "Conductor", "passive");
      if (T.buffs.highTide && p.quality >= 75) swing(side, 1, holder, "High Tide");
      if (!asSet && hc.active.id === "slipstream" && T.buffs.slipstream) {
        T.buffs.slipBoost = true;
        pop(side, holder, "Slipstream!", "ability");
        setBallFx([...M.fx, "tidal"]);
      }
      log(`${who(side, hc)} ${asSet ? "sets" : "bumps"} to ${mate.name}.`);
      if (asSet && Rules.has(hc, "setter")) {
        // a real setter: clean, high, golden arc
        await flyBall(headPt(side, action.target), 720, 32, { trail: "spark" });
      } else if (asSet) {
        // anyone else setting: a plain low set
        await flyBall(headPt(side, action.target), 620, 12);
      } else {
        await flyBall(headPt(side, action.target), 600, 18);
      }
      incoming = { fromOpp: false, side, pos: action.target, quality: p.quality, touch: touch + 1, isSet: asSet };
      continue;
    }

    // ----- spike -----
    if (action.type === "spike") {
      const jolt = !!(T.buffs.jolt || T.buffs.thunder || T.buffs.overcharge); // Jolt Set / Thunder Set / Overcharge slow the timing bar
      let timing = side === "player" ? await runTiming(hc.ctrl, jolt ? 2 : 1) : action.timing;
      if (side === "cpu" && jolt) timing = { miss: "poor", poor: "ok", ok: "good", good: "perfect", perfect: "perfect" }[timing];
      checkAlive(token);
      const t = CONFIG.timing[timing];
      pop(side, holder, t.label, timing === "perfect" ? "big" : timing === "poor" || timing === "miss" ? "bad" : "good");
      const comboAtHit = levelFor(side);
      swing(side, t.combo, holder);
      if (action.ult) {
        Rules.useUlt(T);
        T.nuke = true;
        ultFx(side, "nuclear");
        setBallFx([...M.fx, "fire"]);
      }
      if (O.blockerPos) {
        const bc = O.at[O.blockerPos];
        const tLane = Rules.lane(other(side), action.target);
        // Leaping Block: Drylion springs sideways toward the row the ball is going to
        if (bc.active.id === "leapBlock" && O.buffs.leapBlock && Rules.lane(other(side), O.blockerPos) !== tLane) {
          const bel = elOf.get(bc);
          bel.style.top = LANE_Y[tLane] + "%";
          pop(other(side), O.blockerPos, "Leap!", "passive");
          M.blockLeap = true; // slides back when the block comes down
        }
      }
      // who goes up to block: the chosen blocker, or the whole front row under Iron Fortress
      M.blockEls = O.buffs.fortress ? Rules.FRONT.map((bp) => elOf.get(O.at[bp])) : O.blockerPos ? [elOf.get(O.at[O.blockerPos])] : [];
      // the outcome is decided now, then played out
      const res = Rules.spike(T, holder, q, O, action.target, timing, action.special, comboAtHit);
      const wasNuke = !!T.nuke;
      T.nuke = false;
      Rules.clearRecovering(T); // the attackers' own blocker is back in position
      O.blockerPos = null;
      const tgt = headPt(other(side), action.target);
      const lvl = levelFor(side);
      const epic = !res.out && (wasNuke || lvl >= CONFIG.epicLevel || res.power >= CONFIG.epicPower);
      if (epic) await spikeWindup(side, holder, [...M.fx].pop() || (wasNuke ? "fire" : "spark"));
      else await quickWindup(side, holder);
      checkAlive(token);
      Sound.play("spike");
      setHolder(null);
      popPassives(side, holder, res.passives);
      updateStatus();
      if (res.power >= CONFIG.boomPower || epic) Sound.play("whoosh");
      if (res.out) {
        raiseBlock();
        releaseBlock();
        await flyBall({ x: side === "player" ? 99 : 1, y: tgt.y + 4, gy: tgt.gy + 4 }, 450, 6);
        popAt(side === "player" ? 92 : 8, tgt.y, "OUT!", "bad");
        Sound.play("out");
        log(`${who(side, hc)} spikes… out!`);
        await wait(400);
        return { winner: other(side), reason: `${sideWord(side)} ${hc.name}'s spike went out` };
      }
      if (res.blocked) {
        const blocker = O.at[res.blockerPos];
        const bp = headPt(other(side), res.blockerPos);
        const leapt = Rules.lane(other(side), res.blockerPos) !== Rules.lane(other(side), action.target) && blocker.active.id === "leapBlock";
        if (leapt) { bp.y = LANE_Y[Rules.lane(other(side), action.target)] - headH(other(side), res.blockerPos) - 2.5; }
        raiseBlock();
        const wall = { x: side === "player" ? 48 : 52, y: bp.y - 4, gy: bp.gy };
        if (epic) streaks((M.ball.x + wall.x) / 2, (M.ball.y + wall.y) / 2, WAVE_COLOR[[...M.fx].pop()] || "#ffffff", 10, 9);
        await flyBall(wall, epic ? 110 : 220, epic ? 0 : 2);
        pop(other(side), res.blockerPos, "BLOCKED!", "big");
        Sound.play("block");
        popPassives(other(side), res.blockerPos, res.blockerPassives);
        if (blocker.passive.id === "fortified") swing(other(side), 2, res.blockerPos);
        if (res.chillAttacker && Rules.afflict(hc, "chill")) { pop(side, holder, "Chilled!", "ability"); updateStatus(); }
        if (res.chillBlocker && Rules.afflict(blocker, "chill")) { pop(other(side), res.blockerPos, "Chilled!", "ability"); updateStatus(); }
        // the spike smashes into the block...
        if (epic) {
          spikeImpact({ x: wall.x, y: wall.y - 6, gy: wall.gy }, Math.max(res.power, CONFIG.boomPower), lvl, wasNuke);
          playSprite("shield", wall.x, wall.y, { scale: fxScale() + 1 });
          await wait(150); // hit-stop on the collision
        } else {
          playSprite("puff_gold", wall.x, wall.y + 2);
          streaks(wall.x, wall.y + 2, "#bfeaff", 10, 6);
          courtShake("s");
        }
        // ...and gets rejected straight back down into the attackers' court
        const fall = feet(side, holder);
        const back = side === "player" ? -1 : 1;
        const land = { x: wall.x + back * (epic ? 12 : 7), y: fall.y, gy: fall.y };
        await flyBall(land, epic ? 130 : 200, epic ? 0 : 3);
        setBallFx([]);
        playSprite("puff_dust", land.x, land.y, { anchor: "bottom" });
        ripple(land.x, land.y, "#ffffff", epic ? 14 : 9);
        if (epic) courtShake("m");
        await ballBounce(side, holder, epic ? Math.max(res.power, 120) : res.power * 0.8, epic);
        releaseBlock();
        log(`${who(side, hc)} spikes. Stuffed by ${who(other(side), blocker)}!`);
        await wait(400);
        return { winner: other(side), reason: `${sideWord(other(side))} ${blocker.name} blocked it` };
      }
      log(`${who(side, hc)} spikes${lvl >= 4 || wasNuke ? " with huge power" : ""}!`);
      const flight = { ms: epic ? 110 : Math.max(220, 400 - lvl * 30), arc: epic ? 0 : 4, power: res.power, lvl, nuke: wasNuke, epic, after: null };
      flight.after = () => { if (res.poison || res.burn) {
        const victim = O.at[action.target];
        const kind = res.burn ? "burn" : "poison";
        const word = res.burn ? "Burned!" : "Poisoned!";
        const vp = headPt(other(side), action.target);
        if (Rules.afflict(victim, kind)) { // this rally + the next two
          pop(other(side), action.target, word, "ability");
          playSprite(res.burn ? "puff_fire" : "puff_toxic", vp.x, vp.y + 8);
          log(`<span class="abil">${who(other(side), victim)} is ${word}</span>`);
        } else pop(other(side), action.target, "Thick Hide", "passive");
        updateStatus();
      } };
      if (hc.passive.id === "magmaVeins") swing(side, 1, holder, "Magma Veins");
      if (res.chillAttacker && Rules.afflict(hc, "chill")) {
        const hp = headPt(side, holder);
        pop(side, holder, "Chilled!", "ability");
        playSprite("puff_ice", hp.x, hp.y + 8);
        updateStatus();
      }
      incoming = { fromOpp: true, side: other(side), pos: action.target, power: res.power, kind: "spike", aim: res.aimMult, attacker: hc, attackerSide: side, flight, setBy: res.setBy };
      continue;
    }

    // ----- sneaky seed (attack on 2) -----
    if (action.type === "sneaky") {
      anim(hc, "jump");
      setHolder(null);
      Rules.clearRecovering(T);
      Sound.play("spike");
      const res = Rules.sneaky(T, holder, levelFor(side));
      const tgt = headPt(other(side), action.target);
      if (res.out) {
        await flyBall({ x: side === "player" ? 99 : 1, y: tgt.y, gy: tgt.gy }, 500, 10);
        log(`${who(side, hc)}'s sneaky attack went out!`);
        return { winner: other(side), reason: `${sideWord(side)} ${hc.name}'s sneaky attack went out` };
      }
      log(`${who(side, hc)} attacks on the 2nd touch!`);
      await flyBall(tgt, 450, 10);
      playSprite("puff_seed", tgt.x, tgt.y + 6);
      incoming = { fromOpp: true, side: other(side), pos: action.target, power: res.power, kind: "spike", aim: res.aimMult };
      continue;
    }

    // ----- free ball -----
    anim(hc, "dig");
    setHolder(null);
    Rules.clearRecovering(T);
    elOf.forEach((el) => el.classList.remove("blocking"));
    O.blockerPos = null;
    updateStatus();
    Sound.play("bump");
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
  ["timing", "banner", "servePick", "endOverlay", "match", "ultBtn", "blockAlert", "intro"].forEach((id) => $(id).classList.add("hidden"));
  $("builder").classList.remove("hidden");
  tip.classList.add("hidden");
  renderBuilder();
}
window.addEventListener("resize", () => { if (M) { $("court").style.setProperty("--px", fxScale() + "px"); updateFlames(); } });
let endAction = { first: () => backToBuilder(), second: () => { backToBuilder(); showScreen("menu"); } };
$("quitMatch").addEventListener("click", backToBuilder);
$("playAgain").addEventListener("click", () => endAction.first());
$("endSecond").addEventListener("click", () => endAction.second());
