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
  backRowSpikeMult: 0.75,   // spiking from the back row is weaker (but harder to block)
  backRowSetAdjust: -6,     // setting from the back row is a bit worse
  windedMult: 0.8,          // a spiker who spiked recently hits weaker

  // Momentum: one shared tug-of-war meter per rally (-6 CPU ... +6 you).
  // Good touches swing it your way; every level on your side makes your spikes this much stronger.
  momentumMax: 6,
  comboPowerPerLevel: 0.07,
  adaptPerLevel: 0.08,      // "Adapting": each recent spike at a creature makes it dig this much better

  // Blocking: the defending team picks ONE front-row blocker (or none) before each spike.
  // A blocker guards its whole row: spikes aimed into that row are very likely blocked.
  blockBase: 0.42,          // head-on block chance for an average blocker vs an average spike
  blockNeighborRow: 0.15,   // how much of that chance carries to the row next door
  leapRow: 0.55,            // Drylion's Leaping Block: share of the chance it keeps on other rows
  noBlockDigBonus: 1.15,    // "No block": everyone stays back and digs better
  recoverCoverMult: 0.85,

  // Ultimates: good plays (momentum you gain) charge your meter; it stays between rallies
  ultMax: 11,
  ultimates: {
    nuclear:  { name: "Nuclear Spike", text: "One spike with crazy power. Use it when any of your spikers is about to spike." },
    comboStar:{ name: "Combo Star", text: "Doubles all the momentum your team gains for the rest of the rally." },
    fortress: { name: "Iron Fortress", text: "Your whole front row blocks with huge power for the rest of the rally. Attackers will have to free ball." },
  },

  // Explosions: only spikes at least this strong get a big explosion (tuned to ~1 every 3 rallies)
  boomPower: 100,
  epicLevel: 5,          // momentum level at which a spike gets the slow-motion windup
  bounceSpikePower: 80,  // spikes this hard that aren't dug slam the floor and bounce away
  // receivers diving to cover a neighbor: chance = (avg of DEF & PER - floor) / scale, capped
  coverStatFloor: 55, coverStatScale: 150, coverMax: 0.3, coverDiveMult: 0.92,
  // extra momentum for cleanly digging a hard spike (power >= first number: +1, >= second: +2)
  digMomentum: [60, 80],
  bigBoomPower: 120,
  comboPerfectPass: 75,     // pass/dig quality needed for a combo level
  comboPerfectSet: 80,      // set quality needed for a combo level

  // Timing bar results (spikes and hard serves)
  timing: {
    perfect: { power: 1.2,  out: 0,    serveOut: 0,    combo: 2, label: "PERFECT!" }, // a perfect never goes out
    good:    { power: 1.1,  out: 0,    serveOut: 0.06, combo: 1, label: "Good hit" },
    ok:      { power: 1.0,  out: 0.02, serveOut: 0.14, combo: 0, label: "Okay hit" },
    poor:    { power: 0.85, out: 0.10, serveOut: 0.35, combo: 0, label: "Mistimed" },
    miss:    { power: 0.7,  out: 0.25, serveOut: 0.6,  combo: 0, label: "Whiffed!" },
  },

  // CPU difficulty only changes how WELL the CPU plays, never the rules or its stats:
  //   smart  = how good its choices are (targets, passes, blocks, abilities), 0-1
  //   timing = how well it hits its spike/serve timing bar, 0-1
  difficulty: {
    // team = how likely the CPU is to pick each rank when building its team
    easy:   { smart: 0.1,  timing: 0.05, team: { D: 6, C: 3, B: 0.6, A: 0.1, S: 0 } },
    normal: { smart: 0.3,  timing: 0.25, team: { D: 1.5, C: 4, B: 3, A: 0.8, S: 0.3 } },
    hard:   { smart: 0.85, timing: 0.78, team: { D: 0.1, C: 0.8, B: 3, A: 6, S: 8 } },
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
// Poison / Burn a creature (Thick Hide is immune). Returns true if it stuck.
Rules.afflict = (c, kind, rallies = 3) => {
  if (c.passive.id === "thickHide" && kind !== "chill") return false;
  c[kind] = rallies;
  return true;
};
Rules.isAfflicted = (c) => c.poison > 0 || c.burn > 0;
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
  burn: 0,          // Burned: same effect as poison, from lava abilities
  chill: 0,         // Chilled: spikes 20% weaker (ice abilities)
  recovering: false,// blocked and is getting back into position: can't play the next possession
});

