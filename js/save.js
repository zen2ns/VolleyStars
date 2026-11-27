// =====================================================================
//  VolleyStars story save: autosaved in this browser after every change.
//  collection = how many copies of each creature you own (you can field that many).
// =====================================================================

const Story = (() => {
  const KEY = "volleystars-story";
  const fresh = () => ({
    v: 1,
    collection: { ...STARTER_COLLECTION },
    progress: REGIONS.map(() => 0),       // battles beaten in each region (0-5)
    ults: [],                             // unlocked ultimates
    team: {
      slots: { 1: "moofle", 2: "toxipine", 3: "snumpkin", 4: "frillet", 5: "frillet", 6: "moofle" },
      looks: {},
      ult: null,
    },
    recruits: 0,
    tokens: 0,                            // Star Tokens, earned by winning story fights
    skinsOwned: [],                       // bought recolors, as "creatureId:recolorId"
    skins: {},                            // equipped recolor per creature id (missing = default look)
    teamName: "My Team",
    teamLogo: "star",
    teamColor: "#2f6fdd",
    codes: [],                            // gift codes already redeemed
  });
  let s = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved && saved.v === 1) s = { ...fresh(), ...saved };
  } catch (e) { /* no save yet */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {} };
  save();

  return {
    owned: (id) => s.collection[id] || 0,
    collection: () => ({ ...s.collection }),
    add(id) { s.collection[id] = (s.collection[id] || 0) + 1; s.recruits++; save(); },
    progress: (r) => s.progress[r] || 0,
    regionOpen: (r) => r === 0 || (s.progress[r - 1] || 0) >= 5,
    battleOpen: (r, b) => Story.regionOpen(r) && b <= (s.progress[r] || 0),
    beat(r, b) { if (b + 1 > (s.progress[r] || 0)) { s.progress[r] = b + 1; save(); } },
    ults: () => [...s.ults],
    unlockUlt(id) { if (!s.ults.includes(id)) { s.ults.push(id); if (!s.team.ult) s.team.ult = id; save(); } },
    team: () => JSON.parse(JSON.stringify(s.team)),
    saveTeam(slots, looks, ult) { s.team = { slots: { ...slots }, looks: { ...looks }, ult }; save(); },
    reset() { s = fresh(); save(); },
    // ----- Star Tokens & the Shop -----
    tokens: () => s.tokens || 0,
    addTokens(n) { s.tokens = (s.tokens || 0) + n; save(); },
    ownsSkin: (cid, rid) => (s.skinsOwned || []).includes(cid + ":" + rid),
    buySkin(cid, rid, price) {
      if ((s.tokens || 0) < price || Story.ownsSkin(cid, rid)) return false;
      s.tokens -= price; s.skinsOwned.push(cid + ":" + rid); s.skins[cid] = rid; save(); return true;
    },
    redeemed: (code) => (s.codes || []).includes(code),
    redeem(code, tokens) { s.codes = [...(s.codes || []), code]; s.tokens = (s.tokens || 0) + tokens; save(); },
    // ----- Locker Room -----
    skin: (cid) => (s.skins || {})[cid] || null,
    equipSkin(cid, rid) { if (rid) s.skins[cid] = rid; else delete s.skins[cid]; save(); },
    teamInfo: () => ({ name: s.teamName, logo: s.teamLogo, color: s.teamColor }),
    setTeamInfo(k, v) { s["team" + k[0].toUpperCase() + k.slice(1)] = v; save(); },
  };
})();

// ---------- shared helpers for skins and team logos (used by the game, story and Customize screens) ----------
const logoSrc = (id) => `assets/logos/${id}.png`;
// A team logo: the white pixel icon on a rounded square of the team color
function logoCard(logo, color, cls = "") {
  return `<div class="logo-card ${cls}" style="--lc:${color}"><img src="${logoSrc(logo)}" alt=""></div>`;
}
// The picture to show for a Star: its equipped recolor if you own one, else the default look
function skinImg(c) {
  const rid = Story.skin(c.id);
  const r = rid && (c.recolors || []).find((x) => x.id === rid);
  return r && Story.ownsSkin(c.id, rid) ? r.img : c.looks[0];
}
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
