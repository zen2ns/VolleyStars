// =====================================================================
//  VolleyStars rules: all the math for serves, passes, sets, spikes,
//  blocks and tiredness lives here. Tweak CONFIG to balance the game.
// =====================================================================

const CONFIG = {
  pointsToWin: 15,          // first to this many points...
  winBy: 2,                 // ...and must lead by this many
  minTeam: 3,
  maxTeam: 6,
  errorBelow: 10,           // a ball quality under this is an error (shank / bad set)

  // Tiredness: fatigue goes from 0 (fresh) to 1 (exhausted)
  fatiguePerTouch: 0.015,    // base fatigue per contact; higher stamina reduces this
  spikeFatigueMult: 1.5,    // spiking is extra tiring
  recoverPerRally: 0.006,   // everyone recovers a little after each rally
  fatigueStatLoss: 0.4,     // at max fatigue, stats are 40% lower

  // Class bonuses (multipliers)
  classBonus: 1.15,         // doing your class's job
  classPenalty: 0.82,       // receiving / setting without that class

  coverPenaltyPerStep: 0.78,// ball sent to an empty spot: nearest teammate dives, weaker per step
  backRowSpikeMult: 0.85,   // spiking from the back row is weaker (but harder to block)

  // CPU difficulty: stat multiplier, team size, and how smart its choices are (0-1)
  difficulty: {
    easy:   { statMult: 0.88, teamSize: 4, smart: 0.25 },
    normal: { statMult: 1.0,  teamSize: 5, smart: 0.6 },
    hard:   { statMult: 1.1,  teamSize: 6, smart: 0.95 },
  },
};

// ---------- small helpers ----------
const Rules = {};

Rules.rand = (min, max) => min + Math.random() * (max - min);
Rules.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Slots 0-2 are the front row (lanes top/middle/bottom), 3-5 the back row.
Rules.lane = (slot) => slot % 3;
Rules.isFront = (slot) => slot < 3;
Rules.dist = (a, b) =>
  Math.abs(Rules.lane(a) - Rules.lane(b)) + (Rules.isFront(a) === Rules.isFront(b) ? 0 : 1);

Rules.has = (c, cls) => c.classes.includes(cls);

// Effective stat after tiredness and team multiplier (CPU difficulty)
Rules.eff = (c, stat, mult = 1) =>
  c[stat] * (1 - CONFIG.fatigueStatLoss * c.fatigue) * mult;

Rules.tire = (c, factor = 1) => {
  const amount = CONFIG.fatiguePerTouch * (1.6 - c.sta / 100) * factor;
  c.fatigue = Rules.clamp(c.fatigue + amount, 0, 1);
};

Rules.recover = (team) => {
  team.slots.forEach((c) => {
    if (c) c.fatigue = Rules.clamp(c.fatigue - CONFIG.recoverPerRally, 0, 1);
  });
};

// Make a fresh in-match copy of a creature
Rules.makeInstance = (base) => ({ ...base, classes: [...base.classes], fatigue: 0 });

// ---------- actions ----------

// Serve: strength sets power, control lowers the chance of a fault.
Rules.serve = (server, mult) => {
  const faultChance = 0.03 + (100 - Rules.eff(server, "ctrl", mult)) * 0.0012;
  Rules.tire(server);
  if (Math.random() < faultChance) return { fault: true };
  const power = Rules.eff(server, "str", mult) * 0.8 + Rules.rand(0, 20);
  return { fault: false, power };
};

// Who plays a ball sent to `slot`? The creature there, or the nearest
// teammate diving for it (weaker the farther they have to go).
Rules.findCoverer = (team, slot) => {
  if (team.slots[slot]) return { slot, coverMult: 1, dove: false };
  let best = null;
  team.slots.forEach((c, s) => {
    if (!c) return;
    const d = Rules.dist(slot, s);
    if (!best || d < best.d) best = { slot: s, d };
  });
  return { slot: best.slot, coverMult: Math.pow(CONFIG.coverPenaltyPerStep, best.d), dove: true };
};

