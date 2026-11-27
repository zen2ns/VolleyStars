// =====================================================================
//  VolleyStars story mode data: 5 regions x 5 battles (battle 5 = championship).
//  All teams are tentative: edit freely as new creatures arrive.
//  team = creature id for each court position (1 serves first, 2-4 front row, 5-6 back row).
//  CPU skill rises automatically across the 25 battles (see storySkill below).
// =====================================================================

const STARTER_COLLECTION = { moofle: 2, frillet: 2, snumpkin: 1, toxipine: 1 };

const STORY_DRAFT = {
  wildcardChance: 0.15,      // chance one of the 3 offers is a rare wildcard
  champWildcardChance: 0.35, // ...after a championship
};

// Star Tokens (spent in the Shop on recolors). Region index r is 0-4.
// A first win pays 20 + 10 x (region number); replays pay a fifth of that; Champions pay 3x.
const STAR_TOKENS = {
  firstWin: (r) => 20 + 10 * (r + 1),
  replayShare: 0.2,
  championMult: 3,
  // recolor prices by the Star's rank
  price: { D: 120, C: 180, B: 240, A: 360, S: 480 },
};
function storyTokens(r, champion, firstTime) {
  const full = STAR_TOKENS.firstWin(r) * (champion ? STAR_TOKENS.championMult : 1);
  return firstTime ? full : Math.max(1, Math.round(full * STAR_TOKENS.replayShare));
}

