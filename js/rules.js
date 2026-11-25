// =====================================================================
//  VolleyStars rules: all the math for serves, passes, sets, spikes,
//  blocks, abilities and the CPU's brain. Tweak CONFIG to balance.
// =====================================================================

const CONFIG = {
  pointsToWin: 15,          // first to this many points...
  winBy: 2,                 // ...and must lead by this many
  teamSize: 6,
  errorBelow: 10,           // a ball quality under this is an error (shank / bad set)

  classBonus: 1.15,         // doing your class's job
  classPenalty: 0.82,       // receiving / setting without that class
  backRowSpikeMult: 0.85,   // spiking from the back row is weaker (but harder to block)
  backRowSetAdjust: -6,     // setting from the back row is a bit worse
  windedMult: 0.8,          // a spiker who spiked recently hits weaker

  // Spike timing bar: power multiplier and extra chance to hit it out
  timing: {
    perfect: { power: 1.2,  out: 0,    label: "PERFECT!" },
    good:    { power: 1.1,  out: 0,    label: "Good hit" },
    ok:      { power: 1.0,  out: 0.02, label: "Okay hit" },
    poor:    { power: 0.85, out: 0.10, label: "Mistimed" },
    miss:    { power: 0.7,  out: 0.25, label: "Whiffed!" },
  },

  // CPU difficulty: stat multiplier and how smart its choices are (0-1)
  difficulty: {
    easy:   { statMult: 0.88, smart: 0.25 },
    normal: { statMult: 1.0,  smart: 0.6 },
    hard:   { statMult: 1.1,  smart: 0.95 },
  },
};

const Rules = {};
Rules.rand = (min, max) => min + Math.random() * (max - min);
Rules.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
Rules.POSITIONS = [1, 2, 3, 4, 5, 6];
Rules.FRONT = [2, 3, 4];

// ---------- court geometry ----------
// Volleyball positions: 1 = back right (server), 2 = front right, 3 = front middle,
// 4 = front left, 5 = back left, 6 = back middle. "Right" is from the team's view
// facing the net, so the two sides mirror each other on screen.
// lane = screen row (0 top, 1 middle, 2 bottom). Lanes line up across the net.
const LAYOUT = {
  player: { 4: [0, true], 3: [1, true], 2: [2, true], 5: [0, false], 6: [1, false], 1: [2, false] },
  cpu:    { 2: [0, true], 3: [1, true], 4: [2, true], 1: [0, false], 6: [1, false], 5: [2, false] },
};
Rules.lane = (side, pos) => LAYOUT[side][pos][0];
Rules.isFront = (pos) => pos >= 2 && pos <= 4;
Rules.dist = (side, a, b) =>
  Math.abs(Rules.lane(side, a) - Rules.lane(side, b)) + (Rules.isFront(a) === Rules.isFront(b) ? 0 : 1);
Rules.otherSide = (side) => (side === "player" ? "cpu" : "player");

// Clockwise rotation: whoever is in 2 moves to 1, 1 moves to 6, and so on.
Rules.rotate = (team) => {
  const old = { ...team.at };
  Rules.POSITIONS.forEach((p) => { team.at[p] = old[(p % 6) + 1]; });
};

Rules.has = (c, cls) => c.classes.includes(cls);
Rules.eff = (team, c, stat) => c[stat] * team.mult;

Rules.makeInstance = (base, lookIndex = 0) => ({
  ...base,
  classes: [...base.classes],
  img: base.looks[lookIndex] || base.looks[0],
  cooldown: 0,      // rallies until the active can be used again
  winded: 0,        // > 0 means it spiked recently and hits weaker
  spikes: 0,        // spikes this game (for Heating Up)
});

Rules.makeTeam = (side, at, mult) => ({ side, at, mult, buffs: {}, nineLivesUsed: false });

Rules.findPos = (team, id) => Rules.POSITIONS.find((p) => team.at[p].id === id);

// End of every rally: tick down cooldowns and winded, clear rally buffs
Rules.endRally = (team) => {
  Rules.POSITIONS.forEach((p) => {
    const c = team.at[p];
    if (c.cooldown > 0) c.cooldown--;
    if (c.winded > 0) c.winded--;
  });
  team.buffs = {};
};

// ---------- abilities ----------
// When an active can be pressed. ctx = { holderPos, touch, canSpike, serve }
Rules.abilityReady = (team, pos, ctx) => {
  const c = team.at[pos];
  if (c.cooldown > 0) return false;
  const holding = ctx.holderPos === pos && !ctx.serve;
  switch (c.active.id) {
    case "fireball":
    case "shadowStrike": return holding && ctx.canSpike;
    case "tidalSet":     return holding && ctx.touch === 2;
    case "sneakySeed":   return holding && ctx.touch === 2;
    case "hornWall":     return Rules.isFront(pos) && !team.buffs.hornWall;
    case "deepRoots":    return !team.buffs.deepRoots;
    case "stampede":     return !team.buffs.stampede;
  }
  return false;
};
Rules.useAbility = (team, pos) => {
  const c = team.at[pos];
  c.cooldown = ABILITY_COOLDOWN;
  if (["hornWall", "deepRoots", "stampede"].includes(c.active.id)) team.buffs[c.active.id] = true;
};

