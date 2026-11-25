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

const lookOf = (c) => c.looks[builder.looks[c.id] || 0] || c.looks[0];
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

function log(html) {
  const line = document.createElement("div");
  line.innerHTML = html;
  $("log").prepend(line);
}

// ---------- court geometry (percent of the court box) ----------
const XS = { player: { back: 18.5, front: 39.5, serve: 3.5 }, cpu: { front: 60.5, back: 81.5, serve: 96.5 } };
const LANE_Y = [33, 58, 83];
const HEAD = 21; // how far above the feet the ball sits

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
    ball: { x: 50, y: 50, gy: 60 },
  };
  M.playerList = Rules.POSITIONS.map((p) => M.player.at[p]);
  $("target").textContent = CONFIG.pointsToWin;
  $("log").innerHTML = "";
  $("builder").classList.add("hidden");
  $("match").classList.remove("hidden");
  buildCourt();
  updateScore();
  refreshControls();
  log(`Match start! ${M.serving === "player" ? "You serve" : "CPU serves"} first.`);
  matchLoop(matchToken);
}

function buildCourt() {
  const holder = $("creatures");
  holder.innerHTML = "";
  elOf.clear();
  ["player", "cpu"].forEach((side) => {
    Rules.POSITIONS.forEach((p) => {
      const c = teamOf(side).at[p];
      const el = document.createElement("div");
      el.className = `crt ${side}`;
      el.innerHTML = `<div class="ring"></div><div class="jumper"><div class="bob"><img src="${c.img}" alt="${c.name}"></div></div><div class="tag"></div>`;
      const bob = el.querySelector(".bob");
      bob.style.animationDuration = (1.3 + Math.random() * 0.7).toFixed(2) + "s";
      bob.style.animationDelay = (-Math.random() * 2).toFixed(2) + "s";
      el.addEventListener("click", () => onCreatureClick(side, c));
      el.addEventListener("mouseenter", () => showAimInfo(side, c));
      el.addEventListener("mouseleave", () => { $("aimInfo").textContent = ""; });
      attachTooltip(el, () => c);
      holder.appendChild(el);
      elOf.set(c, el);
    });
  });
  placeAll();
  updateTags();
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

function updateTags() {
  ["player", "cpu"].forEach((side) => {
    Rules.POSITIONS.forEach((p) => {
      const c = teamOf(side).at[p];
      const icons = (c.winded > 0 ? '<span class="ico" title="Winded">💨</span>' : "") +
        (c.cooldown === 0 ? '<span class="ico" title="Ability ready">✨</span>' : "");
      elOf.get(c).querySelector(".tag").innerHTML = `${p}·${c.name}${icons}`;
    });
  });
}

function updateScore() {
  $("scorePlayer").textContent = M.score.player;
  $("scoreCpu").textContent = M.score.cpu;
  $("servePlayer").classList.toggle("on", M.serving === "player");
  $("serveCpu").classList.toggle("on", M.serving === "cpu");
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
  const b = $("ball"), s = $("ballShadow");
  b.style.left = p.x + "%"; b.style.top = p.y + "%";
  s.style.left = p.x + "%"; s.style.top = p.gy + "%";
}

function setBallEffect(effect) {
  $("ball").className = "ball" + (effect ? " " + effect : "");
}

function particle(x, y, kind) {
  const el = document.createElement("div");
  el.className = "particle " + kind;
  el.style.left = x + "%";
  el.style.top = y + "%";
  $("court").appendChild(el);
  setTimeout(() => el.remove(), 520);
}

// Fly the ball from where it is to `to` in an arc. arc = peak height in % of court height.
function flyBall(to, ms, arc, effect = null) {
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
      if (effect && frame++ % 2 === 0) particle(x, y, effect);
      if (t < 1) requestAnimationFrame(step);
      else { setBall(to); resolve(); }
    }
    requestAnimationFrame(step);
  });
}

function popAt(x, y, text, kind = "") {
  const el = document.createElement("div");
  el.className = "pop " + kind;
  el.textContent = text;
  el.style.left = x + "%";
  el.style.top = y + "%";
  $("court").appendChild(el);
  setTimeout(() => el.remove(), 1250);
}
function pop(side, pos, text, kind = "") {
  const f = feet(side, pos);
  popAt(f.x, f.y - 15, text, kind);
}

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

// ---------- abilities ----------
const ARMABLE = ["fireball", "shadowStrike", "tidalSet", "sneakySeed"];