Rules.makeTeam = (side, at, mult, ult = "nuclear") => ({ side, at, mult, buffs: {}, nineLivesUsed: false, ult, ultCharge: 0, blockerPos: null });
Rules.clearRecovering = (team) => Rules.POSITIONS.forEach((p) => { team.at[p].recovering = false; });
// Who can play a ball aimed at pos? Recovering blockers can't; the nearest free teammate dives.
Rules.availablePos = (team, pos) => {
  if (!team.at[pos].recovering) return pos;
  let best = pos, bd = 99;
  Rules.POSITIONS.forEach((p) => {
    if (team.at[p].recovering) return;
    const d = Rules.dist(team.side, p, pos);
    if (d < bd) { bd = d; best = p; }
  });
  return best;
};

// End of every rally: tick down cooldowns and winded, clear rally buffs
Rules.endRally = (team) => {
  Rules.POSITIONS.forEach((p) => {
    const c = team.at[p];
    if (c.cooldown > 0) c.cooldown--;
    if (c.winded > 0) c.winded--;
    if (c.read > 0) c.read--;
    if (c.poison > 0) c.poison--;
    if (c.burn > 0) c.burn--;
    if (c.chill > 0) c.chill--;
  });
  team.buffs = {};
  team.blockerPos = null;
  Rules.clearRecovering(team);
};

// ---------- abilities ----------
// When an active can be pressed. ctx = { holderPos, touch, canSpike, serve }
Rules.abilityReady = (team, pos, ctx) => {
  const c = team.at[pos];
  if (c.cooldown > 0) return false;
  const holding = ctx.holderPos === pos && !ctx.serve;
  switch (c.active.id) {
    case "fireball":
    case "eruption":
    case "magmaSpit":
    case "venomSpike":
    case "shadowStrike": return holding && ctx.canSpike;
    case "lanternSet":
    case "joltSet":
    case "thunderSet":
    case "headbutt":
    case "tidalSet":     return holding && ctx.touch === 2;
    case "sneakySeed":   return holding && ctx.touch === 2;
    case "hornWall":     return Rules.isFront(pos) && !team.buffs.hornWall;
    case "deepRoots":    return !team.buffs.deepRoots;
    case "stampede":     return !team.buffs.stampede;
    case "cactusCover":  return !team.buffs.cactusCover;
    case "leapBlock":    return Rules.isFront(pos) && !team.buffs.leapBlock;
    case "greatWall":    return Rules.isFront(pos) && !team.buffs.greatWall;
    case "bubblePass":   return !team.buffs.bubblePass;
    case "slipstream":   return !team.buffs.slipstream;
    case "splashGuard":  return !team.buffs.splashGuard;
    case "highTide":     return !team.buffs.highTide;
    case "coldSnap":     return !team.buffs.coldSnap;
    case "snowdrift":    return !team.buffs.snowdrift;
    case "glacier":      return !team.buffs.glacier;
  }
  return false;
};
Rules.BUFF_ABILITIES = ["hornWall", "deepRoots", "stampede", "cactusCover", "leapBlock", "greatWall", "bubblePass", "slipstream", "splashGuard",
  "highTide", "coldSnap", "snowdrift", "glacier"];
const STEADY = ["steadyHooves", "frillyFins"];

// Splash Guard: the next spike into Frillet's row loses 25% power (returns the new power)
Rules.splashGuard = (team, pos, power) => {
  if (!team.buffs.splashGuard) return null;
  const f = Rules.POSITIONS.find((p) => team.at[p].active.id === "splashGuard");
  if (!f || Rules.lane(team.side, f) !== Rules.lane(team.side, pos)) return null;
  team.buffs.splashGuard = false;
  return power * 0.75;
};

