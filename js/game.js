// =====================================================================
//  VolleyStars game screens: team builder + match flow.
// =====================================================================

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const other = (side) => (side === "player" ? "cpu" : "player");
const byId = (id) => CREATURES.find((c) => c.id === id);

const STATS = [
  ["str", "STR", "#ff8a8a", "Strength"],
  ["ctrl", "CTL", "#7ad8ff", "Control"],
  ["sta", "STA", "#45d483", "Stamina"],
  ["per", "PER", "#ffd65c", "Perception"],
];
const CLASS_SHORT = { receiver: "REC", setter: "SET", spiker: "SPK" };

// Where a slot sits in a 2x3 grid. Slots 0-2 = front row, 3-5 = back row.
// The player's front row is on the right (by the net); the CPU's is on the left.
function gridPos(slot, side) {
  const row = Rules.lane(slot) + 1;
  const front = Rules.isFront(slot);
  const col = side === "player" ? (front ? 2 : 1) : (front ? 1 : 2);
  return { row, col };
}

function badgesHTML(c, cls = "badges") {
  return `<div class="${cls}">${c.classes
    .map((k) => `<span class="badge ${k}">${CLASS_SHORT[k]}</span>`).join("")}</div>`;
}

// ---------------- tooltip ----------------
const tip = $("tooltip");
function attachTooltip(el, getCreature) {
  el.addEventListener("mouseenter", () => {
    const c = getCreature();
    if (!c) return;
    const fat = c.fatigue !== undefined ? `<div>Tiredness: ${Math.round(c.fatigue * 100)}%</div>` : "";
    tip.innerHTML = `<b>${c.name}</b><div>${c.classes.join(", ")}</div>` +
      STATS.map(([k, , , full]) => `<div>${full}: ${c[k]}</div>`).join("") + fat;
    tip.classList.remove("hidden");
  });
  el.addEventListener("mousemove", (e) => {
    tip.style.left = Math.min(e.clientX + 14, window.innerWidth - 185) + "px";
    tip.style.top = e.clientY + 14 + "px";
  });
  el.addEventListener("mouseleave", () => tip.classList.add("hidden"));
}

// =====================================================================
//  TEAM BUILDER
// =====================================================================
const builder = { slots: Array(6).fill(null), server: null, selected: null };

try {
  const saved = JSON.parse(localStorage.getItem("volleystars-team") || "null");
  if (saved && Array.isArray(saved.slots)) {
    builder.slots = saved.slots.map((id) => (id && byId(id) ? id : null));
    builder.server = saved.server;
    if (saved.difficulty) $("difficulty").value = saved.difficulty;
  }
} catch (e) { /* no saved team, that's fine */ }

function saveTeam() {
  try {
    localStorage.setItem("volleystars-team", JSON.stringify({
      slots: builder.slots, server: builder.server, difficulty: $("difficulty").value,
    }));
  } catch (e) { /* storage not available */ }
}

function renderRoster() {
  const roster = $("roster");
  roster.innerHTML = "";
  CREATURES.forEach((c) => {
    const card = document.createElement("div");
    const placed = builder.slots.includes(c.id);
    card.className = "card" + (builder.selected === c.id ? " selected" : "") + (placed ? " placed" : "");
    card.innerHTML = `
      <img src="${c.img}" alt="${c.name}">
      <div class="name">${c.name}</div>
      ${badgesHTML(c)}
      ${STATS.map(([k, short, color]) => `
        <div class="stat-row"><span>${short}</span>
          <div class="stat-bar"><div style="width:${c[k]}%;background:${color}"></div></div>
          <span>${c[k]}</span></div>`).join("")}`;
    card.addEventListener("click", () => {
      if (placed) {
        builder.slots[builder.slots.indexOf(c.id)] = null;
      } else {
        builder.selected = builder.selected === c.id ? null : c.id;
      }
      renderBuilder();
    });
    roster.appendChild(card);
  });
}