function abilityCtx() {
  const p = M && M.pending;
  if (!p) return null;
  return { holderPos: p.holderPos, touch: p.touch, canSpike: p.canSpike, serve: p.serve };
}

function renderAbilityBar() {
  const bar = $("abilityBar");
  bar.innerHTML = "";
  const ctx = abilityCtx();
  M.playerList.forEach((c) => {
    const pos = posOf(M.player, c);
    const ready = ctx && Rules.abilityReady(M.player, pos, ctx);
    const armed = M.armed && M.armed.c === c;
    const state = c.cooldown > 0 ? `Recharging (${c.cooldown})`
      : armed ? "ARMED — make your move" : ready ? "Ready! Click to use" : "Charged ✨ (not usable now)";
    const btn = document.createElement("button");
    btn.className = "abtn" + (ready ? " ready" : "") + (armed ? " armed" : "") + (c.cooldown > 0 ? " cooling" : "");
    btn.innerHTML = `<img src="${c.img}" alt=""><div><div class="aname">${c.active.name}</div><div class="astate">${state}</div></div>`;
    btn.title = `${c.name}: ${c.active.text}`;
    btn.addEventListener("click", () => onAbilityClick(c));
    bar.appendChild(btn);
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
    pop("player", pos, c.active.name + "!", "ability");
    log(`<span class="abil">${who("player", c)} used ${c.active.name}!</span>`);
    updateTags();
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

function refreshControls() {
  if (!M) return;
  const p = M.pending;
  elOf.forEach((el) => el.classList.remove("pick-mate", "pick-opp"));
  renderAbilityBar();
  const freeBtn = $("freeToggle");
  freeBtn.classList.add("hidden");
  if (!p) return;

  const oppEls = Rules.POSITIONS.map((q) => elOf.get(M.cpu.at[q]));
  if (p.serve) {
    oppEls.forEach((el) => el.classList.add("pick-opp"));
    $("prompt").innerHTML = "<b>Your serve!</b> Click a CPU creature to serve at. Weak passers are good targets.";
    return;
  }
  const holder = M.player.at[p.holderPos];
  const sneaky = M.armed && M.armed.id === "sneakySeed";
  const attackTouch = p.canSpike || p.touch >= 3;
  if (sneaky || attackTouch) oppEls.forEach((el) => el.classList.add("pick-opp"));
  if (!sneaky && !attackTouch) {
    Rules.POSITIONS.forEach((q) => { if (q !== p.holderPos) elOf.get(M.player.at[q]).classList.add("pick-mate"); });
  }
  if (p.canSpike) {
    freeBtn.classList.remove("hidden");
    freeBtn.classList.toggle("on", M.freeOn);
  }

  const t = `<span class="muted">Touch ${p.touch}/3 ·</span> `;
  let msg;
  if (sneaky) msg = `<b>Sneaky Seed!</b> Click a CPU creature to attack on the 2nd touch.`;
  else if (p.canSpike && M.freeOn) msg = `Click a CPU creature to send a soft <b>free ball</b> at.`;
  else if (p.canSpike) msg = `<b>${holder.name} can SPIKE!</b> Click a CPU creature to aim at. Hover to see the risk.` +
    (M.armed ? ` <b>${M.armed.c.active.name}</b> is armed!` : "");
  else if (p.touch >= 3) msg = `${holder.name} isn't a spiker. Click a CPU creature to send a free ball over.`;
  else if (p.touch === 1) msg = `${holder.name} passed it up! Click a teammate to <b>bump</b> to (usually your setter).`;
  else msg = `${holder.name} is setting! Click a teammate to <b>set</b>. Spikers who get a set can spike.` +
    (M.armed ? ` <b>${M.armed.c.active.name}</b> is armed!` : "");
  $("prompt").innerHTML = t + msg;
}

// Show line/cross, risk and block chance when hovering a spike target
function showAimInfo(side, c) {
  const p = M && M.pending;
  if (!p || side !== "cpu" || p.serve || !p.canSpike || M.freeOn) return;
  const target = posOf(M.cpu, c);
  const a = Rules.aim("player", p.holderPos, "cpu", target);
  const hitter = M.player.at[p.holderPos];
  const shadow = M.armed && M.armed.id === "shadowStrike";
  const blocks = shadow ? [] : Rules.blockChances(M.player, p.holderPos, M.cpu, target, hitter.str * 0.9);
  const block = Math.round(100 * (1 - blocks.reduce((s, b) => s * (1 - b.chance), 1)));
  const risk = a.risk >= 0.07 ? "high" : a.risk >= 0.03 ? "medium" : "low";
  const dig = a.aimMult <= 0.86 ? "very hard" : a.aimMult <= 0.94 ? "hard" : "normal";
  $("aimInfo").innerHTML = `${a.line ? "Line shot" : "Cross-court"} → ${c.name} (DEF ${c.def}) · Dig difficulty: <b>${dig}</b> · ` +
    `Out risk: <b>${risk}</b> · Block chance: <b>${shadow ? "0% (Shadow Strike)" : "~" + block + "%"}</b>`;
}

function onCreatureClick(side, c) {
  const p = M && M.pending;
  if (!p) return;
  const el = elOf.get(c);
  const team = teamOf(side);
  const pos = posOf(team, c);
  let action = null;
  if (p.serve && side === "cpu") action = { type: "serve", target: pos };
  else if (side === "player" && el.classList.contains("pick-mate")) {
    const special = M.armed && M.armed.id === "tidalSet" ? "tidalSet" : null;
    action = { type: p.touch === 1 ? "bump" : "set", target: pos, special };
  } else if (side === "cpu" && el.classList.contains("pick-opp")) {
    if (M.armed && M.armed.id === "sneakySeed") action = { type: "sneaky", target: pos, special: "sneakySeed" };
    else if (p.canSpike && !M.freeOn) {
      const special = M.armed && ["fireball", "shadowStrike"].includes(M.armed.id) ? M.armed.id : null;
      action = { type: "spike", target: pos, special };
    } else action = { type: "free", target: pos };
  }
  if (!action) return;
  M.pending = null;
  M.armed = null;
  M.freeOn = false;
  $("aimInfo").textContent = "";
  refreshControls();
  p.resolve(action);
}

$("freeToggle").addEventListener("click", () => { if (M && M.pending) { M.freeOn = !M.freeOn; refreshControls(); } });

// ---------- spike timing bar ----------
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
    $("prompt").innerHTML = "<b>Time your spike!</b>";
    const start = performance.now();
    const period = 850; // ms for one sweep
    let pos = 0, done = false;

    function finish(grade) {
      if (done) return;
      done = true;
      box.classList.add("hidden");
      box.removeEventListener("pointerdown", onHit);
      document.removeEventListener("keydown", onKey);
      $("court").removeEventListener("pointerdown", onHit);
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
      box.addEventListener("pointerdown", onHit);
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
      setBallEffect(null);
      $("prompt").innerHTML = "&nbsp;";
      M.score[winner]++;
      const sideOut = winner !== M.serving;
      M.serving = winner;
      Rules.endRally(M.player);
      Rules.endRally(M.cpu);
      updateScore();
      updateTags();
      renderAbilityBar();
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
        updateTags();
        await wait(800);
      }
    }
  } catch (e) {
    if (!(e instanceof Abort)) throw e;
  }
}