// ---------- actions ----------

// Serve from position 1. Strength = power, control = fewer faults.
Rules.serve = (team) => {
  const s = team.at[1];
  const faultChance = 0.03 + (100 - Rules.eff(team, s, "ctrl")) * 0.0012;
  if (Math.random() < faultChance) return { fault: true };
  return { fault: false, power: Rules.eff(team, s, "str") * 0.8 + Rules.rand(0, 20) };
};

// Receiving a ball from the other side. kind = "serve" | "spike" | "free".
// Spikes are dug with Defense; serves and free balls are read with Perception.
// aimMult < 1 means the ball was aimed somewhere awkward.
Rules.receive = (team, pos, power, kind, aimMult = 1) => {
  const c = team.at[pos];
  if (kind === "spike" && c.passive && c.active.id === "deepRoots" && team.buffs.deepRoots) {
    team.buffs.deepRoots = false;
    return { quality: 95, special: "Deep Roots!" };
  }
  const stat = kind === "spike" ? "def" : "per";
  let skill = Rules.eff(team, c, stat) * 0.7 + Rules.eff(team, c, "ctrl") * 0.3;
  if (c.passive.id === "rooted" && !Rules.isFront(pos) && kind === "spike") skill *= 1.15;
  if (team.buffs.stampede) skill *= 1.15;
  const cls = Rules.has(c, "receiver") ? CONFIG.classBonus : CONFIG.classPenalty;
  const spread = c.passive.id === "steadyHooves" ? 10 : 20;
  let quality = 50 + (skill * cls * aimMult - power) + Rules.rand(-spread, spread);
  if (quality < CONFIG.errorBelow) {
    const hasFeli = Rules.POSITIONS.some((p) => team.at[p].passive.id === "nineLives");
    if (hasFeli && !team.nineLivesUsed) {
      team.nineLivesUsed = true;
      return { quality: 30, special: "Nine Lives!" };
    }
    return { quality: 0, error: true };
  }
  return { quality: Rules.clamp(quality, 0, 100) };
};

function farPenalty(team, c, from, to) {
  const d = Rules.dist(team.side, from, to);
  return Math.max(0, (d - 1) * 14 * (1 - Rules.eff(team, c, "str") / 130));
}

// Touch 1 -> 2: a bump to a teammate (usually the setter)
Rules.bump = (team, from, to, inQ) => {
  const c = team.at[from];
  const spread = c.passive.id === "steadyHooves" ? 5 : 10;
  const q = inQ * 0.55 + Rules.eff(team, c, "ctrl") * 0.45 - farPenalty(team, c, from, to) + Rules.rand(-spread, spread);
  return { quality: Rules.clamp(q, 0, 100), error: q < CONFIG.errorBelow };
};

// Touch 2 -> 3: a set. Setters are much better at it.
Rules.set = (team, from, to, inQ, tidal = false) => {
  const c = team.at[from];
  if (tidal) { team.buffs.tidal = true; return { quality: 100, special: "Tidal Set!" }; }
  const cls = Rules.has(c, "setter") ? CONFIG.classBonus : CONFIG.classPenalty;
  let q = (inQ * 0.4 + Rules.eff(team, c, "ctrl") * 0.6) * cls - farPenalty(team, c, from, to);
  if (!Rules.isFront(from)) q += c.passive.id === "flowingSets" ? 8 : CONFIG.backRowSetAdjust;
  q += Rules.rand(-10, 10);
  return { quality: Rules.clamp(q, 0, 100), error: q < CONFIG.errorBelow };
};

// How risky / rewarding is aiming at targetPos from fromPos?
// Corners and cross-court shots are harder to dig but easier to hit out.
Rules.aim = (atkSide, fromPos, defSide, targetPos) => {
  const sLane = Rules.lane(atkSide, fromPos);
  const tLane = Rules.lane(defSide, targetPos);
  const laneDiff = Math.abs(sLane - tLane);
  const deep = !Rules.isFront(targetPos);
  const edge = tLane !== 1;
  return {
    sLane, tLane, line: laneDiff === 0,
    risk: (deep ? 0.03 : 0) + (edge ? 0.02 : 0) + laneDiff * 0.015,
    aimMult: 1 - (deep ? 0.04 : 0) - (edge ? 0.04 : 0) - laneDiff * 0.03,
  };
};