function renderBuilderGrid() {
  const grid = $("builderGrid");
  grid.innerHTML = "";
  for (let s = 0; s < 6; s++) {
    const cell = document.createElement("div");
    const pos = gridPos(s, "player");
    cell.style.gridRow = pos.row;
    cell.style.gridColumn = pos.col;
    const id = builder.slots[s];
    cell.className = "cell builder-cell" + (id ? " filled" : "");
    if (id) {
      const c = byId(id);
      cell.innerHTML = `
        <button class="server-star ${builder.server === s ? "active" : ""}" title="Make server">★</button>
        ${badgesHTML(c, "mini-badges")}
        <img class="creature" src="${c.img}" alt="${c.name}">
        <div class="cname">${c.name}</div>`;
      cell.querySelector(".server-star").addEventListener("click", (e) => {
        e.stopPropagation();
        builder.server = s;
        renderBuilder();
      });
      attachTooltip(cell, () => byId(builder.slots[s]));
    }
    cell.addEventListener("click", () => {
      tip.classList.add("hidden");
      if (builder.selected) {
        builder.slots[s] = builder.selected;       // place (or swap in)
        builder.selected = null;
      } else if (id) {
        builder.slots[s] = null;                   // remove
      } else {
        $("builderMsg").textContent = "Pick a creature from the list first.";
        return;
      }
      renderBuilder();
    });
    grid.appendChild(cell);
  }
}

function renderBuilder() {
  const count = builder.slots.filter(Boolean).length;
  if (builder.server === null || !builder.slots[builder.server]) {
    const first = builder.slots.findIndex(Boolean);
    builder.server = first === -1 ? null : first;
  }
  renderRoster();
  renderBuilderGrid();
  const ok = count >= CONFIG.minTeam && count <= CONFIG.maxTeam;
  $("startMatch").disabled = !ok;
  $("builderMsg").textContent = ok
    ? `${count} creatures ready. ${byId(builder.slots[builder.server]).name} will serve.`
    : `You have ${count} creature${count === 1 ? "" : "s"}. You need at least ${CONFIG.minTeam}.`;
  saveTeam();
}

$("randomTeam").addEventListener("click", () => {
  const t = AI.buildTeam(CREATURES, 6);
  builder.slots = t.slots.map((c) => (c ? c.id : null));
  builder.server = t.serverSlot;
  builder.selected = null;
  renderBuilder();
});
$("difficulty").addEventListener("change", saveTeam);
$("startMatch").addEventListener("click", startMatch);

renderBuilder();

// =====================================================================
//  MATCH
// =====================================================================
let M = null;          // current match state
let matchToken = 0;    // changes when a match is quit, to stop old loops

class Abort extends Error {}
function checkAlive(token) { if (token !== matchToken) throw new Abort(); }
async function wait(ms) { const t = matchToken; await sleep(ms); checkAlive(t); }

const teamOf = (side) => M[side];
const who = (side, c) => `<span class="${side === "player" ? "you" : "cpu"}">${side === "player" ? "Your" : "CPU's"} ${c.name}</span>`;

function log(html) {
  const line = document.createElement("div");
  line.innerHTML = html;
  $("log").prepend(line);
}

function startMatch() {
  const diff = $("difficulty").value;
  const d = CONFIG.difficulty[diff];
  const cpu = AI.buildTeam(CREATURES, d.teamSize);
  matchToken++;
  M = {
    diff, smart: d.smart,
    player: {
      side: "player", mult: 1, serverSlot: builder.server,
      slots: builder.slots.map((id) => (id ? Rules.makeInstance(byId(id)) : null)),
    },
    cpu: { side: "cpu", mult: d.statMult, serverSlot: cpu.serverSlot, slots: cpu.slots },
    score: { player: 0, cpu: 0 },
    serving: Math.random() < 0.5 ? "player" : "cpu",
    pending: null,
    setOn: false,
    freeOn: false,
  };
  $("target").textContent = CONFIG.pointsToWin;
  $("log").innerHTML = "";
  $("builder").classList.add("hidden");
  $("match").classList.remove("hidden");
  buildCourt();
  updateScore();
  log(`Match start! ${M.serving === "player" ? "You serve" : "CPU serves"} first.`);
  matchLoop(matchToken);
}

const cellEls = { player: [], cpu: [] };

function buildCourt() {
  ["player", "cpu"].forEach((side) => {
    const grid = $(side === "player" ? "playerGrid" : "cpuGrid");
    grid.innerHTML = "";
    cellEls[side] = [];
    for (let s = 0; s < 6; s++) {
      const c = teamOf(side).slots[s];
      const cell = document.createElement("div");
      const pos = gridPos(s, side);
      cell.style.gridRow = pos.row;
      cell.style.gridColumn = pos.col;
      cell.className = "cell" + (c ? " filled" : "");
      if (c) {
        cell.innerHTML = `
          ${teamOf(side).serverSlot === s ? '<span class="server-star active" title="Server">★</span>' : ""}
          ${badgesHTML(c, "mini-badges")}
          <img class="creature" src="${c.img}" alt="${c.name}" ${side === "cpu" ? 'style="transform:scaleX(-1)"' : ""}>
          <div class="cname">${c.name}</div>
          <div class="fatigue" title="Tiredness"><div></div></div>`;
        attachTooltip(cell, () => teamOf(side).slots[s]);
      }
      cell.addEventListener("click", () => onCourtClick(side, s));
      grid.appendChild(cell);
      cellEls[side].push(cell);
    }
  });
  refreshFatigue();
}