const EFFECT = { fireball: "fire", shadowStrike: "shadow", tidalSet: "tidal" };

function useAbilityFx(side, team, pos, id) {
  const c = team.at[pos];
  Rules.useAbility(team, pos);
  pop(side, pos, c.active.name + "!", "ability");
  log(`<span class="abil">${who(side, c)} used ${c.active.name}!</span>`);
  updateTags();
  renderAbilityBar();
}

// Plays one rally. Returns { winner, reason }.
async function playRally() {
  const token = matchToken;
  const offSide = M.serving, defSide = other(offSide);
  const off = teamOf(offSide);
  const server = off.at[1];

  // CPU may switch on defensive abilities at the start of a rally
  AI.preRally(M.cpu, defSide === "cpu", M.smart).forEach((p) => {
    const c = M.cpu.at[p];
    pop("cpu", p, c.active.name + "!", "ability");
    log(`<span class="abil">${who("cpu", c)} used ${c.active.name}!</span>`);
  });
  updateTags();

  // ----- server walks behind the back line -----
  const sEl = elOf.get(server);
  const lane = Rules.lane(offSide, 1);
  sEl.style.left = XS[offSide].serve + "%";
  setHolder(offSide, 1);
  await flyBall({ x: XS[offSide].serve, y: LANE_Y[lane] - HEAD, gy: LANE_Y[lane] }, 650, 8);

  let target;
  if (offSide === "player") {
    target = (await askPlayer({ serve: true })).target;
    checkAlive(token);
  } else {
    $("prompt").innerHTML = `CPU's ${server.name} is serving…`;
    await wait(900);
    target = AI.easyTarget(M.player, M.smart);
  }
  // toss and hit
  await flyBall({ x: XS[offSide].serve, y: LANE_Y[lane] - HEAD - 14, gy: LANE_Y[lane] }, 350, 0);
  anim(server, "jump");
  await wait(150);
  const sv = Rules.serve(off);
  setHolder(null);
  sEl.style.left = feet(offSide, 1).x + "%"; // walk back in
  if (sv.fault) {
    await flyBall({ x: 50, y: LANE_Y[lane] - 4, gy: LANE_Y[lane] }, 500, 12);
    popAt(50, LANE_Y[lane] - 14, "Into the net!", "bad");
    log(`${who(offSide, server)} served into the net.`);
    await wait(500);
    return { winner: defSide, reason: `${offSide === "player" ? "Your" : "CPU's"} ${server.name} missed the serve` };
  }
  log(`${who(offSide, server)} serves.`);
  await flyBall(headPt(defSide, target), 900, 30);

  let incoming = { fromOpp: true, side: defSide, pos: target, power: sv.power, kind: "serve", aim: 1 };

  // ----- rally loop -----
  while (true) {
    const side = incoming.side;
    const T = teamOf(side), O = teamOf(other(side));
    const sideName = side === "player" ? "Your" : "CPU's";
    let holder, q, touch, isSet;

    if (incoming.fromOpp) {
      const rc = T.at[incoming.pos];
      const r = Rules.receive(T, incoming.pos, incoming.power, incoming.kind, incoming.aim);
      if (r.error) {
        anim(rc, "shake");
        await flyBall({ x: feet(side, incoming.pos).x, y: feet(side, incoming.pos).y, gy: feet(side, incoming.pos).y }, 250, 0);
        pop(side, incoming.pos, incoming.kind === "serve" ? "ACE!" : "Shanked!", "bad");
        log(`${who(side, rc)} couldn't dig it${incoming.kind === "serve" ? ". Ace!" : "."}`);
        await wait(500);
        return {
          winner: other(side),
          reason: incoming.kind === "serve" ? `Ace! ${sideName} ${rc.name} couldn't return the serve`
            : `${sideName} ${rc.name} couldn't dig it`,
        };
      }
      anim(rc, "dig");
      if (r.special) pop(side, incoming.pos, r.special, "ability");
      else {
        const [w, k] = r.quality >= 80 ? ["Perfect pass!", "good"] : r.quality >= 55 ? ["Nice dig!", "good"] : r.quality >= 30 ? ["Okay", ""] : ["Shaky…", "bad"];
        pop(side, incoming.pos, w, k);
      }
      holder = incoming.pos; q = r.quality; touch = 1; isSet = false;
    } else {
      holder = incoming.pos; q = incoming.quality; touch = incoming.touch; isSet = incoming.isSet;
    }

    setHolder(side, holder);
    const hc = T.at[holder];
    const canSpike = isSet && Rules.has(hc, "spiker");

    let action;
    if (side === "player") {
      action = await askPlayer({ holderPos: holder, touch, canSpike });
      checkAlive(token);
    } else {
      $("prompt").innerHTML = `CPU's ${hc.name} has the ball…`;
      await wait(600);
      action = AI.decide(T, O, holder, touch, isSet, M.smart);
    }
    if (action.special) useAbilityFx(side, T, holder, action.special);
    setBallEffect(EFFECT[action.special] || null);

    // ----- bump / set to a teammate -----
    if (action.type === "bump" || action.type === "set") {
      const asSet = action.type === "set";
      const mate = T.at[action.target];
      const p = asSet ? Rules.set(T, holder, action.target, q, action.special === "tidalSet") : Rules.bump(T, holder, action.target, q);
      anim(hc, asSet ? "jump" : "dig");
      setHolder(null);
      if (p.error) {
        const mid = feet(side, action.target);
        await flyBall({ x: (mid.x + feet(side, holder).x) / 2, y: mid.y, gy: mid.y }, 500, 15);
        pop(side, holder, asSet ? "Bad set!" : "Mishit!", "bad");
        log(`${who(side, hc)} ${asSet ? "botched the set" : "mishit the pass"}.`);
        await wait(500);
        return { winner: other(side), reason: `${sideName} ${hc.name} ${asSet ? "botched the set" : "mishit the pass"}` };
      }
      if (p.special) pop(side, holder, p.special, "ability");
      log(`${who(side, hc)} ${asSet ? "sets" : "bumps"} to ${mate.name}.`);
      await flyBall(headPt(side, action.target), asSet ? 650 : 600, asSet ? 24 : 18, EFFECT[action.special]);
      setBallEffect(asSet && T.buffs.tidal ? "tidal" : null);
      incoming = { fromOpp: false, side, pos: action.target, quality: p.quality, touch: touch + 1, isSet: asSet };
      continue;
    }

    // ----- spike -----
    if (action.type === "spike") {
      const timing = side === "player" ? await runTiming(hc.ctrl) : action.timing;
      checkAlive(token);
      if (T.buffs.tidal) setBallEffect("tidal");
      if (action.special === "fireball") setBallEffect("fire");
      if (action.special === "shadowStrike") setBallEffect("shadow");
      const fx = action.special === "fireball" ? "fire" : action.special === "shadowStrike" ? "shadow" : null;
      anim(hc, "jump");
      pop(side, holder, CONFIG.timing[timing].label, timing === "perfect" ? "big" : timing === "poor" || timing === "miss" ? "bad" : "good");
      await wait(180);
      setHolder(null);
      const res = Rules.spike(T, holder, q, O, action.target, timing, action.special);
      updateTags();
      const tgt = headPt(other(side), action.target);
      if (res.out) {
        const outX = side === "player" ? 99 : 1;
        await flyBall({ x: outX, y: tgt.y + 4, gy: tgt.gy + 4 }, 450, 6, fx);
        popAt(side === "player" ? 92 : 8, tgt.y, "OUT!", "bad");
        log(`${who(side, hc)} spikes… out!`);
        await wait(400);
        return { winner: other(side), reason: `${sideName} ${hc.name}'s spike went out` };
      }
      if (res.blocked) {
        const blocker = O.at[res.blockerPos];
        const bp = headPt(other(side), res.blockerPos);
        anim(blocker, "jump");
        await flyBall({ x: side === "player" ? 48 : 52, y: bp.y - 4, gy: bp.gy }, 260, 2, fx);
        pop(other(side), res.blockerPos, "BLOCKED!", "big");
        const fall = feet(side, holder);
        await flyBall({ x: side === "player" ? 44 : 56, y: fall.y, gy: fall.y }, 380, 8);
        log(`${who(side, hc)} spikes. Stuffed by ${who(other(side), blocker)}!`);
        await wait(400);
        return { winner: other(side), reason: `${other(side) === "player" ? "Your" : "CPU's"} ${blocker.name} blocked it` };
      }
      log(`${who(side, hc)} spikes hard!`);
      await flyBall(tgt, 380, 4, fx);
      setBallEffect(null);
      incoming = { fromOpp: true, side: other(side), pos: action.target, power: res.power, kind: "spike", aim: res.aimMult };
      continue;
    }

    // ----- sneaky seed (attack on 2) -----
    if (action.type === "sneaky") {
      anim(hc, "jump");
      setHolder(null);
      const res = Rules.sneaky(T, holder);
      const tgt = headPt(other(side), action.target);
      if (res.out) {
        await flyBall({ x: side === "player" ? 99 : 1, y: tgt.y, gy: tgt.gy }, 500, 10);
        log(`${who(side, hc)}'s sneaky attack went out!`);
        return { winner: other(side), reason: `${sideName} ${hc.name}'s sneaky attack went out` };
      }
      log(`${who(side, hc)} attacks on the 2nd touch!`);
      await flyBall(tgt, 450, 10);
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
      return { winner: other(side), reason: `${sideName} ${hc.name}'s free ball went out` };
    }
    log(`${who(side, hc)} sends a free ball over.`);
    await flyBall(tgt, 850, 30);
    incoming = { fromOpp: true, side: other(side), pos: action.target, power: res.power, kind: "free", aim: 1 };
  }
}

function backToBuilder() {
  matchToken++;
  if (M && M.pending) { const p = M.pending; M.pending = null; p.resolve({ type: "abort" }); }
  M = null;
  $("timing").classList.add("hidden");
  $("banner").classList.add("hidden");
  $("endOverlay").classList.add("hidden");
  $("match").classList.add("hidden");
  $("builder").classList.remove("hidden");
  tip.classList.add("hidden");
  renderBuilder();
}
$("quitMatch").addEventListener("click", backToBuilder);
$("playAgain").addEventListener("click", backToBuilder);
