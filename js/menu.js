// =====================================================================
//  VolleyStars main menu, the Path, and Settings.
// =====================================================================

const SCREENS = ["menu", "story", "settings", "builder", "match"];
function showScreen(id) {
  SCREENS.forEach((s) => $(s).classList.toggle("hidden", s !== id));
  tip.classList.add("hidden");
  if (id === "story") renderStory();
  if (id === "settings") renderSettings();
  Parade.active(id === "menu");
}
document.querySelectorAll(".back-btn[data-go]").forEach((b) =>
  b.addEventListener("click", () => { Sound.play("click"); showScreen(b.dataset.go); }));

// ---------- settings (saved in the browser) ----------
const Settings = (() => {
  let s = { sfx: 80, music: 60, points: 15 };
  try { s = { ...s, ...JSON.parse(localStorage.getItem("volleystars-settings") || "{}") }; } catch (e) {}
  function apply() {
    CONFIG.pointsToWin = +s.points;
    Sound.setVolumes(s.sfx / 100, s.music / 100);
  }
  function save() { try { localStorage.setItem("volleystars-settings", JSON.stringify(s)); } catch (e) {} apply(); }
  apply();
  return { get: () => s, set: (k, v) => { s[k] = v; save(); } };
})();

function renderSettings() {
  const s = Settings.get();
  $("setSfx").value = s.sfx; $("setSfxVal").textContent = s.sfx + "%";
  $("setMusic").value = s.music; $("setMusicVal").textContent = s.music + "%";
  $("setPoints").value = String(s.points);
  $("resetMsg").textContent = "";
  $("resetPath").textContent = "Reset story progress";
  resetArmed = false;
}
$("setSfx").addEventListener("input", (e) => { Settings.set("sfx", +e.target.value); $("setSfxVal").textContent = e.target.value + "%"; });
$("setSfx").addEventListener("change", () => Sound.play("perfect"));
$("setMusic").addEventListener("input", (e) => { Settings.set("music", +e.target.value); $("setMusicVal").textContent = e.target.value + "%"; });
$("setPoints").addEventListener("change", (e) => { Settings.set("points", +e.target.value); Sound.play("click"); });
let resetArmed = false;
$("resetPath").addEventListener("click", () => {
  if (!resetArmed) { resetArmed = true; $("resetPath").textContent = "Click again to confirm"; return; }
  Story.reset();
  resetArmed = false;
  $("resetPath").textContent = "Reset story progress";
  $("resetMsg").textContent = "Story reset.";
});

// ---------- menu buttons ----------
$("menuFree").addEventListener("click", () => { Sound.play("click"); enterBuilder("free"); });
$("menuStory").addEventListener("click", () => { Sound.play("click"); showScreen("story"); });
$("menuSettings").addEventListener("click", () => { Sound.play("click"); showScreen("settings"); });
$("builderBack").addEventListener("click", () => { Sound.play("click"); showScreen(builder.mode === "story" ? "story" : "menu"); });

// ---------- the parade: creatures run across the bottom of the menu ----------
const Parade = (() => {
  let on = false, timer = null;
  function runner(c, delay, y, dir, withBall) {
    const box = $("parade");
    const el = document.createElement("div");
    el.className = "runner";
    const size = 70 + Math.random() * 30;
    el.style.width = size + "px";
    el.style.bottom = y + "px";
    const facesRight = (c.faces || "left") === "right";
    const flip = (dir > 0) !== facesRight; // look the way it's running
    el.innerHTML = `<div class="runner-hop" style="animation-duration:${(0.32 + Math.random() * 0.1).toFixed(2)}s">
      <img src="${spriteSrc(c.looks[Math.floor(Math.random() * c.looks.length)])}" alt="" style="${flip ? "transform:scaleX(-1)" : ""}"></div>
      ${withBall ? '<img class="runner-ball" src="assets/volleyball.png" alt="">' : ""}`;
    const dur = 5 + Math.random() * 3;
    el.style.animation = `${dir > 0 ? "runRight" : "runLeft"} ${dur}s linear ${delay}s forwards`;
    el.addEventListener("click", () => {
      el.querySelector(".runner-hop").classList.add("big-hop");
      Sound.play("set");
      setTimeout(() => el.querySelector(".runner-hop").classList.remove("big-hop"), 600);
    });
    box.appendChild(el);
    setTimeout(() => el.remove(), (dur + delay) * 1000 + 200);
  }
  function wave() {
    if (!on) return;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const n = 1 + Math.floor(Math.random() * 3);
    const ballAt = Math.random() < 0.6 ? Math.floor(Math.random() * n) : -1;
    for (let i = 0; i < n; i++) {
      const c = CREATURES[Math.floor(Math.random() * CREATURES.length)];
      runner(c, i * (0.5 + Math.random() * 0.4), 6 + Math.random() * 18, dir, i === ballAt);
    }
    timer = setTimeout(wave, 3500 + Math.random() * 4000);
  }
  return {
    active(v) {
      if (v === on) return;
      on = v;
      clearTimeout(timer);
      if (on) timer = setTimeout(wave, 600);
      else $("parade").innerHTML = "";
    },
  };
})();

// start on the main menu
showScreen("menu");
