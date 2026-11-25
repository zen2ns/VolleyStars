// =====================================================================
//  VolleyStars rules: all the math for serves, passes, sets, spikes,
//  blocks, combos, abilities and the CPU's brain. Tweak CONFIG to balance.
// =====================================================================

const CONFIG = {
  pointsToWin: 15,          // first to this many points...
  winBy: 2,                 // ...and must lead by this many
  teamSize: 6,
  errorBelow: 10,           // a ball quality under this is an error (shank / bad set)
  receiveBase: 54,          // higher = everyone digs more

  classBonus: 1.15,         // doing your class's job
  classPenalty: 0.82,       // receiving / setting without that class
  backRowSpikeMult: 0.85,   // spiking from the back row is weaker (but harder to block)
  backRowSetAdjust: -6,     // setting from the back row is a bit worse
  windedMult: 0.8,          // a spiker who spiked recently hits weaker

  // Momentum: one shared tug-of-war meter per rally (-6 CPU ... +6 you).
  // Good touches swing it your way; every level on your side makes your spikes this much stronger.
  momentumMax: 6,
  comboPowerPerLevel: 0.07,
  adaptPerLevel: 0.08,      // "Adapting": each recent spike at a creature makes it dig this much better
  comboPerfectPass: 75,     // pass/dig quality needed for a combo level
  comboPerfectSet: 80,      // set quality needed for a combo level

  // Timing bar results (spikes and hard serves)
  timing: {
    perfect: { power: 1.2,  out: 0,    serveOut: 0.02, combo: 2, label: "PERFECT!" },
    good:    { power: 1.1,  out: 0,    serveOut: 0.06, combo: 1, label: "Good hit" },
    ok:      { power: 1.0,  out: 0.02, serveOut: 0.14, combo: 0, label: "Okay hit" },
    poor:    { power: 0.85, out: 0.10, serveOut: 0.35, combo: 0, label: "Mistimed" },
    miss:    { power: 0.7,  out: 0.25, serveOut: 0.6,  combo: 0, label: "Whiffed!" },
  },

  // CPU difficulty: stat multiplier and how smart its choices are (0-1)
  difficulty: {
    easy:   { statMult: 0.85, smart: 0.25 },
    normal: { statMult: 0.94, smart: 0.5 },
    hard:   { statMult: 1.0,  smart: 0.9 },
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
  read: 0,          // Adapting: goes up when spiked at, fades each rally
  poison: 0,        // Poisoned: rallies left of digging/passing worse
});

Rules.makeTeam = (side, at, mult) => ({ side, at, mult, buffs: {}, nineLivesUsed: false });