// Block chance for each defending front-row creature, based on the ball's path.
// Line shot: the blocker straight ahead matters most. Cross shot: less, but the
// blocker in the target's lane gets a chance too.
Rules.blockChances = (atk, fromPos, def, targetPos, power) => {
  const spiker = atk.at[fromPos];
  const a = Rules.aim(atk.side, fromPos, def.side, targetPos);
  const out = [];
  Rules.FRONT.forEach((bp) => {
    const b = def.at[bp];
    const bl = Rules.lane(def.side, bp);
    let weight = 0;
    if (bl === a.sLane) weight = a.line ? 1 : 0.55;
    else if (!a.line && bl === a.tLane) weight = 0.35;
    else if (a.line && Math.abs(bl - a.sLane) === 1) weight = 0.2;
    if (!weight) return;
    const blockSkill = (Rules.eff(def, b, "str") + Rules.eff(def, b, "per")) / 2;
    let chance = Rules.clamp(0.13 + (blockSkill - power * 0.85) * 0.005, 0.03, 0.32);
    if (b.passive.id === "ironShell") chance *= 1.35;
    if (b.active.id === "hornWall" && def.buffs.hornWall) chance = Math.min(0.75, chance * 2.5);
    if (spiker.passive.id === "menacing") chance *= 0.65;
    if (!Rules.isFront(fromPos)) chance *= 0.7;
    out.push({ pos: bp, chance: chance * weight });
  });
  return out;
};

// Spike! timing = "perfect" | "good" | "ok" | "poor" | "miss"
// special = "fireball" | "shadowStrike" | null
Rules.spike = (atk, fromPos, inQ, def, targetPos, timing, special) => {
  const c = atk.at[fromPos];
  const t = CONFIG.timing[timing];
  let power = Rules.eff(atk, c, "str") * (0.6 + inQ / 250) + Rules.rand(0, 12);
  if (!Rules.isFront(fromPos)) power *= CONFIG.backRowSpikeMult;
  if (c.winded > 0) power *= CONFIG.windedMult;
  power *= t.power;
  if (special === "fireball") power *= 1.35;
  if (atk.buffs.tidal) { power *= 1.15; atk.buffs.tidal = false; }
  if (c.passive.id === "heatingUp") power *= 1 + Math.min(0.2, 0.02 * c.spikes);
  c.spikes++;
  c.winded = 2; // weaker through the end of the next rally

  const a = Rules.aim(atk.side, fromPos, def.side, targetPos);
  const outChance = 0.01 + (100 - Rules.eff(atk, c, "ctrl")) * 0.001 + (100 - inQ) * 0.0008 + a.risk + t.out;
  if (Math.random() < outChance) return { out: true, power, aimMult: a.aimMult };

  if (special !== "shadowStrike") {
    for (const b of Rules.blockChances(atk, fromPos, def, targetPos, power)) {
      if (Math.random() < b.chance) return { blocked: true, blockerPos: b.pos, power };
    }
  }
  return { power, aimMult: a.aimMult };
};

// Felimelon's Sneaky Seed: attack on the 2nd touch. Soft, but catches them off guard.
Rules.sneaky = (atk, fromPos) => {
  const c = atk.at[fromPos];
  if (Math.random() < 0.03) return { out: true };
  return { power: 40 + Rules.eff(atk, c, "str") * 0.35 + Rules.rand(0, 10), aimMult: 0.75 };
};

// Free ball: a soft, easy-to-receive hit over the net.
Rules.freeBall = (team, pos) => {
  const c = team.at[pos];
  if (Math.random() < 0.02 + (100 - Rules.eff(team, c, "ctrl")) * 0.0005) return { out: true };
  return { power: 25 + Rules.eff(team, c, "str") * 0.2 + Rules.rand(0, 10) };
};

// ---------- CPU brain ----------
const AI = {};

AI.receiveSkill = (team, pos, kind) => {
  const c = team.at[pos];
  const stat = kind === "spike" ? "def" : "per";
  const cls = Rules.has(c, "receiver") ? CONFIG.classBonus : CONFIG.classPenalty;
  return (c[stat] * 0.7 + c.ctrl * 0.3) * cls;
};

AI.randomPos = () => Rules.POSITIONS[Math.floor(Math.random() * 6)];

// Serve / free ball target: the weakest passer
AI.easyTarget = (def, smart) => {
  if (Math.random() > smart) return AI.randomPos();
  let best = 1, bestScore = Infinity;
  Rules.POSITIONS.forEach((p) => {
    const sc = AI.receiveSkill(def, p, "serve") + Rules.rand(-6, 6);
    if (sc < bestScore) { bestScore = sc; best = p; }
  });
  return best;
};

