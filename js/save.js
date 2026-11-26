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
  };
})();
