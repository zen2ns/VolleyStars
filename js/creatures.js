// =====================================================================
//  VolleyStars creature list
//  Edit this file to change names, stats, classes, or ability text.
//
//  rank: "D" | "C" | "B" | "A" | "S"  (see RANKS below)
//  Stats go from 1 to 100:
//    str  = Strength    (serving, spiking, blocking, and passing/setting far)
//    ctrl = Control     (aiming the ball; used by every class; bigger timing sweet spot)
//    def  = Defense     (digging the other team's spikes)
//    per  = Perception  (receiving serves and free balls, and reading blocks)
//
//  Classes: "receiver", "setter", "spiker". A creature can have more than one.
//  Only spikers can spike. Setters set better. Receivers receive better.
//
//  The ability "id"s connect to code in js/rules.js, so change the names and
//  descriptions freely, but keep the ids the same unless you ask for new abilities.
//  "looks" is the default picture. "recolors" are extra skins bought in the Shop with Star Tokens
//  and picked in the Locker Room: { id, name, img }.
//  "size": optional on-court size multiplier for small drawings (1 if left out).
//  "faces": which way the drawing looks ("left" if left out). The game flips sprites so
//  every creature faces the net.
// =====================================================================

const ABILITY_COOLDOWN = 3; // rallies to wait after using an active ability

// Ranks, worst to best. Stats are built from the rank's average (D 55, C 62, B 69, A 81, S 95)
// and the creature's class. Higher ranks also show bigger on the court (minSize, plus an extra sizeBoost).
const RANKS = {
  D: { color: "#8a93a6", minSize: 1 },
  C: { color: "#45d483", minSize: 1 },
  B: { color: "#4fa3ff", minSize: 1 },
  A: { color: "#b14dff", minSize: 1.3, sizeBoost: 1.1 },
  S: { color: "#ffcc33", minSize: 1.5, sizeBoost: 1.12 },
};

