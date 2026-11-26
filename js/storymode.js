// =====================================================================
//  VolleyStars story mode screens: regions, region path, Recruit Draft,
//  championship rewards.
// =====================================================================

let storyRegion = 0; // which region the story screen is showing

function renderStory() {
  // pick the furthest open region the first time
  if (!Story.regionOpen(storyRegion)) storyRegion = 0;

  // ----- region tabs -----
  const tabs = $("regionTabs");
  tabs.innerHTML = "";
  REGIONS.forEach((reg, r) => {
    const open = Story.regionOpen(r), done = Story.progress(r) >= 5;
    const b = document.createElement("button");
    b.className = "region-tab" + (r === storyRegion ? " on" : "") + (open ? "" : " locked") + (done ? " done" : "");
    b.style.setProperty("--rc", reg.color);
    b.disabled = !open;
    const champ = reg.battles[4].team;
    const icons = open ? [...new Set(Object.values(champ))].slice(0, 3).map((id) => `<img src="${spriteSrc(byId(id).looks[0])}" alt="">`).join("") : "";
    b.innerHTML = `<div class="rt-num">${done ? "🏆" : open ? `Region ${r + 1}` : "🔒"}</div>
      <div class="rt-name">${open ? reg.name : "Locked"}</div>
      <div class="rt-icons">${icons}</div>
      <div class="rt-prog">${open ? `${Math.min(5, Story.progress(r))} / 5` : `Beat ${REGIONS[r - 1].name}`}</div>`;
    b.addEventListener("click", () => { storyRegion = r; Sound.play("click"); renderStory(); });
    tabs.appendChild(b);
  });

  // ----- the region's path -----
  const reg = REGIONS[storyRegion];
  $("regionName").textContent = reg.name;
  $("regionName").style.color = reg.color;
  $("regionBlurb").textContent = reg.blurb;
  const map = $("storyMap");
  map.innerHTML = "";
  const pts = reg.battles.map((_, i) => ({ x: 9 + i * 20.5, y: i % 2 ? 64 : 36 }));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.classList.add("path-trail");
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    d += ` C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`;
  }
  svg.innerHTML = `<path d="${d}" class="trail-bg"/><path d="${d}" class="trail-fg"/>`;
  map.appendChild(svg);
  map.style.setProperty("--rc", reg.color);

  reg.battles.forEach((bt, i) => {
    const beaten = i < Story.progress(storyRegion);
    const state = beaten ? "done" : Story.battleOpen(storyRegion, i) ? "open" : "locked";
    const node = document.createElement("button");
    node.className = `path-node ${state}` + (bt.champion ? " champ" : "");
    node.style.left = pts[i].x + "%";
    node.style.top = pts[i].y + "%";
    const sprites = [...new Set(Object.values(bt.team))].slice(0, 4)
      .map((id) => `<img src="${spriteSrc(byId(id).looks[0])}" alt="">`).join("");
    node.innerHTML = `
      <div class="pn-num">${bt.champion ? "🏆" : beaten ? "✓" : state === "locked" ? "🔒" : i + 1}</div>
      <div class="pn-card">
        <div class="pn-title">${bt.champion ? "Regional Championship" : `Battle ${i + 1}`}${beaten ? " · Won" : ""}</div>
        <div class="pn-name">${bt.name}</div>
        <div class="pn-team">${state === "locked" ? '<span class="muted small">Locked</span>' : sprites}</div>
      </div>`;
    node.disabled = state === "locked";
    node.addEventListener("click", () => { Sound.play("click"); enterBuilder("story", { region: storyRegion, battle: i }); });
    map.appendChild(node);
  });

  // ----- your collection -----
  const col = $("collection");
  col.innerHTML = "";
  const order = "SABCD";
  const owned = CREATURES.filter((c) => Story.owned(c.id) > 0).sort((a, b) => order.indexOf(a.rank) - order.indexOf(b.rank));
  owned.forEach((c) => {
    const el = document.createElement("div");
    el.className = "col-item";
    el.innerHTML = `<img src="${spriteSrc(c.looks[0])}" alt=""${sizeStyle(c)}><div>${rankHTML(c)} ${c.name}</div><b>×${Story.owned(c.id)}</b>`;
    attachTooltip(el, () => c);
    col.appendChild(el);
  });
  const ults = Story.ults();
  $("storyUlts").innerHTML = ults.length
    ? "Ultimates: " + ults.map((u) => `<b>${CONFIG.ultimates[u].name}</b>`).join(", ")
    : "Ultimates: <span class='muted'>none yet (win a Regional Championship)</span>";
}

// ---------- after a story match ----------
function showStoryEnd(won) {
  const r = M.region, b = M.battle;
  const reg = REGIONS[r], bt = reg.battles[b];
  if (!won) {
    $("endTitle").textContent = "Defeated…";
    $("endScore").textContent = `${bt.name}: ${M.score.player} – ${M.score.cpu}. Tweak your team and try again!`;
    $("playAgain").textContent = "Try again";
    $("endSecond").textContent = "Back to the map";
    endAction = { first: () => backToBuilder(), second: () => { backToBuilder(); showScreen("story"); } };
    $("endOverlay").classList.remove("hidden");
    return;
  }
  const wasNew = Story.progress(r) <= b;
  Story.beat(r, b);
  $("endTitle").textContent = bt.champion ? `${reg.name} Champion! 🏆` : "Victory!";
  $("endScore").textContent = `${bt.name}: ${M.score.player} – ${M.score.cpu}. Time to recruit!`;
  $("playAgain").textContent = "Recruit!";
  $("endSecond").textContent = "Skip recruiting";
  const after = () => championRewards(r, b, wasNew);
  endAction = {
    first: () => { $("endOverlay").classList.add("hidden"); showDraft(bt, reg, after); },
    second: () => { $("endOverlay").classList.add("hidden"); after(); },
  };
  $("endOverlay").classList.remove("hidden");
}

