// =====================================================================
//  VolleyStars creature list
//  Edit this file to change names, stats, or classes, or to add creatures.
//
//  Stats go from 1 to 100:
//    str  = Strength    (serving, spiking, and setting/passing far)
//    ctrl = Control     (aiming the ball; used by every class)
//    sta  = Stamina     (higher = gets tired more slowly)
//    per  = Perception  (receiving the ball)
//
//  Classes: "receiver", "setter", "spiker". A creature can have more than one.
//  To add a creature, copy one block, give it a new id, and put its picture
//  in assets/creatures/.
// =====================================================================

const CREATURES = [
  {
    id: "obsision", name: "Obsision", img: "assets/creatures/obsision.png",
    classes: ["spiker"],
    str: 85, ctrl: 70, sta: 55, per: 50,
  },
  {
    id: "ripplet", name: "Ripplet", img: "assets/creatures/ripplet.png",
    classes: ["setter", "receiver"],
    str: 50, ctrl: 85, sta: 65, per: 62,
  },
  {
    id: "carabix", name: "Carabix", img: "assets/creatures/carabix.png",
    classes: ["spiker"],
    str: 92, ctrl: 52, sta: 70, per: 40,
  },
  {
    id: "drylion", name: "Drylion", img: "assets/creatures/drylion.png",
    classes: ["receiver"],
    str: 45, ctrl: 65, sta: 75, per: 82,
  },
  {
    id: "embake", name: "Embake", img: "assets/creatures/embake.png",
    classes: ["spiker"],
    str: 76, ctrl: 66, sta: 45, per: 55,
  },
  {
    id: "felimelon", name: "Felimelon", img: "assets/creatures/felimelon.png",
    classes: ["setter"],
    str: 55, ctrl: 80, sta: 60, per: 68,
  },
  {
    id: "moofle", name: "Moofle", img: "assets/creatures/moofle.png",
    classes: ["receiver"],
    str: 62, ctrl: 55, sta: 85, per: 72,
  },
  {
    id: "moofle_f", name: "Moofle ♀", img: "assets/creatures/moofle_female.png",
    classes: ["receiver"],
    str: 62, ctrl: 55, sta: 85, per: 72,
  },
];