// Spike target: weak defenders, awkward spots, avoid big blockers and risky corners
AI.spikeTarget = (atk, fromPos, def, smart) => {
  if (Math.random() > smart) return AI.randomPos();
  const power = atk.at[fromPos].str * 0.9;
  let best = 1, bestScore = Infinity;
  Rules.POSITIONS.forEach((p) => {
    const a = Rules.aim(atk.side, fromPos, def.side, p);
    const block = Rules.blockChances(atk, fromPos, def, p, power).reduce((s, b) => s + b.chance, 0);
    const sc = AI.receiveSkill(def, p, "spike") * a.aimMult + a.risk * 250 + block * 150 + Rules.rand(-5, 5);
    if (sc < bestScore) { bestScore = sc; best = p; }
  });
  return best;
};

AI.timing = (smart) => {
  const r = Math.random();
  if (r < 0.1 + 0.25 * smart) return "perfect";
  if (r < 0.35 + 0.4 * smart) return "good";
  if (r < 0.85) return "ok";
  return r < 0.97 ? "poor" : "miss";
};

// Use team-wide abilities before/while defending
AI.preRally = (team, receivingServe, smart) => {
  const used = [];
  Rules.POSITIONS.forEach((p) => {
    const c = team.at[p];
    if (!Rules.abilityReady(team, p, {})) return;
    const id = c.active.id;
    if (id === "hornWall" && Math.random() < smart * 0.7) used.push(p);
    if (id === "stampede" && receivingServe && Math.random() < smart * 0.6) used.push(p);
    if (id === "deepRoots" && Math.random() < smart * 0.5) used.push(p);
  });
  used.forEach((p) => Rules.useAbility(team, p));
  return used;
};

// What does the CPU creature holding the ball do?
// Returns { type: "bump" | "set" | "spike" | "sneaky" | "free", target, special, timing }
AI.decide = (team, opp, holder, touch, inIsSet, smart) => {
  const c = team.at[holder];
  const mates = Rules.POSITIONS.filter((p) => p !== holder);
  const ctx = { holderPos: holder, touch, canSpike: inIsSet && Rules.has(c, "spiker") };

  if (touch === 3 || (touch > 1 && ctx.canSpike)) {
    if (ctx.canSpike) {
      let special = null;
      if (Rules.abilityReady(team, holder, ctx) && Math.random() < smart * 0.8) special = c.active.id;
      return { type: "spike", target: AI.spikeTarget(team, holder, opp, smart), special, timing: AI.timing(smart) };
    }
    return { type: "free", target: AI.easyTarget(opp, smart) };
  }

  if (touch === 1) {
    if (Math.random() > smart) return { type: "bump", target: mates[Math.floor(Math.random() * 5)] };
    let best = mates[0], bestScore = -Infinity;
    mates.forEach((p) => {
      const m = team.at[p];
      const sc = m.ctrl + (Rules.has(m, "setter") ? 35 : 0) - Rules.dist(team.side, holder, p) * 6;
      if (sc > bestScore) { bestScore = sc; best = p; }
    });
    return { type: "bump", target: best };
  }

  // touch 2
  if (c.active.id === "sneakySeed" && Rules.abilityReady(team, holder, ctx) && Math.random() < 0.3 * smart) {
    return { type: "sneaky", target: AI.spikeTarget(team, holder, opp, smart), special: "sneakySeed" };
  }
  const spikers = mates.filter((p) => Rules.has(team.at[p], "spiker"));
  if (!spikers.length) return { type: "free", target: AI.easyTarget(opp, smart) };
  let best = spikers[Math.floor(Math.random() * spikers.length)];
  if (Math.random() < smart) {
    let bestScore = -Infinity;
    spikers.forEach((p) => {
      const m = team.at[p];
      const sc = m.str + m.ctrl * 0.5 + (Rules.isFront(p) ? 12 : 0) - (m.winded > 0 ? 25 : 0)
        - Rules.dist(team.side, holder, p) * 5 + Rules.rand(-4, 4);
      if (sc > bestScore) { bestScore = sc; best = p; }
    });
  }
  const tidal = c.active.id === "tidalSet" && Rules.abilityReady(team, holder, ctx) && Math.random() < smart;
  return { type: "set", target: best, special: tidal ? "tidalSet" : null };
};

// Build a CPU team of 6: spikers up front, passers in back
AI.buildTeam = (roster) => {
  const pick = [...roster].sort(() => Math.random() - 0.5).slice(0, CONFIG.teamSize);
  pick.sort((a, b) => (Rules.has(b, "spiker") ? 1 : 0) - (Rules.has(a, "spiker") ? 1 : 0));
  const order = [4, 3, 2, 1, 6, 5];
  const at = {};
  pick.forEach((c, i) => { at[order[i]] = Rules.makeInstance(c, Math.floor(Math.random() * c.looks.length)); });
  return at;
};

// Let Node.js load this file for testing
if (typeof module !== "undefined") module.exports = { CONFIG, Rules, AI };