// End of every rally: tick down cooldowns and winded, clear rally buffs
Rules.endRally = (team) => {
  Rules.POSITIONS.forEach((p) => {
    const c = team.at[p];
    if (c.cooldown > 0) c.cooldown--;
    if (c.winded > 0) c.winded--;
    if (c.read > 0) c.read--;
    if (c.poison > 0) c.poison--;
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
    case "venomSpike":
    case "shadowStrike": return holding && ctx.canSpike;
    case "lanternSet":
    case "tidalSet":     return holding && ctx.touch === 2;
    case "sneakySeed":   return holding && ctx.touch === 2;
    case "hornWall":     return Rules.isFront(pos) && !team.buffs.hornWall;
    case "deepRoots":    return !team.buffs.deepRoots;
    case "stampede":     return !team.buffs.stampede;
  }
  return false;
};
Rules.BUFF_ABILITIES = ["hornWall", "deepRoots", "stampede"];
Rules.useAbility = (team, pos) => {
  const c = team.at[pos];
  c.cooldown = ABILITY_COOLDOWN;
  if (Rules.BUFF_ABILITIES.includes(c.active.id)) team.buffs[c.active.id] = true;
};

// ---------- serves ----------
// type "float": always goes in, but is easy to receive.
// type "hard": timing bar; strong, but can go out.
Rules.serve = (team, type, timing = "ok") => {
  const s = team.at[1];
  if (type === "float") {
    return { power: Rules.eff(team, s, "str") * 0.45 + 15 + Rules.rand(0, 10) };
  }
  const t = CONFIG.timing[timing];
  const outChance = t.serveOut + (100 - Rules.eff(team, s, "ctrl")) * 0.001;
  if (Math.random() < outChance) return { fault: true };
  return { power: (Rules.eff(team, s, "str") * 0.85 + Rules.rand(0, 15)) * t.power };
};
// Hard serves can only be aimed at the back row; floats can go anywhere
Rules.serveTargets = (type) => (type === "hard" ? [1, 5, 6] : Rules.POSITIONS);
Rules.servePowerEstimate = (team, type) => {
  const s = team.at[1];
  return type === "float" ? Rules.eff(team, s, "str") * 0.45 + 20 : (Rules.eff(team, s, "str") * 0.85 + 7) * 1.1;
};

// ---------- receiving ----------
function receiveSkill(team, pos, kind) {
  const c = team.at[pos];
  const stat = kind === "spike" ? "def" : "per";
  let skill = Rules.eff(team, c, stat) * 0.7 + Rules.eff(team, c, "ctrl") * 0.3;
  let rooted = false;
  if (c.passive.id === "rooted" && !Rules.isFront(pos) && kind === "spike") { skill *= 1.15; rooted = true; }
  if (team.buffs.stampede) skill *= 1.15;
  if (c.poison > 0) skill *= 0.72; // Poisoned
  const adapting = kind === "spike" && c.read > 0;
  if (adapting) skill *= 1 + CONFIG.adaptPerLevel * c.read;
  const cls = Rules.has(c, "receiver") ? CONFIG.classBonus : CONFIG.classPenalty;
  return { skill: skill * cls, spread: c.passive.id === "steadyHooves" ? 10 : 20, rooted, adapting };
}

// Receiving a ball from the other side. kind = "serve" | "spike" | "free".
// Spikes are dug with Defense; serves and free balls are read with Perception.
// aimMult < 1 means the ball was aimed somewhere awkward.
Rules.receive = (team, pos, power, kind, aimMult = 1) => {
  const c = team.at[pos];
  const passives = [];
  if (kind === "spike" && c.active.id === "deepRoots" && team.buffs.deepRoots) {
    team.buffs.deepRoots = false;
    return { quality: 95, ability: "Deep Roots!", passives };
  }
  const r = receiveSkill(team, pos, kind);
  if (kind === "spike") c.read = Math.min(3, c.read + 1); // reads the next one better
  if (r.adapting) passives.push("Adapting");
  if (c.poison > 0) passives.push("Poisoned…");
  if (r.rooted) passives.push("Rooted");
  if (c.passive.id === "steadyHooves") passives.push("Steady Hooves");
  const quality = CONFIG.receiveBase + (r.skill * aimMult - power) + Rules.rand(-r.spread, r.spread);
  if (quality < CONFIG.errorBelow) {
    const feliPos = Rules.POSITIONS.find((p) => team.at[p].passive.id === "nineLives");
    if (feliPos && !team.nineLivesUsed) {
      team.nineLivesUsed = true;
      return { quality: 45, savedBy: feliPos, passives: ["Nine Lives!"] };
    }
    return { quality: 0, error: true, passives };
  }
  return { quality: Rules.clamp(quality, 0, 100), passives };
};

// Chance that a ball of this power, aimed at pos, gets shanked (used for the red target glow)
Rules.shankChance = (team, pos, power, kind, aimMult = 1) => {
  const c = team.at[pos];
  if (kind === "spike" && c.active.id === "deepRoots" && team.buffs.deepRoots) return 0;
  const r = receiveSkill(team, pos, kind);
  const mean = CONFIG.receiveBase + r.skill * aimMult - power;
  return Rules.clamp((CONFIG.errorBelow - mean + r.spread) / (2 * r.spread), 0, 1);
};

function farPenalty(team, c, from, to) {
  if (c.passive.id === "longBody") return 0;
  const d = Rules.dist(team.side, from, to);
  return Math.max(0, (d - 1) * 14 * (1 - Rules.eff(team, c, "str") / 130));
}

// Touch 1 -> 2: a bump to a teammate (usually the setter)
Rules.bump = (team, from, to, inQ) => {
  const c = team.at[from];
  const spread = c.passive.id === "steadyHooves" ? 5 : 10;
  const poisoned = c.poison > 0 ? 12 : 0;
  const q = inQ * 0.55 + Rules.eff(team, c, "ctrl") * 0.45 - poisoned - farPenalty(team, c, from, to) + Rules.rand(-spread, spread);
  return { quality: Rules.clamp(q, 0, 100), error: q < CONFIG.errorBelow, passives: spread === 5 ? ["Steady Hooves"] : [] };
};

// Touch 2 -> 3: a set. Setters are much better at it.
Rules.set = (team, from, to, inQ, tidal = false, lantern = false) => {
  const c = team.at[from];
  if (tidal) { team.buffs.tidal = true; return { quality: 100, passives: [] }; }
  if (lantern) team.buffs.spooked = true; // the other team's blockers are too scared to block
  const passives = [];
  if (c.passive.id === "longBody" && Rules.dist(team.side, from, to) > 1) passives.push("Long Body");
  const cls = Rules.has(c, "setter") ? CONFIG.classBonus : CONFIG.classPenalty;
  let q = (inQ * 0.4 + Rules.eff(team, c, "ctrl") * 0.6) * cls - farPenalty(team, c, from, to);
  if (!Rules.isFront(from)) {
    if (c.passive.id === "flowingSets") { q += 8; passives.push("Flowing Sets"); }
    else q += CONFIG.backRowSetAdjust;
  }
  q += Rules.rand(-10, 10);
  return { quality: Rules.clamp(q, 0, 100), error: q < CONFIG.errorBelow, passives };
};

// ---------- combos ----------
// How many combo levels a touch adds to the current chain
Rules.comboGain = (kind, quality) => {
  if (kind === "pass") return quality >= CONFIG.comboPerfectPass ? 1 : 0;
  if (kind === "set") return quality >= CONFIG.comboPerfectSet ? 1 : 0;
  return 0;
};

// ---------- spikes ----------
// How risky / rewarding is aiming at targetPos from fromPos?
// Corners and cross-court shots are harder to dig but easier to hit out.
Rules.aim = (atkSide, fromPos, defSide, targetPos) => {
  const sLane = Rules.lane(atkSide, fromPos);
  const tLane = Rules.lane(defSide, targetPos);
  const laneDiff = Math.abs(sLane - tLane);
  const deep = !Rules.isFront(targetPos);
  const edge = tLane !== 1;
  // Front row: harder to dig (but more likely to get blocked, see blockChances).
  // Back row: easier to dig, rarely blocked.
  return {
    sLane, tLane, line: laneDiff === 0, deep,
    risk: (deep ? 0.02 : 0) + (edge ? 0.02 : 0) + laneDiff * 0.015,
    aimMult: 1 - (deep ? -0.02 : 0.08) - (edge ? 0.03 : 0) - laneDiff * 0.025,
  };
};

// Spike power before randomness and timing. combo = combo level of this touch chain.
Rules.spikeBasePower = (atk, fromPos, inQ, combo, special) => {
  const c = atk.at[fromPos];
  let power = Rules.eff(atk, c, "str") * (0.6 + inQ / 250);
  if (!Rules.isFront(fromPos)) power *= CONFIG.backRowSpikeMult;
  if (c.winded > 0) power *= CONFIG.windedMult;
  if (special === "fireball") power *= 1.35;
  if (special === "venomSpike") power *= 1.1;
  if (atk.buffs.tidal) power *= 1.15;
  if (c.passive.id === "heatingUp") power *= 1 + Math.min(0.2, 0.02 * c.spikes);
  power *= 1 + CONFIG.comboPowerPerLevel * combo;
  return power;
};

// Block chance for each defending front-row creature, based on the ball's path.
// Line shot: the blocker straight ahead matters most. Cross shot: less, but the
// blocker in the target's lane gets a chance too.
Rules.blockChances = (atk, fromPos, def, targetPos, power) => {
  if (atk.buffs.spooked) return []; // Jack-o'-Lantern Set: nobody dares to block
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
    chance *= a.deep ? 0.65 : 1.4; // hitting short into the front row runs into blockers
    out.push({ pos: bp, chance: Math.min(0.8, chance * weight) });
  });
  return out;
};