// Cactus Cover: a spike aimed at a teammate next to Desacti gets dug by Desacti instead
Rules.coverPos = (team, pos, kind) => {
  if (kind !== "spike" || !team.buffs.cactusCover) return pos;
  const d = Rules.POSITIONS.find((p) => team.at[p].active.id === "cactusCover");
  return d && d !== pos && Rules.dist(team.side, d, pos) === 1 ? d : pos;
};
// Every receiver can dive to cover a spike aimed at a teammate next to it.
// Better receivers (higher DEF and PER) cover more often; only covers if it would dig better.
Rules.autoCoverInfo = (team, pos, kind) => {
  if (kind !== "spike") return null;
  const tSkill = receiveSkill(team, pos, kind).skill;
  let best = null;
  Rules.POSITIONS.forEach((p) => {
    const c = team.at[p];
    if (p === pos || c.recovering || !Rules.has(c, "receiver") || Rules.dist(team.side, p, pos) !== 1) return;
    const skill = receiveSkill(team, p, kind).skill * CONFIG.coverDiveMult;
    if (skill <= tSkill) return;
    const avg = (Rules.eff(team, c, "def") + Rules.eff(team, c, "per")) / 2;
    const chance = Rules.clamp((avg - CONFIG.coverStatFloor) / CONFIG.coverStatScale, 0, CONFIG.coverMax);
    if (chance > 0 && (!best || chance > best.chance)) best = { pos: p, chance };
  });
  return best;
};
Rules.autoCover = (team, pos, kind) => {
  const b = Rules.autoCoverInfo(team, pos, kind);
  return b && Math.random() < b.chance ? b.pos : null;
};

// Receiver abilities used right after digging a spike upgrade that dig on the spot.
// personal: only the Star holding the ball can do it; team-wide ones work from anyone.
Rules.DIG_BOOST = {
  deepRoots: { personal: true, q: () => 95 },
  bubblePass: { personal: true, q: (q) => Math.max(85, q + 25) },
  slipstream: { personal: true, q: (q) => q + 15 },
  highTide: { personal: false, q: (q) => q + 12 },
  stampede: { personal: false, q: (q) => q + 12 },
};
Rules.digBoostReady = (team, pos, ctx) => {
  if (!ctx || !ctx.justDug || ctx.touch !== 1) return false;
  const c = team.at[pos];
  const b = Rules.DIG_BOOST[c.active.id];
  return !!b && c.cooldown <= 0 && !team.buffs[c.active.id] && (!b.personal || ctx.holderPos === pos);
};
// Applies the ability and returns the upgraded dig quality
Rules.digBoost = (team, pos, q) => {
  const c = team.at[pos];
  const nq = Rules.clamp(Rules.DIG_BOOST[c.active.id].q(q), 0, 100);
  c.cooldown = ABILITY_COOLDOWN;
  if (c.active.id !== "deepRoots") team.buffs[c.active.id] = true; // Rooted Stance is spent on this dig
  return Math.max(q, nq);
};
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
  const outChance = timing === "perfect" ? 0 : t.serveOut + (100 - Rules.eff(team, s, "ctrl")) * 0.001; // perfect never goes out
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
  if (team.buffs.highTide) skill *= 1.12;
  if (kind === "spike" && team.buffs.allBack) skill *= CONFIG.noBlockDigBonus;
  if (Rules.isAfflicted(c)) skill *= 0.72; // Poisoned or Burned
  if (c.passive.id === "slippery" && kind !== "spike") skill *= 1.1;
  const adapting = kind === "spike" && c.read > 0;
  if (adapting) skill *= 1 + CONFIG.adaptPerLevel * c.read;
  const cls = Rules.has(c, "receiver") ? CONFIG.classBonus : CONFIG.classPenalty;
  return { skill: skill * cls, spread: STEADY.includes(c.passive.id) ? 10 : 20, rooted, adapting };
}

