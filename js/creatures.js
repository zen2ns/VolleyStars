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
//  "looks" is a list of pictures you can choose between on the team screen.
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
    id: "embake", name: "Embake", looks: ["assets/creatures/embake.png"],
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
    id: "moofle", name: "Moofle", looks: ["assets/creatures/moofle.png", "assets/creatures/moofle_female.png"],
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
    classes: ["receiver"],
    rank: "B",
    str: 48, ctrl: 69, def: 82, per: 77,
    passive: { id: "desertCalm", name: "Desert Calm", text: "Desacti's big digs swing momentum 1 extra." },
    active: { id: "cactusCover", name: "Cactus Cover", text: "For this rally, spikes aimed at a teammate next to Desacti get intercepted and dug by Desacti instead." },
  },
  {
    id: "volcobra", name: "Volcobra", looks: ["assets/creatures/volcobra.png"],
    rank: "S",
    classes: ["spiker"],
    str: 100, ctrl: 95, def: 84, per: 87,
    passive: { id: "magmaVeins", name: "Magma Veins", text: "Never gets winded, and every spike it hits swings momentum +1." },
    active: { id: "eruption", name: "Eruption", text: "A lava spike with massive power that can't be blocked. Whoever digs it is Burned (passes and digs worse) for this rally and the next two." },
  },
  {
    id: "aquero", name: "Aquero", looks: ["assets/creatures/aquero.png"],
    rank: "C",
    classes: ["receiver"],
    str: 51, ctrl: 62, def: 68, per: 67,
    passive: { id: "slippery", name: "Slippery", text: "Reads serves a little better." },
    active: { id: "bubblePass", name: "Bubble Pass", text: "Its next pass this rally is perfect." },
  },
  {
    id: "aquivern", name: "Aquivern", looks: ["assets/creatures/aquivern.png"], faces: "right",
    rank: "A",
    classes: ["receiver"],
    str: 69, ctrl: 83, def: 89, per: 83,
    passive: { id: "tailwind", name: "Tailwind", text: "Every pass it makes swings momentum +1." },
    active: { id: "slipstream", name: "Slipstream", text: "For this rally, when Aquivern passes, the ball rides a current: your team's next spike gets +25% power." },
  },
  {
    id: "bramblet", name: "Bramblet", looks: ["assets/creatures/bramblet.png"], faces: "right",
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
    id: "rokanock", name: "Rokanock", looks: ["assets/creatures/rokanock.png"], faces: "right",
    rank: "C",
    classes: ["spiker"],
    str: 76, ctrl: 62, def: 53, per: 58,
    passive: { id: "kindling", name: "Kindling", text: "Its spikes are 10% stronger while momentum is on your side." },
    active: { id: "magmaSpit", name: "Magma Spit", text: "A scorching spike: whoever it's aimed at is Burned for this rally and the next two." },
  },
  {
    id: "frillet", name: "Frillet", looks: ["assets/creatures/frillet.png"],
    rank: "D",
    classes: ["receiver"],
    str: 45, ctrl: 55, def: 61, per: 59,
    passive: { id: "frillyFins", name: "Frilly Fins", text: "Its passes are extra steady." },
    active: { id: "splashGuard", name: "Splash Guard", text: "For this rally, the next spike hit into Frillet's row loses 25% of its power to a splash of water." },
  },
];