const REGIONS = [
  {
    name: "Sunny Shores", color: "#ffcc66",
    blurb: "Warm sand, gentle waves, and beginner teams.",
    // wildcard pool: how likely each rank is (ranks with no weight never show up here)
    wild: { D: 10, C: 1 },
    battles: [
      { name: "Tide Pool Tots", logo: "drop", color: "#3fb3e0", ult: null, team: { 1: "frillet", 2: "embake", 3: "frillet", 4: "moofle", 5: "frillet", 6: "frillet" } },
      { name: "Beach Bums", logo: "sun", color: "#e8a317", ult: null, team: { 1: "moofle", 2: "obsision", 3: "stook", 4: "frillet", 5: "moofle", 6: "zaplet" } },
      { name: "Sandcastle Crew", logo: "castle", color: "#c9973f", ult: null, team: { 1: "malull", 2: "embake", 3: "toxipine", 4: "rexlet", 5: "moofle", 6: "frillet" } },
      { name: "Shoreline Spikers", logo: "wave", color: "#2b8fc9", ult: "comboStar", team: { 1: "moofle", 2: "embake", 3: "obsision", 4: "rexlet", 5: "zaplet", 6: "malull" } },
      { name: "Shore Champions", logo: "crown", color: "#e8622c", champion: true, ult: "comboStar", team: { 1: "aquero", 2: "embake", 3: "stook", 4: "aquero", 5: "frillet", 6: "moofle" } },
    ],
  },
  {
    name: "Thornwood", color: "#7be07b",
    blurb: "Tangled forests full of claws, beetles and thorns.",
    wild: { D: 5, C: 6, B: 1 },
    battles: [
      { name: "Mossy Paws", logo: "paw", color: "#4f9e44", ult: "comboStar", team: { 1: "moofle", 2: "toxipine", 3: "drylion", 4: "felimelon", 5: "frostone", 6: "lochlo" } },
      { name: "Beetle Brigade", logo: "beetle", color: "#7a4fd0", ult: "nuclear", team: { 1: "zaplet", 2: "carabix", 3: "felimelon", 4: "carabix", 5: "drylion", 6: "toxipine" } },
      { name: "Leafy League", logo: "leaf", color: "#33a852", ult: "fortress", team: { 1: "frillet", 2: "obsision", 3: "carabix", 4: "drylion", 5: "drylion", 6: "timbolt" } },
      { name: "Thicket Thumpers", logo: "mushroom", color: "#b0603a", ult: "nuclear", team: { 1: "lochlo", 2: "rexlet", 3: "toxipine", 4: "toxipine", 5: "malull", 6: "felimelon" } },
      { name: "Thornwood Guardians", logo: "shield", color: "#2a7a46", champion: true, ult: "fortress", team: { 1: "bramblet", 2: "carabix", 3: "carabix", 4: "felimelon", 5: "drylion", 6: "bramblet" } },
    ],
  },
  {
    name: "Gloom Marsh", color: "#b14dff",
    blurb: "Foggy bogs where poison and pumpkins lurk.",
    wild: { C: 6, B: 4, A: 1 },
    battles: [
      { name: "Bog Hoppers", logo: "moon", color: "#6b7f2e", ult: "comboStar", team: { 1: "aquero", 2: "rokanock", 3: "toxipine", 4: "snumpkin", 5: "drylion", 6: "zigazolt" } },
      { name: "Pumpkin Patch", logo: "pumpkin", color: "#e87a14", ult: "nuclear", team: { 1: "felimelon", 2: "rokanock", 3: "carabix", 4: "snumpkin", 5: "frostone", 6: "snumpkin" } },
      { name: "Night Crawlers", logo: "eye", color: "#7044c4", ult: "fortress", team: { 1: "timbolt", 2: "obsision", 3: "toxipine", 4: "obsision", 5: "zigazolt", 6: "bramblet" } },
      { name: "Venom Pit", logo: "skull", color: "#5fa82e", ult: "nuclear", team: { 1: "arbur", 2: "toxipine", 3: "rokanock", 4: "toxipine", 5: "desacti", 6: "desacti" } },
      { name: "Marsh Monarchs", logo: "crown", color: "#9235c8", champion: true, ult: "comboStar", team: { 1: "timbolt", 2: "rokanock", 3: "aquivern", 4: "rokanock", 5: "frostone", 6: "bramblet" } },
    ],
  },
  {
    name: "Riptide Reef", color: "#4fc3ff",
    blurb: "Fast currents and slippery, powerful swimmers.",
    wild: { B: 6, A: 3 },
    battles: [
      { name: "Coral Kids", logo: "fish", color: "#e85a7a", ult: "comboStar", team: { 1: "arbur", 2: "rokanock", 3: "aquivern", 4: "aquero", 5: "desacti", 6: "aquero" } },
      { name: "Wave Riders", logo: "wave", color: "#2a6fd8", ult: "nuclear", team: { 1: "arbur", 2: "carabix", 3: "aquivern", 4: "rokanock", 5: "zigazolt", 6: "aquivern" } },
      { name: "Deep Current", logo: "spiral", color: "#1f4a9a", ult: "fortress", team: { 1: "thundroak", 2: "rokanock", 3: "aquivern", 4: "rokanock", 5: "desacti", 6: "aquivern" } },
      { name: "Undertow", logo: "drop", color: "#1f8f96", ult: "nuclear", team: { 1: "desacti", 2: "rokanock", 3: "bramblet", 4: "carabix", 5: "cryolith", 6: "bramblet" } },
      { name: "Reef Royalty", logo: "star", color: "#2aa8e0", champion: true, ult: "fortress", team: { 1: "thundroak", 2: "volcobra", 3: "aquivern", 4: "rokanock", 5: "desacti", 6: "aquivern" } },
    ],
  },
  {
    name: "Magma Summit", color: "#ff6a3a",
    blurb: "The final climb. Lava, walls of thorns, legends.",
    wild: { A: 6, S: 1 },
    battles: [
      { name: "Ember Scouts", logo: "flame", color: "#e86a14", ult: "nuclear", team: { 1: "desacti", 2: "rokanock", 3: "embake", 4: "rokanock", 5: "zigazolt", 6: "bramblet" } },
      { name: "Lava Flow", logo: "mountain", color: "#c8361a", ult: "comboStar", team: { 1: "thundroak", 2: "rokanock", 3: "volcobra", 4: "rokanock", 5: "aquivern", 6: "bramblet" } },
      { name: "Obsidian Wall", logo: "shield", color: "#4a3a66", ult: "fortress", team: { 1: "arbur", 2: "rokanock", 3: "bramblehorn", 4: "carabix", 5: "cryolith", 6: "desacti" } },
      { name: "Magma Titans", logo: "fox", color: "#a82418", ult: "nuclear", team: { 1: "desacti", 2: "rokanock", 3: "bramblehorn", 4: "volcobra", 5: "cryolith", 6: "aquivern" } },
      { name: "Summit Kings", logo: "trophy", color: "#d9a21a", champion: true, ult: "nuclear", team: { 1: "thundroak", 2: "volcobra", 3: "bramblehorn", 4: "volcobra", 5: "cryolith", 6: "aquivern" } },
    ],
  },
];

// CPU skill for a battle: rises smoothly over all 25 battles, a little extra for champions
function storySkill(region, battle) {
  const k = region * 5 + battle; // 0..24
  const champ = battle === 4 ? 0.06 : 0;
  const smart = Math.min(0.95, 0.05 + 0.82 * (k / 24) + champ);
  return { smart, timing: Math.min(0.9, smart * 0.92) };
}