// Receiving a ball from the other side. kind = "serve" | "spike" | "free".
// Spikes are dug with Defense; serves and free balls are read with Perception.
// aimMult < 1 means the ball was aimed somewhere awkward.
Rules.receive = (team, pos, power, kind, aimMult = 1) => {
  const c = team.at[pos];
  const passives = [];
  if (kind === "spike" && c.active.id === "deepRoots" && team.buffs.deepRoots) {
    team.buffs.deepRoots = false;
    return { quality: 95, ability: c.active.name + "!", passives };
  }
  if (c.active.id === "bubblePass" && team.buffs.bubblePass) {
    team.buffs.bubblePass = false;
    return { quality: 92, ability: "Bubble Pass!", passives };
  }
  const r = receiveSkill(team, pos, kind);
  if (kind === "spike") c.read = Math.min(3, c.read + 1); // reads the next one better
  if (r.adapting) passives.push("Adapting");
  if (c.poison > 0) passives.push("Poisoned…");
  if (c.burn > 0) passives.push("Burned…");
  if (c.passive.id === "slippery" && kind !== "spike") passives.push("Slippery");
  if (r.rooted) passives.push("Rooted");
  if (STEADY.includes(c.passive.id)) passives.push(c.passive.name);
  let quality = CONFIG.receiveBase + (r.skill * aimMult - power) + Rules.rand(-r.spread, r.spread);
  if (c.passive.id === "hardHead" && kind !== "spike" && quality < 25) { quality = 25; passives.push("Hard Head"); }
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
  pos = Rules.coverPos(team, pos, kind);
  if (team.at[pos].recovering) { pos = Rules.availablePos(team, pos); aimMult *= CONFIG.recoverCoverMult; }
  const one = (p, aim) => {
    const c = team.at[p];
    if (kind === "spike" && c.active.id === "deepRoots" && team.buffs.deepRoots) return 0;
    const r = receiveSkill(team, p, kind);
    const mean = CONFIG.receiveBase + r.skill * aim - power;
    return Rules.clamp((CONFIG.errorBelow - mean + r.spread) / (2 * r.spread), 0, 1);
  };
  const base = one(pos, aimMult);
  const cov = Rules.autoCoverInfo(team, pos, kind);
  return cov ? (1 - cov.chance) * base + cov.chance * one(cov.pos, aimMult * CONFIG.coverDiveMult) : base;
};

function farPenalty(team, c, from, to) {
  if (c.passive.id === "longBody") return 0;
  const d = Rules.dist(team.side, from, to);
  return Math.max(0, (d - 1) * 14 * (1 - Rules.eff(team, c, "str") / 130));
}

// Touch 1 -> 2: a bump to a teammate (usually the setter)
Rules.bump = (team, from, to, inQ) => {
  const c = team.at[from];
  if (c.active.id === "bubblePass" && team.buffs.bubblePass) {
    team.buffs.bubblePass = false;
    return { quality: 92, passives: ["Bubble Pass!"] };
  }
  const spread = STEADY.includes(c.passive.id) ? 5 : 10;
  const poisoned = Rules.isAfflicted(c) ? 12 : 0;
  const q = inQ * 0.55 + Rules.eff(team, c, "ctrl") * 0.45 - poisoned - farPenalty(team, c, from, to) + Rules.rand(-spread, spread);
  return { quality: Rules.clamp(q, 0, 100), error: q < CONFIG.errorBelow, passives: spread === 5 ? [c.passive.name] : [] };
};

// Touch 2 -> 3: a set. Setters are much better at it.
Rules.set = (team, from, to, inQ, tidal = false, lantern = false, special = null) => {
  const c = team.at[from];
  if (c.passive.id === "conductor") team.buffs.conductor = true; // next spike +10%
  if (special === "thunderSet") { team.buffs.thunder = true; return { quality: 100, passives: [] }; }
  if (special === "joltSet") team.buffs.jolt = true;
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
  if (special === "venomSpike" || special === "magmaSpit") power *= 1.1;
  if (special === "eruption") power *= 1.6;
  if (atk.buffs.slipBoost) power *= 1.25; // Aquivern's Slipstream
  if (c.passive.id === "kindling" && combo > 0) power *= 1.1;
  if (c.chill > 0) power *= 0.8;               // Chilled
  if (atk.buffs.jolt) power *= 1.15;           // Jolt Set
  if (atk.buffs.thunder) power *= 1.25;        // Thunder Set
  if (atk.buffs.conductor) power *= 1.1;       // Thundroak's Conductor
  if (special === "headbutt") power *= 0.95;
  if (atk.nuke) power *= 1.8; // Nuclear Spike
  if (atk.buffs.tidal) power *= 1.15;
  if (c.passive.id === "heatingUp") power *= 1 + Math.min(0.2, 0.02 * c.spikes);
  power *= 1 + CONFIG.comboPowerPerLevel * combo;
  return power;
};