// Receiving a ball from the other side (serve, spike or free ball).
// Perception matters most, control helps. Returns a quality 0-100.
Rules.receive = (c, power, coverMult, mult) => {
  const skill = Rules.eff(c, "per", mult) * 0.7 + Rules.eff(c, "ctrl", mult) * 0.3;
  const cls = Rules.has(c, "receiver") ? CONFIG.classBonus : CONFIG.classPenalty;
  const quality = 50 + (skill * cls * coverMult - power) * 1.0 + Rules.rand(-20, 20);
  Rules.tire(c);
  return { quality: Rules.clamp(quality, 0, 100), error: quality < CONFIG.errorBelow };
};

// Bump or set to a teammate. Control aims it; strength helps reach far spots.
Rules.pass = (c, fromSlot, toSlot, inQuality, isSet, mult) => {
  const ctrl = Rules.eff(c, "ctrl", mult);
  let q = inQuality * 0.55 + ctrl * 0.45;
  if (isSet) q *= Rules.has(c, "setter") ? CONFIG.classBonus : CONFIG.classPenalty;
  const d = Rules.dist(fromSlot, toSlot);
  const farPenalty = Math.max(0, (d - 1) * 14 * (1 - Rules.eff(c, "str", mult) / 130));
  q = q - farPenalty + Rules.rand(-10, 10);
  Rules.tire(c);
  return { quality: Rules.clamp(q, 0, 100), error: q < CONFIG.errorBelow };
};

// Spike at the other team. Needs a set. Can go out, or get blocked.
Rules.spike = (c, fromSlot, inQuality, defTeam, attMult, defMult) => {
  let power = Rules.eff(c, "str", attMult) * (0.6 + inQuality / 250) + Rules.rand(0, 15);
  const backRow = !Rules.isFront(fromSlot);
  if (backRow) power *= CONFIG.backRowSpikeMult;
  Rules.tire(c, CONFIG.spikeFatigueMult);

  const outChance = 0.02 + (100 - Rules.eff(c, "ctrl", attMult)) * 0.001 + (100 - inQuality) * 0.0008;
  if (Math.random() < outChance) return { out: true, power };

  // Blocking: defending front-row creatures in the same lane (full chance)
  // or the lane next to it (smaller chance) can stuff the spike.
  const lane = Rules.lane(fromSlot);
  let notBlocked = 1;
  let bestBlocker = null;
  let bestChance = 0;
  for (let s = 0; s < 3; s++) {
    const b = defTeam.slots[s];
    if (!b) continue;
    const laneGap = Math.abs(lane - s);
    const weight = laneGap === 0 ? 1 : laneGap === 1 ? 0.35 : 0;
    if (!weight) continue;
    const blockSkill = (Rules.eff(b, "str", defMult) + Rules.eff(b, "per", defMult)) / 2;
    let chance = Rules.clamp(0.09 + (blockSkill - power * 0.85) * 0.005, 0.02, 0.3) * weight;
    if (backRow) chance *= 0.7; // back-row spikes are harder to read... and block
    notBlocked *= 1 - chance;
    if (chance > bestChance) { bestChance = chance; bestBlocker = s; }
  }
  if (Math.random() > notBlocked) {
    Rules.tire(defTeam.slots[bestBlocker]);
    return { out: false, blocked: true, blockerSlot: bestBlocker, power };
  }
  return { out: false, blocked: false, power };
};

// Free ball: a soft, easy-to-receive hit over the net.
Rules.freeBall = (c, mult) => {
  Rules.tire(c, 0.6);
  const outChance = 0.02 + (100 - Rules.eff(c, "ctrl", mult)) * 0.0005;
  if (Math.random() < outChance) return { out: true };
  return { out: false, power: 25 + Rules.eff(c, "str", mult) * 0.2 + Rules.rand(0, 10) };
};

// ---------- CPU brain ----------
const AI = {};