function refreshFatigue() {
  ["player", "cpu"].forEach((side) => {
    teamOf(side).slots.forEach((c, s) => {
      if (!c) return;
      const bar = cellEls[side][s].querySelector(".fatigue > div");
      bar.style.width = Math.round(c.fatigue * 100) + "%";
      bar.style.backgroundPosition = `${c.fatigue * 100}% 0`;
    });
  });
}

function updateScore() {
  $("scorePlayer").textContent = M.score.player;
  $("scoreCpu").textContent = M.score.cpu;
  $("servePlayer").classList.toggle("on", M.serving === "player");
  $("serveCpu").classList.toggle("on", M.serving === "cpu");
}

// ---------- ball + effects ----------
function cellCenter(side, slot) {
  const court = $("court").getBoundingClientRect();
  const r = cellEls[side][slot].getBoundingClientRect();
  return { x: r.left - court.left + r.width / 2, y: r.top - court.top + r.height / 2 };
}

async function moveBall(side, slot, ms = 450) {
  const ball = $("ball");
  const p = cellCenter(side, slot);
  ball.style.transitionDuration = ms + "ms";
  ball.style.left = p.x - 17 + "px";
  ball.style.top = p.y - 40 + "px";
  ball.style.transform = `scale(1.5) rotate(${Math.random() * 360}deg)`;
  setTimeout(() => { ball.style.transform = "scale(1)"; }, ms / 2);
  await wait(ms + 50);
}

function pop(side, slot, text, kind = "") {
  const p = cellCenter(side, slot);
  const el = document.createElement("div");
  el.className = "pop " + kind;
  el.textContent = text;
  el.style.left = p.x + "px";
  el.style.top = p.y - 20 + "px";
  $("court").appendChild(el);
  setTimeout(() => el.remove(), 1200);
}

function shake(side, slot) {
  const el = cellEls[side][slot];
  el.classList.remove("shake");
  void el.offsetWidth;
  el.classList.add("shake");
}

function setHolder(side, slot) {
  ["player", "cpu"].forEach((s) => cellEls[s].forEach((el) => el.classList.remove("holder")));
  if (side) cellEls[side][slot].classList.add("holder");
}

// ---------- player input ----------
function askPlayer(opts) {
  return new Promise((resolve) => {
    M.pending = { ...opts, resolve };
    M.freeOn = false;
    refreshControls();
  });
}

function refreshControls() {
  const p = M && M.pending;
  ["player", "cpu"].forEach((s) => cellEls[s].forEach((el) => el.classList.remove("pick-mate", "pick-opp")));
  const setBtn = $("setToggle"), freeBtn = $("freeToggle");
  setBtn.textContent = "Set: " + (M && M.setOn ? "ON" : "OFF");
  setBtn.classList.toggle("on", !!(M && M.setOn));
  freeBtn.classList.toggle("on", !!(M && M.freeOn));
  if (!p) { setBtn.disabled = true; freeBtn.disabled = true; return; }

  if (p.serve) {
    cellEls.cpu.forEach((el) => el.classList.add("pick-opp"));
    setBtn.disabled = true; freeBtn.disabled = true;
    $("prompt").innerHTML = "<b>Your serve!</b> Click a spot on the CPU's side to aim at.";
    return;
  }
  const holder = M.player.slots[p.holderSlot];
  const canPass = p.touch < 3 && !M.freeOn;
  const oppClickable = p.canSpike || p.touch >= 3 || M.freeOn;
  if (canPass) {
    M.player.slots.forEach((c, s) => {
      if (c && s !== p.holderSlot) cellEls.player[s].classList.add("pick-mate");
    });
  }
  if (oppClickable) cellEls.cpu.forEach((el) => el.classList.add("pick-opp"));

  setBtn.disabled = p.touch >= 3;
  freeBtn.disabled = p.touch >= 3;
  freeBtn.textContent = p.canSpike ? "Free ball instead" : "Send it over";

  const touchTxt = `Touch ${p.touch}/3`;
  let msg;
  if (M.freeOn) msg = `Click a spot on the CPU's side to send a <b>free ball</b>.`;
  else if (p.canSpike) msg = `<b>${holder.name} can SPIKE!</b> Click a CPU creature/spot to hit at, or ${M.setOn ? "set" : "bump"} to a teammate.`;
  else if (p.touch >= 3) msg = `Last touch! Click a spot on the CPU's side to send it over.`;
  else msg = `Click a teammate to <b>${M.setOn ? "SET" : "bump"}</b> to.` +
    (M.setOn ? " A spiker who gets a set can spike." : " Turn on Set to set up a spike.");
  $("prompt").innerHTML = `<span class="muted">${touchTxt} ·</span> ${holder.name} has the ball. ${msg}`;
}