// ---------- the Recruit Draft: pick 1 of 3 ----------
function draftOffers(bt, reg) {
  const offers = [];
  // weighted by how many of each creature were on the team you beat
  const pool = Object.values(bt.team);
  const distinct = [...new Set(pool)];
  const pickFromTeam = () => {
    const left = pool.filter((id) => !offers.some((o) => o.id === id));
    const src = left.length ? left : pool;
    return src[Math.floor(Math.random() * src.length)];
  };
  // championship: the champion's best creature is guaranteed
  if (bt.champion) {
    const order = "SABCD";
    const best = [...distinct].sort((a, b) => order.indexOf(byId(a).rank) - order.indexOf(byId(b).rank))[0];
    offers.push({ id: best });
  }
  while (offers.length < 3) offers.push({ id: pickFromTeam() });
  // a rare wildcard from the region's pool replaces one offer
  const chance = bt.champion ? STORY_DRAFT.champWildcardChance : STORY_DRAFT.wildcardChance;
  if (Math.random() < chance) {
    const cands = CREATURES.filter((c) => reg.wild[c.rank] && !offers.some((o) => o.id === c.id));
    if (cands.length) {
      const w = cands.map((c) => reg.wild[c.rank]);
      let roll = Math.random() * w.reduce((a, b) => a + b, 0), k = 0;
      while (roll > w[k]) { roll -= w[k]; k++; }
      offers[bt.champion ? 2 : Math.floor(Math.random() * 3)] = { id: cands[k].id, wild: true };
    }
  }
  return offers.sort(() => Math.random() - 0.5);
}

function showDraft(bt, reg, then) {
  const offers = draftOffers(bt, reg);
  const box = $("draftCards");
  box.innerHTML = "";
  $("draftTitle").textContent = bt.champion ? "Champion's Recruit Draft" : "Recruit Draft";
  $("draftSub").textContent = bt.champion
    ? "The champions are impressed. Pick one to join your team!"
    : `Some of ${bt.name} want to join you. Pick one!`;
  offers.forEach((o, i) => {
    const c = byId(o.id);
    const card = document.createElement("button");
    card.className = "draft-card" + (o.wild ? " wild" : "");
    card.style.animationDelay = i * 0.12 + "s";
    card.innerHTML = `
      ${o.wild ? '<div class="wild-tag">✨ Wildcard</div>' : ""}
      <img src="${spriteSrc(c.looks[0])}" alt=""${sizeStyle(c)}>
      <div class="dc-name">${rankHTML(c)} ${c.name}</div>
      ${badgesHTML(c)}
      ${STATS.map(([k, short, color]) => `
        <div class="stat-row"><span>${short}</span>
          <div class="stat-bar"><div style="width:${c[k]}%;background:${color}"></div></div>
          <span>${c[k]}</span></div>`).join("")}
      <div class="abil"><b>${c.passive.name}</b> (passive)<br><b>${c.active.name}</b> (active)</div>
      <div class="dc-own">You have ${Story.owned(c.id)} → <b>${Story.owned(c.id) + 1}</b></div>`;
    attachTooltip(card, () => c);
    card.addEventListener("click", () => {
      Story.add(c.id);
      Sound.play(o.wild ? "ult" : "ability");
      tip.classList.add("hidden");
      $("draft").classList.add("hidden");
      toast(`${c.name} joined your team! (×${Story.owned(c.id)})`);
      then();
    });
    box.appendChild(card);
  });
  $("draft").classList.remove("hidden");
}

// ---------- championship: unlock an ultimate, open the next region ----------
function championRewards(r, b, firstTime) {
  const bt = REGIONS[r].battles[b];
  const finish = () => {
    backToBuilder();
    if (bt.champion && firstTime && r + 1 < REGIONS.length) {
      storyRegion = r + 1;
      toast(`New region unlocked: ${REGIONS[r + 1].name}!`);
    } else if (bt.champion && firstTime) {
      toast("You conquered every region! 🏆");
    }
    showScreen("story");
  };
  const locked = Object.keys(CONFIG.ultimates).filter((u) => !Story.ults().includes(u));
  if (!(bt.champion && firstTime && locked.length)) { finish(); return; }
  const box = $("ultUnlockCards");
  box.innerHTML = "";
  locked.forEach((id) => {
    const u = CONFIG.ultimates[id];
    const card = document.createElement("button");
    card.className = "ult-card big";
    card.innerHTML = `<b>${u.name}</b><span>${u.text}</span>`;
    card.addEventListener("click", () => {
      Story.unlockUlt(id);
      Sound.play("ult");
      $("ultUnlock").classList.add("hidden");
      toast(`Ultimate unlocked: ${u.name}!`);
      finish();
    });
    box.appendChild(card);
  });
  $("ultUnlock").classList.remove("hidden");
}

// little message that pops up at the bottom of the screen
function toast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}
