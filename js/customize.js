// =====================================================================
//  VolleyStars Customize: the Shop (spend Star Tokens on recolors) and
//  the Locker Room (pick skins, and your Story team's name, logo and color).
// =====================================================================

const TEAM_LOGOS = ["star", "flame", "wave", "bolt", "leaf", "crown", "skull", "sun", "moon", "heart", "shield", "snowflake",
  "mushroom", "paw", "fox", "fish", "castle", "pumpkin", "beetle", "mountain", "drop", "spiral", "eye", "trophy", "ball"];
const TEAM_COLORS = ["#2f6fdd", "#22a6e0", "#17a99a", "#3aa845", "#8cbf26", "#e0a800", "#f07a1a", "#d93a3a",
  "#e04f9a", "#8a4fd8", "#8a5a3a", "#4a5a78"];

const tokenBadge = () => `<span class="token-badge"><span class="token-icon">★</span> ${Story.tokens()}</span>`;
function refreshTokenBadges() { document.querySelectorAll(".tokens-here").forEach((el) => { el.innerHTML = tokenBadge(); }); }

// ---------- Customize hub ----------
function renderCustomize() {
  refreshTokenBadges();
  const t = Story.teamInfo();
  $("custTeamPreview").innerHTML = logoCard(t.logo, t.color, "big") + `<b>${escapeHtml(t.name)}</b>`;
}

// ---------- Shop ----------
function renderShop() {
  refreshTokenBadges();
  const grid = $("shopGrid");
  grid.innerHTML = "";
  const owned = Story.collection();
  const withSkins = CREATURES.filter((c) => (c.recolors || []).length);
  const available = withSkins.filter((c) => owned[c.id] > 0);
  const lockedCount = withSkins.length - available.length;
  available.forEach((c) => c.recolors.forEach((r) => {
    const have = Story.ownsSkin(c.id, r.id);
    const price = STAR_TOKENS.price[c.rank];
    const afford = Story.tokens() >= price;
    const card = document.createElement("div");
    card.className = "shop-card" + (have ? " owned" : "");
    card.innerHTML = `
      <div class="shop-pics">
        <img src="${spriteSrc(c.looks[0])}" alt="" class="shop-old">
        <span class="shop-arrow">▸</span>
        <img src="${spriteSrc(r.img)}" alt="">
      </div>
      <div class="shop-name">${c.name} <span class="rank-chip" style="--rk:${RANKS[c.rank].color}">${c.rank}</span></div>
      <div class="shop-skin">${r.name}</div>
      <button class="btn small ${have ? "secondary" : ""}" ${have || !afford ? "disabled" : ""}>
        ${have ? "Owned ✓" : `<span class="token-icon">★</span> ${price}`}</button>`;
    if (!have && afford) {
      card.querySelector("button").addEventListener("click", () => {
        if (Story.buySkin(c.id, r.id, price)) {
          Sound.play("ult");
          toast(`Bought ${c.name}'s ${r.name} recolor! It's now equipped.`);
          renderShop();
        }
      });
    }
    grid.appendChild(card);
  }));
  $("shopNote").textContent = !available.length
    ? "Recruit Stars in Story mode to unlock their recolors here."
    : lockedCount > 0 ? `${lockedCount} more Star${lockedCount === 1 ? "" : "s"} with recolors to discover in Story mode.` : "Every recolor is unlocked!";
}

// ---------- Locker Room ----------
function renderLocker() {
  const t = Story.teamInfo();
  $("teamNameInput").value = t.name;
  $("lockerPreview").innerHTML = logoCard(t.logo, t.color, "big") + `<b>${escapeHtml(t.name)}</b>`;
  // colors
  const cols = $("colorSwatches");
  cols.innerHTML = "";
  TEAM_COLORS.forEach((col) => {
    const b = document.createElement("button");
    b.className = "swatch" + (col === t.color ? " on" : "");
    b.style.background = col;
    b.title = col;
    b.addEventListener("click", () => { Story.setTeamInfo("color", col); Sound.play("click"); renderLocker(); });
    cols.appendChild(b);
  });
  // logos
  const logos = $("logoGrid");
  logos.innerHTML = "";
  TEAM_LOGOS.forEach((lg) => {
    const b = document.createElement("button");
    b.className = "logo-pick" + (lg === t.logo ? " on" : "");
    b.innerHTML = logoCard(lg, t.color);
    b.title = lg;
    b.addEventListener("click", () => { Story.setTeamInfo("logo", lg); Sound.play("click"); renderLocker(); });
    logos.appendChild(b);
  });
  // skins: every Star you've collected that has recolors
  const box = $("skinList");
  box.innerHTML = "";
  const owned = Story.collection();
  const list = CREATURES.filter((c) => (c.recolors || []).length && owned[c.id] > 0);
  if (!list.length) box.innerHTML = '<p class="muted">Recruit Stars in Story mode, then buy their recolors in the Shop.</p>';
  list.forEach((c) => {
    const row = document.createElement("div");
    row.className = "skin-row";
    row.innerHTML = `<div class="skin-name">${c.name}</div><div class="skin-opts"></div>`;
    const opts = row.querySelector(".skin-opts");
    const cur = Story.skin(c.id);
    [{ id: null, name: "Default", img: c.looks[0] }, ...c.recolors].forEach((r) => {
      const have = !r.id || Story.ownsSkin(c.id, r.id);
      const on = have && (r.id ? cur === r.id && Story.ownsSkin(c.id, r.id) : !cur || !Story.ownsSkin(c.id, cur));
      const b = document.createElement("button");
      b.className = "skin-opt" + (on ? " on" : "") + (have ? "" : " locked");
      b.disabled = !have;
      b.title = have ? r.name : `${r.name} (buy it in the Shop)`;
      b.innerHTML = `<img src="${spriteSrc(r.img)}" alt=""><span>${have ? r.name : "🔒 " + r.name}</span>`;
      if (have) b.addEventListener("click", () => { Story.equipSkin(c.id, r.id); Sound.play("click"); renderLocker(); });
      opts.appendChild(b);
    });
    box.appendChild(row);
  });
}
$("teamNameInput").addEventListener("input", (e) => {
  const v = e.target.value.replace(/\s+/g, " ").slice(0, 18);
  Story.setTeamInfo("name", v.trim() || "My Team");
  $("lockerPreview").querySelector("b").textContent = v.trim() || "My Team";
});