function onCourtClick(side, slot) {
  const p = M && M.pending;
  if (!p) return;
  const el = cellEls[side][slot];
  let action = null;
  if (p.serve && side === "cpu") action = { type: "serve", target: slot };
  else if (!p.serve && side === "player" && el.classList.contains("pick-mate")) {
    action = { type: M.setOn ? "set" : "bump", target: slot };
  } else if (!p.serve && side === "cpu" && el.classList.contains("pick-opp")) {
    action = { type: p.canSpike && !M.freeOn ? "spike" : "free", target: slot };
  }
  if (!action) return;
  M.pending = null;
  M.freeOn = false;
  refreshControls();
  p.resolve(action);
}

$("setToggle").addEventListener("click", () => { if (M) { M.setOn = !M.setOn; refreshControls(); } });
$("freeToggle").addEventListener("click", () => { if (M) { M.freeOn = !M.freeOn; refreshControls(); } });
document.addEventListener("keydown", (e) => {
  if (!M || !M.pending || M.pending.serve) return;
  if (e.key === "s" || e.key === "S") $("setToggle").click();
  if (e.key === "f" || e.key === "F") $("freeToggle").click();
});

// ---------- match flow ----------
async function matchLoop(token) {
  try {
    while (true) {
      const winner = await playRally();
      checkAlive(token);
      M.score[winner]++;
      M.serving = winner;
      Rules.recover(M.player);
      Rules.recover(M.cpu);
      refreshFatigue();
      updateScore();
      setHolder(null);
      log(`<span class="point">Point ${winner === "player" ? "YOU" : "CPU"}! ${M.score.player} – ${M.score.cpu}</span>`);
      const { player: a, cpu: b } = M.score;
      if ((a >= CONFIG.pointsToWin || b >= CONFIG.pointsToWin) && Math.abs(a - b) >= CONFIG.winBy) {
        $("endTitle").textContent = a > b ? "You win! 🏐" : "CPU wins!";
        $("endScore").textContent = `Final score: ${a} – ${b}`;
        $("endOverlay").classList.remove("hidden");
        return;
      }
      await wait(1300);
    }
  } catch (e) {
    if (!(e instanceof Abort)) throw e;
  }
}

function qualityWord(q) {
  if (q >= 80) return ["Perfect!", "good"];
  if (q >= 55) return ["Nice!", "good"];
  if (q >= 30) return ["Okay", ""];
  return ["Shaky…", "bad"];
}