Rules.spikeOutChance = (atk, fromPos, inQ, aimRisk, timing) => {
  const c = atk.at[fromPos];
  return 0.01 + (100 - Rules.eff(atk, c, "ctrl")) * 0.001 + (100 - inQ) * 0.0008 + aimRisk + CONFIG.timing[timing].out;
};

// Spike! timing = "perfect" | "good" | "ok" | "poor" | "miss"
// special = "fireball" | "shadowStrike" | null
Rules.spike = (atk, fromPos, inQ, def, targetPos, timing, special, combo = 0) => {
  const c = atk.at[fromPos];
  const passives = [];
  if (c.passive.id === "heatingUp" && c.spikes > 0) passives.push("Heating Up");
  let power = Rules.spikeBasePower(atk, fromPos, inQ, combo, special) + Rules.rand(0, 12);
  power *= CONFIG.timing[timing].power;
  atk.buffs.tidal = false;
  c.spikes++;
  c.winded = 2; // weaker through the end of the next rally

  const a = Rules.aim(atk.side, fromPos, def.side, targetPos);
  if (Math.random() < Rules.spikeOutChance(atk, fromPos, inQ, a.risk, timing)) {
    return { out: true, power, aimMult: a.aimMult, passives };
  }
  const spooked = !!atk.buffs.spooked;
  if (special !== "shadowStrike") {
    const blocks = Rules.blockChances(atk, fromPos, def, targetPos, power);
    atk.buffs.spooked = false;
    if (blocks.length && c.passive.id === "menacing") passives.push("Menacing");
    for (const b of blocks) {
      if (Math.random() < b.chance) {
        const bp = def.at[b.pos].passive.id === "ironShell" ? ["Iron Shell"] : [];
        return { blocked: true, blockerPos: b.pos, power, passives, blockerPassives: bp };
      }
    }
  }
  atk.buffs.spooked = false;
  if (spooked) passives.push("Blockers spooked!");
  return { power, aimMult: a.aimMult, passives, poison: special === "venomSpike" };
};

