// =====================================================================
//  VolleyStars creature list
//  Edit this file to change names, stats, classes, or ability text.
//
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
// =====================================================================

const ABILITY_COOLDOWN = 3; // rallies to wait after using an active ability

const CREATURES = [
  {
    id: "embake", name: "Embake", looks: ["assets/creatures/embake.png"],
    classes: ["spiker"],
    str: 78, ctrl: 66, def: 50, per: 52,
    passive: { id: "heatingUp", name: "Heating Up", text: "Every spike this game makes its next spikes a little stronger." },
    active: { id: "fireball", name: "Fireball", text: "Sets the ball on fire for a much stronger spike." },
  },
  {
    id: "obsision", name: "Obsision", looks: ["assets/creatures/obsision.png"],
    classes: ["spiker"],
    str: 85, ctrl: 70, def: 50, per: 50,
    passive: { id: "menacing", name: "Menacing", text: "Blockers facing its spikes are much weaker." },
    active: { id: "shadowStrike", name: "Shadow Strike", text: "A spike that can't be blocked." },
  },
  {
    id: "carabix", name: "Carabix", looks: ["assets/creatures/carabix.png"],
    classes: ["spiker"],
    str: 92, ctrl: 52, def: 45, per: 55,
    passive: { id: "ironShell", name: "Iron Shell", text: "A much stronger blocker in the front row." },
    active: { id: "hornWall", name: "Horn Wall", text: "For this rally, its block chance is huge (front row only)." },
  },
  {
    id: "ripplet", name: "Ripplet", looks: ["assets/creatures/ripplet.png"],
    classes: ["setter", "receiver"],
    str: 50, ctrl: 85, def: 60, per: 65,
    passive: { id: "flowingSets", name: "Flowing Sets", text: "Sets better from the back row instead of worse." },
    active: { id: "tidalSet", name: "Tidal Set", text: "A perfect set, and the spike after it is stronger." },
  },
  {
    id: "drylion", name: "Drylion", looks: ["assets/creatures/drylion.png"],
    classes: ["receiver"],
    str: 45, ctrl: 65, def: 85, per: 78,
    passive: { id: "rooted", name: "Rooted", text: "Digs spikes even better from the back row." },
    active: { id: "deepRoots", name: "Deep Roots", text: "Its next dig this rally is automatically perfect." },
  },
  {
    id: "felimelon", name: "Felimelon", looks: ["assets/creatures/felimelon.png"],
    classes: ["setter"],
    str: 55, ctrl: 80, def: 62, per: 68,
    passive: { id: "nineLives", name: "Nine Lives", text: "Once per game, it saves a ball the team would have shanked." },
    active: { id: "sneakySeed", name: "Sneaky Seed", text: "On the 2nd touch, attack right away instead of setting. Catches the other team off guard." },
  },
  {
    id: "moofle", name: "Moofle", looks: ["assets/creatures/moofle.png", "assets/creatures/moofle_female.png"],
    classes: ["receiver"],
    str: 62, ctrl: 58, def: 72, per: 75,
    passive: { id: "steadyHooves", name: "Steady Hooves", text: "Its passes are much more consistent." },
    active: { id: "stampede", name: "Stampede", text: "The whole team receives better for this rally." },
  },
];