// Block chance for each blocking creature. A blocker guards its whole ROW (lane):
// spiking straight into that row (at the blocker or the receiver behind it) is very
// likely to get blocked; the next row over has a small chance; the far row none.
Rules.blockChances = (atk, fromPos, def, targetPos, power) => {
  if (atk.buffs.spooked || atk.buffs.thunder) return []; // Jack-o'-Lantern / Thunder Set: unblockable
  const fortress = !!def.buffs.fortress;
  if (!fortress && !def.blockerPos) return []; // "No block"
  const spiker = atk.at[fromPos];
  const tLane = Rules.lane(def.side, targetPos);
  const out = [];
  Rules.FRONT.forEach((bp) => {
    if (!fortress && bp !== def.blockerPos) return; // only the chosen blocker jumps
    const b = def.at[bp];
    const gap = Math.abs(Rules.lane(def.side, bp) - tLane);
    const leap = gap > 0 && b.active.id === "leapBlock" && !!def.buffs.leapBlock;
    const wall = b.active.id === "greatWall" && !!def.buffs.greatWall; // guards every row head-on
    const weight = gap === 0 || wall ? 1 : leap ? CONFIG.leapRow : gap === 1 ? CONFIG.blockNeighborRow : 0;
    if (!weight) return;
    // blocking: Defense matters most, then Perception (reading the hitter), a little Strength
    const blockSkill = Rules.eff(def, b, "def") * 0.5 + Rules.eff(def, b, "per") * 0.35 + Rules.eff(def, b, "str") * 0.15;
    let chance = Rules.clamp(CONFIG.blockBase + (blockSkill - power * 0.85) * 0.006, 0.22, 0.65);
    if (b.passive.id === "ironShell") chance *= 1.2;
    if (b.passive.id === "fortified" || b.passive.id === "frozenWall") chance *= 1.4;
    if (b.passive.id === "hardHorns") chance *= 1.25;
    if (b.active.id === "hornWall" && def.buffs.hornWall) chance *= 1.35;
    if (spiker.passive.id === "menacing") chance *= 0.65;
    if (!Rules.isFront(fromPos)) chance *= 0.8;
    chance *= Rules.isFront(targetPos) ? 1.1 : 0.9;
    if (fortress) chance = Math.max(chance * 1.25, 0.55);
    if (atk.nuke) chance *= 0.5;
    out.push({ pos: bp, chance: Math.min(fortress ? 0.85 : 0.8, chance * weight), leap });
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
  // the defending team's ice
  let chillAttacker = false;
  if (def.buffs.coldSnap) { power *= 0.8; def.buffs.coldSnap = false; passives.push("Cold Snap!"); }
  if (def.buffs.glacier) { power *= 0.8; chillAttacker = true; passives.push("Glacier!"); }
  if (def.buffs.snowdrift) {
    const fp = Rules.POSITIONS.find((p) => def.at[p].active.id === "snowdrift");
    if (fp && Rules.lane(def.side, fp) === Rules.lane(def.side, targetPos)) { power *= 0.75; passives.push("Snowdrift!"); }
  }
  atk.buffs.jolt = false; atk.buffs.conductor = false;
  atk.buffs.tidal = false;
  atk.buffs.slipBoost = false;
  c.spikes++;
  c.winded = c.passive.id === "magmaVeins" ? 0 : 2; // weaker through the end of the next rally

  const a = Rules.aim(atk.side, fromPos, def.side, targetPos);
  // a PERFECT on the timing bar never goes out
  if (timing !== "perfect" && Math.random() < Rules.spikeOutChance(atk, fromPos, inQ, a.risk, timing) * (atk.nuke ? 0.5 : 1)) {
    return { out: true, power, aimMult: a.aimMult, passives };
  }
  const spooked = !!atk.buffs.spooked;
  if (special !== "shadowStrike" && special !== "eruption") {
    const blocks = Rules.blockChances(atk, fromPos, def, targetPos, power);
    atk.buffs.spooked = false;
    if (blocks.length && c.passive.id === "menacing") passives.push("Menacing");
    atk.buffs.thunder = false;
    for (const b of blocks) {
      if (Math.random() < b.chance) {
        const bpid = def.at[b.pos].passive.id;
        const bp = bpid === "ironShell" ? ["Iron Shell"] : bpid === "fortified" ? ["Fortified"] : bpid === "frozenWall" ? ["Frozen Wall"] : bpid === "hardHorns" ? ["Hard Horns"] : [];
        return { blocked: true, blockerPos: b.pos, power, passives, blockerPassives: bp, chillAttacker: chillAttacker || bpid === "frozenWall" };
      }
    }
  }
  atk.buffs.spooked = false;
  if (spooked) passives.push("Blockers spooked!");
  atk.buffs.thunder = false;
  return { power, aimMult: a.aimMult, passives, poison: special === "venomSpike", burn: special === "eruption" || special === "magmaSpit", chillAttacker };
};

// Estimated chance a spike at targetPos wins the point (for the red target glow)
Rules.killChance = (atk, fromPos, inQ, def, targetPos, combo, special) => {
  const power = Rules.spikeBasePower(atk, fromPos, inQ, combo, special) * 1.1 + 6;
  const a = Rules.aim(atk.side, fromPos, def.side, targetPos);
  const out = Rules.spikeOutChance(atk, fromPos, inQ, a.risk, "good");
  const blocks = special === "shadowStrike" || special === "eruption" ? [] : Rules.blockChances(atk, fromPos, def, targetPos, power);
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

// How the CPU does on the timing bar. skill 0 = often mistimes, 1 = mostly perfect.
AI.timing = (skill) => {
  const r = Math.random();
  if (r < 0.03 + 0.3 * skill) return "perfect";
  if (r < 0.2 + 0.45 * skill) return "good";
  if (r < 0.72 + 0.18 * skill) return "ok";
  return r < 0.93 + 0.05 * skill ? "poor" : "miss";
};

// Pick a blocker before the other team spikes (or null = no block, everyone digs).
// The blocker guards its row, so the CPU protects the row with its shakiest digger.
AI.chooseBlocker = (def, atk, spikerPos, smart) => {
  if (def.buffs.fortress) return null;
  if (Math.random() > smart) return Math.random() < 0.3 ? null : Rules.FRONT[Math.floor(Math.random() * 3)];
  const power = atk.at[spikerPos].str * 0.9;
  let best = null, bestScore = 0.22; // if every row digs this well, stay back instead
  Rules.FRONT.forEach((bp) => {
    const lane = Rules.lane(def.side, bp);
    const rowRisk = Math.max(...Rules.POSITIONS.filter((p) => Rules.lane(def.side, p) === lane)
      .map((p) => Rules.shankChance(def, p, power, "spike")));
    const b = def.at[bp];
    let sc = rowRisk * (0.7 + (b.def * 0.5 + b.per * 0.35 + b.str * 0.15) / 150);
    if (b.passive.id === "ironShell" || (b.active.id === "hornWall" && def.buffs.hornWall)) sc *= 1.2;
    if (b.active.id === "leapBlock" && def.buffs.leapBlock) sc *= 1.5;
    if (b.active.id === "greatWall" && def.buffs.greatWall) sc *= 3;
    if (b.passive.id === "fortified") sc *= 1.3;
    if (sc > bestScore) { bestScore = sc; best = bp; }
  });
  return best;
};

// Ultimate meter
// team.ult can be null (no ultimate unlocked yet): then the meter never charges
Rules.ultReady = (team) => !!team.ult && team.ultCharge >= CONFIG.ultMax;
Rules.chargeUlt = (team, n) => { if (n > 0 && team.ult) team.ultCharge = Math.min(CONFIG.ultMax, team.ultCharge + n); };
Rules.useUlt = (team) => {
  team.ultCharge = 0;
  if (team.ult === "comboStar") team.buffs.comboStar = true;
  if (team.ult === "fortress") { team.buffs.fortress = true; team.blockerPos = null; }
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
    if (id === "cactusCover" && !receivingServe && Math.random() < smart * 0.6) used.push(p);
    if (id === "leapBlock" && Math.random() < smart * 0.6) used.push(p);
    if (id === "greatWall" && !receivingServe && Math.random() < smart * 0.7) used.push(p);
    if (id === "bubblePass" && receivingServe && Math.random() < smart * 0.7) used.push(p);
    if (id === "slipstream" && Math.random() < smart * 0.6) used.push(p);
    if (id === "splashGuard" && !receivingServe && Math.random() < smart * 0.6) used.push(p);
    if (id === "highTide" && Math.random() < smart * 0.6) used.push(p);
    if (["coldSnap", "snowdrift", "glacier"].includes(id) && !receivingServe && Math.random() < smart * 0.6) used.push(p);
  });
  used.forEach((p) => Rules.useAbility(team, p));
  return used;
};

// What does the CPU creature holding the ball do?
// Returns { type: "bump" | "set" | "spike" | "sneaky" | "free", target, special, timing }
AI.decide = (team, opp, holder, touch, inIsSet, inQ, combo, smart) => {
  const c = team.at[holder];
  const mates = Rules.POSITIONS.filter((p) => p !== holder && !team.at[p].recovering);
  const ctx = { holderPos: holder, touch, canSpike: inIsSet && Rules.has(c, "spiker") };

  // An Iron Fortress is up: a smart attacker free balls instead of spiking into it
  if (ctx.canSpike && opp.buffs.fortress && Math.random() < smart * 0.85) {
    return { type: "free", target: AI.easyTarget(opp, smart, 40) };
  }
  if (touch === 3 || ctx.canSpike) {
    if (ctx.canSpike) {
      let special = null;
      if (Rules.abilityReady(team, holder, ctx) && Math.random() < smart * 0.8) special = c.active.id;
      return { type: "spike", target: AI.spikeTarget(team, holder, inQ, opp, smart, combo, special), special, timing: AI.timing(smart) };
    }
    return { type: "free", target: AI.easyTarget(opp, smart, 40) };
  }

  // Strategic early send-over: if every spiker is winded, don't waste a set on a tired
  // hitter. Send a free ball now and give them a rally to rest. (Smarter CPUs do this.)
  const spikersAll = mates.filter((p) => Rules.has(team.at[p], "spiker"));
  if (spikersAll.length && spikersAll.every((p) => team.at[p].winded > 0) && Math.random() < smart) {
    return { type: "free", target: AI.easyTarget(opp, smart, 40) };
  }
  if (touch === 1) {
    if (!mates.length) return { type: "free", target: AI.easyTarget(opp, smart, 40) };
    if (Math.random() > smart) return { type: "bump", target: mates[Math.floor(Math.random() * mates.length)] };
    let best = mates[0], bestScore = -Infinity;
    mates.forEach((p) => {
      const m = team.at[p];
      const sc = m.ctrl + (Rules.has(m, "setter") ? 35 : 0) - Rules.dist(team.side, holder, p) * 6;
      if (sc > bestScore) { bestScore = sc; best = p; }
    });
    return { type: "bump", target: best };
  }

  // touch 2
  if (c.active.id === "headbutt" && Rules.abilityReady(team, holder, ctx) && Math.random() < 0.35 * smart) {
    return { type: "spike", target: AI.spikeTarget(team, holder, inQ, opp, smart, combo, "headbutt"), special: "headbutt", timing: AI.timing(smart) };
  }
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
  const setAbility = ["tidalSet", "lanternSet", "joltSet", "thunderSet"].includes(c.active.id) && Rules.abilityReady(team, holder, ctx) && Math.random() < smart;
  return { type: "set", target: best, special: setAbility ? c.active.id : null };
};

// Build a CPU team of 6: spikers up front, passers in back
AI.buildTeam = (roster, weights = null) => {
  // pick 6 different creatures; with weights, better (or worse) ranks are more likely
  const pool = [...roster], pick = [];
  while (pick.length < CONFIG.teamSize && pool.length) {
    const w = pool.map((c) => (weights ? weights[c.rank] ?? 1 : 1) + 0.0001);
    let roll = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
    while (roll > w[k]) { roll -= w[k]; k++; }
    pick.push(pool.splice(k, 1)[0]);
  }
  pick.sort((a, b) => (Rules.has(b, "spiker") ? 1 : 0) - (Rules.has(a, "spiker") ? 1 : 0));
  const order = [4, 3, 2, 1, 6, 5];
  const at = {};
  pick.forEach((c, i) => { at[order[i]] = Rules.makeInstance(c, Math.floor(Math.random() * c.looks.length)); });
  return at;
};

// Let Node.js load this file for testing
if (typeof module !== "undefined") module.exports = { CONFIG, Rules, AI };