// Plays one rally. Returns the side that won the point.
async function playRally() {
  const token = matchToken;
  const offSide = M.serving;
  const off = teamOf(offSide);
  const server = off.slots[off.serverSlot];
  M.setOn = false;
  refreshControls();

  await moveBall(offSide, off.serverSlot, 300);
  setHolder(offSide, off.serverSlot);

  // ----- serve -----
  let target;
  if (offSide === "player") {
    target = (await askPlayer({ serve: true })).target;
    checkAlive(token);
  } else {
    $("prompt").innerHTML = `CPU's ${server.name} is serving…`;
    await wait(900);
    target = AI.pickTarget(M.player, M.smart);
  }
  const sv = Rules.serve(server, off.mult);
  refreshFatigue();
  if (sv.fault) {
    pop(offSide, off.serverSlot, "Serve fault!", "bad");
    log(`${who(offSide, server)} served into the net.`);
    await wait(700);
    return other(offSide);
  }
  log(`${who(offSide, server)} serves.`);
  setHolder(null);
  await moveBall(other(offSide), target, 550);

  let incoming = { fromOpp: true, side: other(offSide), slot: target, power: sv.power, kind: "serve" };

  // ----- rally: keep going until someone wins the point -----
  while (true) {
    const side = incoming.side;
    const T = teamOf(side), O = teamOf(other(side));
    let holder, q, touch, isSet;

    if (incoming.fromOpp) {
      const cov = Rules.findCoverer(T, incoming.slot);
      if (cov.dove) {
        pop(side, incoming.slot, "Open spot!", "bad");
        await moveBall(side, cov.slot, 300);
        pop(side, cov.slot, "Dive!", "");
      }
      const rc = T.slots[cov.slot];
      const r = Rules.receive(rc, incoming.power, cov.coverMult, T.mult);
      refreshFatigue();
      if (r.error) {
        shake(side, cov.slot);
        pop(side, cov.slot, incoming.kind === "serve" ? "ACE!" : "Shanked!", "bad");
        log(`${who(side, rc)} couldn't handle it${incoming.kind === "serve" ? " — ace!" : "."}`);
        await wait(700);
        return other(side);
      }
      const [word, kind] = qualityWord(r.quality);
      pop(side, cov.slot, word, kind);
      holder = cov.slot; q = r.quality; touch = 1; isSet = false;
    } else {
      holder = incoming.slot; q = incoming.quality; touch = incoming.touch; isSet = incoming.isSet;
    }

    setHolder(side, holder);
    const hc = T.slots[holder];
    const canSpike = isSet && Rules.has(hc, "spiker");

    let action;
    if (side === "player") {
      action = await askPlayer({ holderSlot: holder, touch, canSpike });
      checkAlive(token);
    } else {
      $("prompt").innerHTML = `CPU's ${hc.name} has the ball…`;
      await wait(650);
      action = AI.decide(T, O, holder, touch, isSet, M.smart);
    }

    if (action.type === "bump" || action.type === "set") {
      const asSet = action.type === "set";
      const mate = T.slots[action.target];
      const p = Rules.pass(hc, holder, action.target, q, asSet, T.mult);
      refreshFatigue();
      if (p.error) {
        shake(side, holder);
        pop(side, holder, asSet ? "Bad set!" : "Mishit!", "bad");
        log(`${who(side, hc)} ${asSet ? "botched the set" : "mishit the pass"}.`);
        await wait(700);
        return other(side);
      }
      log(`${who(side, hc)} ${asSet ? "sets" : "bumps"} to ${mate.name}.`);
      setHolder(null);
      await moveBall(side, action.target, 420);
      incoming = { fromOpp: false, side, slot: action.target, quality: p.quality, touch: touch + 1, isSet: asSet };
      continue;
    }

    if (action.type === "spike") {
      const res = Rules.spike(hc, holder, q, O, T.mult, O.mult);
      refreshFatigue();
      pop(side, holder, "SPIKE!", "big");
      setHolder(null);
      if (res.out) {
        await moveBall(other(side), action.target, 300);
        pop(other(side), action.target, "Out!", "bad");
        log(`${who(side, hc)} spikes… out!`);
        await wait(700);
        return other(side);
      }
      if (res.blocked) {
        const blocker = O.slots[res.blockerSlot];
        await moveBall(other(side), res.blockerSlot, 280);
        pop(other(side), res.blockerSlot, "BLOCKED!", "big");
        await moveBall(side, holder, 280);
        log(`${who(side, hc)} spikes — stuffed by ${who(other(side), blocker)}!`);
        await wait(600);
        return other(side);
      }
      log(`${who(side, hc)} spikes hard!`);
      await moveBall(other(side), action.target, 320);
      incoming = { fromOpp: true, side: other(side), slot: action.target, power: res.power, kind: "spike" };
      continue;
    }

    // free ball
    const res = Rules.freeBall(hc, T.mult);
    refreshFatigue();
    setHolder(null);
    if (res.out) {
      await moveBall(other(side), action.target, 500);
      pop(other(side), action.target, "Out!", "bad");
      log(`${who(side, hc)} sends it over… out!`);
      await wait(700);
      return other(side);
    }
    log(`${who(side, hc)} sends a free ball over.`);
    await moveBall(other(side), action.target, 650);
    incoming = { fromOpp: true, side: other(side), slot: action.target, power: res.power, kind: "free" };
  }
}

function backToBuilder() {
  matchToken++;
  if (M && M.pending) { const p = M.pending; M.pending = null; p.resolve({ type: "abort" }); }
  M = null;
  $("endOverlay").classList.add("hidden");
  $("match").classList.add("hidden");
  $("builder").classList.remove("hidden");
  tip.classList.add("hidden");
  renderBuilder();
}
$("quitMatch").addEventListener("click", backToBuilder);
$("playAgain").addEventListener("click", backToBuilder);
