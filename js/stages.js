// =====================================================================
//  VolleyStars path: the five checkpoints, easiest first.
//  Edit freely. team = creature id for each court position 1-6
//  (1 = serves first, 2-4 = front row, 5-6 = back row; repeats are fine).
//  smart / timing = how well the CPU plays (0-1). ult = nuclear | comboStar | fortress
// =====================================================================

const STAGES = [
  {
    name: "The Frillet Swarm",
    tagline: "Lots of little fins. Not a lot of spikes.",
    team: { 1: "frillet", 2: "embake", 3: "frillet", 4: "aquero", 5: "frillet", 6: "frillet" },
    ult: "comboStar",
    smart: 0.1, timing: 0.05,
  },
  {
    name: "Barnyard Brawlers",
    tagline: "Hooves, paws and one very large beetle.",
    team: { 1: "moofle", 2: "carabix", 3: "obsision", 4: "felimelon", 5: "drylion", 6: "moofle" },
    ult: "nuclear",
    smart: 0.25, timing: 0.2,
  },
  {
    name: "Toxic Swamp",
    tagline: "Every touch stings a little more.",
    team: { 1: "desacti", 2: "toxipine", 3: "rokanock", 4: "toxipine", 5: "snumpkin", 6: "bramblet" },
    ult: "fortress",
    smart: 0.45, timing: 0.4,
  },
  {
    name: "Tidal Wave",
    tagline: "The current is always on their side.",
    team: { 1: "aquero", 2: "rokanock", 3: "aquivern", 4: "carabix", 5: "ripplet", 6: "aquivern" },
    ult: "comboStar",
    smart: 0.65, timing: 0.6,
  },
  {
    name: "Molten Fortress",
    tagline: "Walls of thorns. Rivers of lava. Good luck.",
    team: { 1: "bramblet", 2: "volcobra", 3: "bramblehorn", 4: "volcobra", 5: "aquivern", 6: "desacti" },
    ult: "nuclear",
    smart: 0.88, timing: 0.8,
  },
];