const CREATURES = [
  {
    id: "embake", name: "Embake", looks: ["assets/creatures/embake.png"], size: 0.55,
    classes: ["spiker"],
    rank: "D",
    str: 70, ctrl: 59, def: 45, per: 47,
    passive: { id: "heatingUp", name: "Heating Up", text: "Every spike this game makes its next spikes a little stronger." },
    active: { id: "fireball", name: "Fireball", text: "Sets the ball on fire for a much stronger spike." },
  },
  {
    id: "obsision", name: "Obsision", looks: ["assets/creatures/obsision.png"],
    classes: ["spiker"],
    rank: "D",
    str: 73, ctrl: 60, def: 43, per: 43,
    passive: { id: "menacing", name: "Menacing", text: "Blockers facing its spikes are much weaker." },
    active: { id: "shadowStrike", name: "Shadow Strike", text: "A spike that can't be blocked." },
  },
  {
    id: "carabix", name: "Carabix", looks: ["assets/creatures/carabix.png"],
    classes: ["spiker"],
    rank: "C",
    str: 94, ctrl: 53, def: 46, per: 56,
    passive: { id: "ironShell", name: "Iron Shell", text: "A much stronger blocker in the front row." },
    active: { id: "hornWall", name: "Horn Wall", text: "For this rally, its block chance is huge (front row only)." },
  },
  {
    id: "ripplet", name: "Ripplet", looks: ["assets/creatures/ripplet.png"], faces: "right",
    classes: ["setter"],
    rank: "C",
    str: 48, ctrl: 81, def: 57, per: 62,
    passive: { id: "flowingSets", name: "Flowing Sets", text: "Sets better from the back row instead of worse." },
    active: { id: "tidalSet", name: "Tidal Set", text: "A perfect set, and the spike after it is stronger." },
  },
  {
    id: "drylion", name: "Drylion", looks: ["assets/creatures/drylion.png"],
    classes: ["receiver"],
    rank: "C",
    str: 41, ctrl: 59, def: 77, per: 71,
    passive: { id: "rooted", name: "Rooted", text: "Digs spikes even better from the back row." },
    active: { id: "leapBlock", name: "Leaping Block", text: "For this rally, when Drylion blocks from the front row it can leap sideways to block spikes aimed at the other rows (a bit less likely than head-on)." },
  },
  {
    id: "felimelon", name: "Felimelon", looks: ["assets/creatures/felimelon.png"],
    classes: ["setter"],
    rank: "C",
    str: 51, ctrl: 75, def: 58, per: 64,
    passive: { id: "nineLives", name: "Nine Lives", text: "Once per game, it saves a ball the team would have shanked." },
    active: { id: "sneakySeed", name: "Sneaky Seed", text: "On the 2nd touch, attack right away instead of setting. Catches the other team off guard." },
  },
  {
    id: "moofle", name: "Moofle", looks: ["assets/creatures/moofle_female.png"],
    recolors: [{ id: "cocoa", name: "Cocoa", img: "assets/creatures/recolors/moofle_cocoa.png" }],
    classes: ["receiver"],
    rank: "D",
    str: 51, ctrl: 48, def: 59, per: 62,
    passive: { id: "steadyHooves", name: "Steady Hooves", text: "Its passes are much more consistent." },
    active: { id: "stampede", name: "Stampede", text: "The whole team receives better for this rally." },
  },
  {
    id: "toxipine", name: "Toxipine", looks: ["assets/creatures/toxipine.png"],
    classes: ["spiker"],
    rank: "D",
    str: 57, ctrl: 51, def: 64, per: 49,
    passive: { id: "prickly", name: "Prickly", text: "Any spiker whose spike Toxipine digs gets Poisoned." },
    active: { id: "venomSpike", name: "Venom Spike", text: "A toxic spike. Whoever it's aimed at is Poisoned (digs and passes much worse) for this rally and the next two." },
  },
  {
    id: "snumpkin", name: "Snumpkin", looks: ["assets/creatures/snumpkin.png"],
    classes: ["setter"],
    rank: "D",
    str: 49, ctrl: 69, def: 46, per: 56,
    passive: { id: "longBody", name: "Long Body", text: "No penalty for passing or setting far away." },
    active: { id: "lanternSet", name: "Jack-o'-Lantern Set", text: "A spooky set: the other team's blockers are too scared to block the next spike, and momentum swings hard your way." },
  },
  {
    id: "desacti", name: "Desacti", looks: ["assets/creatures/desacti.png"],
    recolors: [{ id: "deepsea", name: "Deep Sea", img: "assets/creatures/recolors/desacti_deepsea.png" }],
    classes: ["receiver"],
    rank: "B",
    str: 48, ctrl: 69, def: 82, per: 77,
    passive: { id: "desertCalm", name: "Desert Calm", text: "Desacti's big digs swing momentum 1 extra." },
    active: { id: "cactusCover", name: "Cactus Cover", text: "For this rally, spikes aimed at a teammate next to Desacti get intercepted and dug by Desacti instead." },
  },
  {
    id: "volcobra", name: "Volcobra", looks: ["assets/creatures/volcobra.png"],
    recolors: [{ id: "jade", name: "Jade Flame", img: "assets/creatures/recolors/volcobra_jade.png" }],
    rank: "S",
    classes: ["spiker"],
    str: 100, ctrl: 95, def: 84, per: 87,
    passive: { id: "magmaVeins", name: "Magma Veins", text: "Never gets winded, and every spike it hits swings momentum +1." },
    active: { id: "eruption", name: "Eruption", text: "A lava spike with massive power that can't be blocked. Whoever digs it is Burned (passes and digs worse) for this rally and the next two." },
  },
  {
    id: "aquero", name: "Aquero", looks: ["assets/creatures/aquero.png"],
    recolors: [{ id: "reef", name: "Reef", img: "assets/creatures/recolors/aquero_reef.png" }],
    rank: "C",
    classes: ["receiver"],
    str: 51, ctrl: 62, def: 68, per: 67,
    passive: { id: "slippery", name: "Slippery", text: "Reads serves a little better." },
    active: { id: "highTide", name: "High Tide", text: "For this rally, your whole team receives better, and every good pass adds +1 extra momentum." },
  },
  {
    id: "aquivern", name: "Aquivern", looks: ["assets/creatures/aquivern.png"],
    recolors: [{ id: "kelp", name: "Kelp", img: "assets/creatures/recolors/aquivern_kelp.png" }], faces: "right",
    rank: "A",
    classes: ["receiver"],
    str: 69, ctrl: 83, def: 89, per: 83,
    passive: { id: "tailwind", name: "Tailwind", text: "Every pass it makes swings momentum +1." },
    active: { id: "slipstream", name: "Slipstream", text: "For this rally, when Aquivern passes, the ball rides a current: your team's next spike gets +25% power." },
  },
  {
    id: "bramblet", name: "Bramblet", looks: ["assets/creatures/bramblet.png"],
    recolors: [{ id: "ember", name: "Ember", img: "assets/creatures/recolors/bramblet_ember.png" }], faces: "right",
    rank: "B",
    classes: ["receiver"],
    str: 66, ctrl: 62, def: 76, per: 72,
    passive: { id: "thickHide", name: "Thick Hide", text: "Can't be Poisoned or Burned." },
    active: { id: "deepRoots", name: "Rooted Stance", text: "Its next dig this rally is automatically perfect." },
  },
  {
    id: "bramblehorn", name: "Bramblehorn", looks: ["assets/creatures/bramblehorn.png"],
    rank: "S",
    classes: ["receiver"],
    str: 100, ctrl: 80, def: 100, per: 97,
    passive: { id: "fortified", name: "Fortified", text: "Blocks much harder, and every block it makes swings momentum +2." },
    active: { id: "greatWall", name: "Great Wall", text: "For this rally, when Bramblehorn blocks it guards all three rows at full head-on strength." },
  },
  {
    id: "rokanock", name: "Rokanock", looks: ["assets/creatures/rokanock.png"],
    recolors: [{ id: "shadow", name: "Shadow", img: "assets/creatures/recolors/rokanock_shadow.png" }], faces: "right",
    rank: "C",
    classes: ["spiker"],
    str: 76, ctrl: 62, def: 53, per: 58,
    passive: { id: "kindling", name: "Kindling", text: "Its spikes are 10% stronger while momentum is on your side." },
    active: { id: "magmaSpit", name: "Magma Spit", text: "A scorching spike: whoever it's aimed at is Burned for this rally and the next two." },
  },
  {
    id: "frillet", name: "Frillet", looks: ["assets/creatures/frillet.png"],
    recolors: [{ id: "bog", name: "Bog", img: "assets/creatures/recolors/frillet_bog.png" }],
    rank: "D",
    classes: ["receiver"],
    str: 45, ctrl: 55, def: 61, per: 59,
    passive: { id: "frillyFins", name: "Frilly Fins", text: "Its passes are extra steady." },
    active: { id: "splashGuard", name: "Splash Guard", text: "For this rally, the next spike hit into Frillet's row loses 25% of its power to a splash of water." },
  },
  {
    id: "malull", name: "Malull", looks: ["assets/creatures/malull.png"],
    recolors: [{ id: "bubblegum", name: "Bubblegum", img: "assets/creatures/recolors/malull_bubblegum.png" }], size: 0.5,
    rank: "D",
    classes: ["receiver"],
    str: 44, ctrl: 50, def: 69, per: 58,
    passive: { id: "hardHead", name: "Hard Head", text: "Can never shank a float serve or a free ball." },
    active: { id: "coldSnap", name: "Cold Snap", text: "The other team's next spike loses 20% of its power." },
  },
  {
    id: "frostone", name: "Frostone", looks: ["assets/creatures/frostone.png"],
    recolors: [{ id: "rose", name: "Rose", img: "assets/creatures/recolors/frostone_rose.png" }],
    rank: "C",
    classes: ["receiver"],
    str: 51, ctrl: 55, def: 79, per: 64,
    passive: { id: "chillyTouch", name: "Chilly Touch", text: "Any spiker whose spike Frostone digs becomes Chilled (spikes 20% weaker) for this rally and the next." },
    active: { id: "snowdrift", name: "Snowdrift", text: "For this rally, every spike hit into Frostone's row loses 25% of its power." },
  },
  {
    id: "cryolith", name: "Cryolith", looks: ["assets/creatures/cryolith.png"],
    recolors: [{ id: "rose", name: "Rose Quartz", img: "assets/creatures/recolors/cryolith_rose.png" }], faces: "right",
    rank: "A",
    classes: ["receiver"],
    str: 69, ctrl: 69, def: 100, per: 85,
    passive: { id: "frozenWall", name: "Frozen Wall", text: "Blocks much harder, and any spiker it blocks or digs gets Chilled (spikes 20% weaker) for this rally and the next." },
    active: { id: "glacier", name: "Glacier", text: "For this rally, every spike at your team loses 20% of its power, and every spiker who hits into it gets Chilled." },
  },
  {
    id: "timbolt", name: "Timbolt", looks: ["assets/creatures/timbolt.png"],
    recolors: [{ id: "copper", name: "Copper", img: "assets/creatures/recolors/timbolt_copper.png" }],
    rank: "C",
    classes: ["setter"],
    str: 56, ctrl: 78, def: 53, per: 62,
    passive: { id: "static", name: "Static", text: "Its sets add +1 momentum." },
    active: { id: "joltSet", name: "Jolt Set", text: "Electrifies the next set: the spike gets +15% power and the timing bar moves at half speed." },
  },
  {
    id: "thundroak", name: "Thundroak", looks: ["assets/creatures/thundroak.png"],
    recolors: [{ id: "violet", name: "Violet Storm", img: "assets/creatures/recolors/thundroak_violet.png" }],
    rank: "A",
    classes: ["setter"],
    str: 77, ctrl: 100, def: 69, per: 77,
    passive: { id: "conductor", name: "Conductor", text: "Every spike off its sets is 10% stronger." },
    active: { id: "thunderSet", name: "Thunder Set", text: "A perfect, lightning-fast set: the next spike gets +25% power and a slower, easier timing bar." },
  },
  {
    id: "stook", name: "Stook", looks: ["assets/creatures/stook.png"],
    recolors: [{ id: "aqua", name: "Aqua", img: "assets/creatures/recolors/stook_aqua.png" }], size: 0.8,
    rank: "D",
    classes: ["setter"],
    str: 61, ctrl: 63, def: 44, per: 52,
    passive: { id: "hardHorns", name: "Hard Horns", text: "Blocks 25% better." },
    active: { id: "headbutt", name: "Headbutt", text: "On the 2nd touch, instead of setting, Stook rams the ball over as a real attack, before the other team can set a block." },
  },
  {
    id: "arbur", name: "Arbur", looks: ["assets/creatures/arbur.png"],
    recolors: [{ id: "glacier", name: "Glacier", img: "assets/creatures/recolors/arbur_glacier.png" }],
    rank: "B",
    classes: ["setter"],
    str: 62, ctrl: 87, def: 59, per: 69,
    passive: { id: "thermalShock", name: "Thermal Shock", text: "When the other team digs a spike off Arbur's set, the digger gets Chilled." },
    active: { id: "frostfireSet", name: "Frostfire Set", text: "A perfect set. The spike Burns whoever it's hit at; if it gets blocked, the blocker is Chilled instead." },
  },
  {
    id: "lochlo", name: "Lochlo", looks: ["assets/creatures/lochlo.png"],
    recolors: [{ id: "lime", name: "Lime", img: "assets/creatures/recolors/lochlo_lime.png" }], size: 0.85, faces: "right",
    rank: "D",
    classes: ["setter"],
    str: 50, ctrl: 69, def: 47, per: 55,
    passive: { id: "tidePool", name: "Tide Pool", text: "Its sets are better when the team has just dug a spike." },
    active: { id: "undertowSet", name: "Undertow Set", text: "A set so quick the other team's block goes up late: their block chance is halved on this spike." },
  },
  {
    id: "zaplet", name: "Zaplet", looks: ["assets/creatures/zaplet.png"],
    recolors: [{ id: "ember", name: "Ember", img: "assets/creatures/recolors/zaplet_ember.png" }], size: 0.78,
    rank: "D",
    classes: ["receiver"],
    str: 44, ctrl: 52, def: 66, per: 61,
    passive: { id: "sparkDig", name: "Spark Dig", text: "Every clean dig of a spike gives +1 momentum." },
    active: { id: "jumpstart", name: "Jumpstart", text: "Use right after Zaplet digs a spike: that pass gets a little better." },
  },
  {
    id: "zigazolt", name: "Zigazolt", looks: ["assets/creatures/zigazolt.png"],
    recolors: [{ id: "ember", name: "Ember", img: "assets/creatures/recolors/zigazolt_ember.png" }], size: 1.3, faces: "right",
    rank: "B",
    classes: ["receiver"],
    str: 55, ctrl: 63, def: 86, per: 72,
    passive: { id: "lightningReflexes", name: "Lightning Reflexes", text: "Dives to cover teammates' spikes twice as often as other receivers." },
    active: { id: "overcharge", name: "Overcharge", text: "Use right after Zigazolt digs a spike: that pass gets better, and your next spike gets a slower, easier timing bar." },
  },
  {
    id: "rexlet", name: "Rexlet", looks: ["assets/creatures/rexlet.png"],
    recolors: [{ id: "grape", name: "Grape", img: "assets/creatures/recolors/rexlet_grape.png" }], size: 0.85,
    rank: "D",
    classes: ["spiker"],
    str: 74, ctrl: 55, def: 47, per: 45,
    passive: { id: "tremor", name: "Tremor", text: "When one of its spikes gets dug, the pass comes out shaky." },
    active: { id: "groundPound", name: "Ground Pound", text: "A +30% spike that rattles the whole other team: they all dig worse against it." },
  },
];