// Estimated chance a spike at targetPos wins the point (for the red target glow)
Rules.killChance = (atk, fromPos, inQ, def, targetPos, combo, special) => {
  const power = Rules.spikeBasePower(atk, fromPos, inQ, combo, special) * 1.1 + 6;
  const a = Rules.aim(atk.side, fromPos, def.side, targetPos);
  const out = Rules.spikeOutChance(atk, fromPos, inQ, a.risk, "good");
  const blocks = special === "shadowStrike" ? [] : Rules.blockChances(atk, fromPos, def, targetPos, power);
  const notBlocked = blocks.reduce((s, b) => s * (1 - b.chance), 1);
  return {
    kill: (1 - out) * notBlocked * Rules.shankChance(def, targetPos, power, "spike", a.aimMult),
    blocks,
    out,
  };
};

// Felimelon's Sneaky Seed: attack on the 2nd touch. Soft, but catches them off guard.
Rules.sneaky = (atk, fromPos, combo = 0) => {
  const c = atk.at[fromPos];
  if (Math.random() < 0.03) return { out: true };
  return { power: (40 + Rules.eff(atk, c, "str") * 0.35 + Rules.rand(0, 10)) * (1 + CONFIG.comboPowerPerLevel * combo), aimMult: 0.75 };
};

// Free ball: a soft, easy-to-receive hit over the net.
Rules.freeBall = (team, pos) => {
  const c = team.at[pos];
  if (Math.random() < 0.02 + (100 - Rules.eff(team, c, "ctrl")) * 0.0005) return { out: true };
  return { power: 25 + Rules.eff(team, c, "str") * 0.2 + Rules.rand(0, 10) };
};

// ---------- CPU brain ----------
const AI = {};

AI.randomPos = () => Rules.POSITIONS[Math.floor(Math.random() * 6)];

// Serve / free ball target: the weakest passer
AI.easyTarget = (def, smart, power = 50, options = Rules.POSITIONS) => {
  if (Math.random() > smart) return options[Math.floor(Math.random() * options.length)];
  let best = options[0], bestScore = -Infinity;
  options.forEach((p) => {
    const sc = Rules.shankChance(def, p, power, "serve") + Rules.rand(0, 0.05);
    if (sc > bestScore) { bestScore = sc; best = p; }
  });
  return best;
};

AI.serveType = (smart) => (Math.random() < 0.25 + 0.45 * smart ? "hard" : "float");

// Spike target: the spot with the best chance to win the point
AI.spikeTarget = (atk, fromPos, inQ, def, smart, combo, special) => {
  if (Math.random() > smart) return AI.randomPos();
  let best = 1, bestScore = -Infinity;
  Rules.POSITIONS.forEach((p) => {
    const k = Rules.killChance(atk, fromPos, inQ, def, p, combo, special);
    const sc = k.kill - k.out * 0.5 + Rules.rand(0, 0.04);
    if (sc > bestScore) { bestScore = sc; best = p; }
  });
  return best;
};

AI.timing = (smart) => {
  const r = Math.random();
  if (r < 0.06 + 0.2 * smart) return "perfect";
  if (r < 0.3 + 0.35 * smart) return "good";
  if (r < 0.82) return "ok";
  return r < 0.96 ? "poor" : "miss";
};

// Use team-wide abilities at the start of a rally
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
AI.decide = (team, opp, holder, touch, inIsSet, inQ, combo, smart) => {
  const c = team.at[holder];
  const mates = Rules.POSITIONS.filter((p) => p !== holder);
  const ctx = { holderPos: holder, touch, canSpike: inIsSet && Rules.has(c, "spiker") };

  if (touch === 3 || ctx.canSpike) {
    if (ctx.canSpike) {
      let special = null;
      if (Rules.abilityReady(team, holder, ctx) && Math.random() < smart * 0.8) special = c.active.id;
      return { type: "spike", target: AI.spikeTarget(team, holder, inQ, opp, smart, combo, special), special, timing: AI.timing(smart) };
    }
    return { type: "free", target: AI.easyTarget(opp, smart, 40) };
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
    return { type: "sneaky", target: AI.easyTarget(opp, smart, 60), special: "sneakySeed" };
  }
  const spikers = mates.filter((p) => Rules.has(team.at[p], "spiker"));
  if (!spikers.length) return { type: "free", target: AI.easyTarget(opp, smart, 40) };
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
  const setAbility = ["tidalSet", "lanternSet"].includes(c.active.id) && Rules.abilityReady(team, holder, ctx) && Math.random() < smart;
  return { type: "set", target: best, special: setAbility ? c.active.id : null };
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