// How good would `team` be at receiving a ball sent to `slot`? (lower = better target)
AI.receiveScore = (team, slot) => {
  const cov = Rules.findCoverer(team, slot);
  const c = team.slots[cov.slot];
  const skill = Rules.eff(c, "per") * 0.7 + Rules.eff(c, "ctrl") * 0.3;
  const cls = Rules.has(c, "receiver") ? CONFIG.classBonus : CONFIG.classPenalty;
  return skill * cls * cov.coverMult;
};

AI.pickTarget = (oppTeam, smart) => {
  const slots = [0, 1, 2, 3, 4, 5];
  if (Math.random() > smart) {
    // not thinking hard: aim at any creature
    const filled = slots.filter((s) => oppTeam.slots[s]);
    return filled[Math.floor(Math.random() * filled.length)];
  }
  let best = 0, bestScore = Infinity;
  slots.forEach((s) => {
    const sc = AI.receiveScore(oppTeam, s) + Rules.rand(-5, 5);
    if (sc < bestScore) { bestScore = sc; best = s; }
  });
  return best;
};

// Decide what the CPU creature holding the ball does.
// Returns { type: "bump" | "set" | "spike" | "free", target }
AI.decide = (team, oppTeam, holderSlot, touch, inIsSet, smart) => {
  const holder = team.slots[holderSlot];
  const mates = team.slots
    .map((c, s) => ({ c, s }))
    .filter((m) => m.c && m.s !== holderSlot);

  if (inIsSet && Rules.has(holder, "spiker")) {
    return { type: "spike", target: AI.pickTarget(oppTeam, smart) };
  }
  if (touch >= 3 || mates.length === 0) {
    return { type: "free", target: AI.pickTarget(oppTeam, smart) };
  }
  const randomMate = () => mates[Math.floor(Math.random() * mates.length)].s;

  if (touch === 1) {
    // pass to the best setter
    if (Math.random() > smart) return { type: "bump", target: randomMate() };
    let best = mates[0], bestScore = -Infinity;
    mates.forEach((m) => {
      const sc = Rules.eff(m.c, "ctrl") + (Rules.has(m.c, "setter") ? 35 : 0) - Rules.dist(holderSlot, m.s) * 6;
      if (sc > bestScore) { bestScore = sc; best = m; }
    });
    return { type: "bump", target: best.s };
  }

  // touch 2: set the best spiker
  const spikers = mates.filter((m) => Rules.has(m.c, "spiker"));
  if (spikers.length === 0) return { type: "free", target: AI.pickTarget(oppTeam, smart) };
  if (Math.random() > smart) {
    return { type: "set", target: spikers[Math.floor(Math.random() * spikers.length)].s };
  }
  let best = spikers[0], bestScore = -Infinity;
  spikers.forEach((m) => {
    const sc = Rules.eff(m.c, "str") + Rules.eff(m.c, "ctrl") * 0.5
      + (Rules.isFront(m.s) ? 10 : 0) - Rules.dist(holderSlot, m.s) * 5;
    if (sc > bestScore) { bestScore = sc; best = m; }
  });
  return { type: "set", target: best.s };
};

// Build a CPU team: spikers up front, receivers in back.
AI.buildTeam = (roster, size) => {
  const pool = [...roster].sort(() => Math.random() - 0.5).slice(0, size);
  const slots = Array(6).fill(null);
  const frontFirst = [...pool].sort((a, b) =>
    (Rules.has(b, "spiker") ? 1 : 0) - (Rules.has(a, "spiker") ? 1 : 0) || b.str - a.str);
  const order = [1, 0, 2, 4, 3, 5]; // fill middle lanes first
  frontFirst.forEach((c, i) => { slots[order[i]] = Rules.makeInstance(c); });
  // strongest creature serves
  let server = 0, bestStr = -1;
  slots.forEach((c, s) => { if (c && c.str > bestStr) { bestStr = c.str; server = s; } });
  return { slots, serverSlot: server };
};

// Let Node.js load this file for testing
if (typeof module !== "undefined") module.exports = { CONFIG, Rules, AI };
