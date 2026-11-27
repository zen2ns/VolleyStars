// =====================================================================
//  VolleyStars sound: retro chiptune sound effects + a looping music
//  track, all made live with the Web Audio API (no sound files needed).
//  Sound.play("spike"), Sound.setSfx(true/false), Sound.setMusic(true/false)
// =====================================================================

const Sound = (() => {
  let ctx = null, sfxGain = null, musicGain = null;
  let sfxOn = true, musicOn = true;
  let sfxVol = 0.8, musicVol = 0.6; // 0-1, from Settings
  const SFX_MAX = 0.6, MUSIC_MAX = 0.22;
  try {
    sfxOn = localStorage.getItem("vs-sfx") !== "off";
    musicOn = localStorage.getItem("vs-music") !== "off";
  } catch (e) { /* storage not available */ }

  // Browsers only allow audio after the player clicks or presses a key
  function init() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      sfxGain = ctx.createGain(); sfxGain.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.connect(ctx.destination);
      applyGains();
      startMusic();
    } catch (e) { ctx = null; }
  }
  ["pointerdown", "keydown"].forEach((ev) => document.addEventListener(ev, init, { once: false, passive: true }));

  // ---------- building blocks ----------
  function tone(freq, dur, { type = "square", vol = 0.2, slideTo = null, delay = 0, out = null } = {}) {
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out || sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  let noiseBuf = null;
  function noise(dur, { vol = 0.3, type = "bandpass", freq = 1200, slideTo = null, q = 1, delay = 0, out = null } = {}) {
    if (!ctx) return;
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = ctx.currentTime + delay;
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(out || sfxGain);
    s.start(t); s.stop(t + dur + 0.02);
  }
  const arp = (notes, step, opts) => notes.forEach((n, i) => tone(n, step * 1.6, { ...opts, delay: (opts.delay || 0) + i * step }));

  // ---------- sound effects ----------
  const SFX = {
    click: () => tone(900, 0.04, { vol: 0.12 }),
    tick: () => { tone(1800, 0.03, { type: "triangle", vol: 0.18 }); tone(1200, 0.05, { type: "sine", vol: 0.12, delay: 0.02 }); },
    serve: () => { noise(0.08, { freq: 2500, type: "highpass", vol: 0.25 }); tone(300, 0.1, { slideTo: 520, vol: 0.15 }); },
    bump: () => { tone(330, 0.07, { vol: 0.18 }); tone(220, 0.08, { type: "triangle", vol: 0.25 }); },
    set: () => tone(523, 0.1, { slideTo: 700, vol: 0.16 }),
    dig: () => { tone(260, 0.08, { type: "triangle", vol: 0.3 }); noise(0.05, { freq: 1500, type: "lowpass", vol: 0.2 }); },
    spike: () => { noise(0.16, { freq: 1400, slideTo: 300, vol: 0.45 }); tone(170, 0.18, { type: "sine", slideTo: 55, vol: 0.6 }); },
    whoosh: () => noise(0.25, { freq: 500, slideTo: 2600, vol: 0.25, q: 2 }),
    block: () => { tone(120, 0.14, { vol: 0.35 }); noise(0.1, { freq: 3200, type: "highpass", vol: 0.3 }); tone(880, 0.06, { vol: 0.12, delay: 0.02 }); },
    shank: () => tone(320, 0.22, { slideTo: 140, vol: 0.18 }),
    out: () => { tone(400, 0.12, { type: "triangle", slideTo: 200, vol: 0.2 }); },
    spark: () => tone(1320, 0.05, { vol: 0.08 }),
    boom: () => { noise(0.55, { type: "lowpass", freq: 1400, slideTo: 90, vol: 0.6 }); tone(95, 0.45, { type: "sine", slideTo: 35, vol: 0.7 }); },
    bigboom: () => {
      noise(0.9, { type: "lowpass", freq: 2000, slideTo: 60, vol: 0.75 }); tone(80, 0.8, { type: "sine", slideTo: 28, vol: 0.85 });
      noise(0.4, { freq: 4000, type: "highpass", vol: 0.2, delay: 0.05 });
    },
    nuke: () => {
      tone(180, 0.5, { type: "sawtooth", slideTo: 1400, vol: 0.18 });
      noise(1.4, { type: "lowpass", freq: 2400, slideTo: 40, vol: 0.9, delay: 0.45 });
      tone(70, 1.2, { type: "sine", slideTo: 22, vol: 0.95, delay: 0.45 });
    },
    ability: () => arp([523, 659, 784, 1047], 0.05, { vol: 0.13 }),
    ult: () => { arp([262, 330, 392, 523, 659, 784, 1047, 1319], 0.045, { vol: 0.16 }); noise(0.6, { freq: 400, slideTo: 3000, vol: 0.2, delay: 0.1 }); },
    perfect: () => { tone(1047, 0.08, { vol: 0.15 }); tone(1568, 0.14, { vol: 0.13, delay: 0.06 }); },
    good: () => tone(784, 0.08, { vol: 0.13 }),
    miss: () => tone(220, 0.16, { type: "sawtooth", slideTo: 120, vol: 0.15 }),
    swing: () => tone(660, 0.05, { type: "triangle", vol: 0.12 }),
    whistle: () => { tone(2300, 0.28, { type: "sine", vol: 0.18 }); tone(2380, 0.28, { type: "sine", vol: 0.1 }); },
    cheer: () => { noise(0.9, { freq: 900, q: 0.5, vol: 0.22 }); noise(0.7, { freq: 2200, q: 0.7, vol: 0.12, delay: 0.1 }); },
    lose: () => arp([392, 330, 262], 0.1, { type: "triangle", vol: 0.18 }),
    poison: () => [0, 1, 2, 3, 4].forEach((i) => tone(400 + Math.random() * 500, 0.06, { type: "sine", vol: 0.12, delay: i * 0.05 })),
    water: () => noise(0.35, { freq: 3200, slideTo: 500, vol: 0.3, q: 1.5 }),
    fire: () => noise(0.35, { freq: 2500, type: "highpass", vol: 0.25 }),
    spook: () => { tone(300, 0.4, { type: "triangle", slideTo: 180, vol: 0.15 }); tone(310, 0.4, { type: "triangle", slideTo: 190, vol: 0.1 }); },
    shield: () => { tone(440, 0.2, { type: "triangle", vol: 0.15 }); tone(660, 0.25, { type: "triangle", vol: 0.12, delay: 0.05 }); },
    win: () => arp([523, 659, 784, 1047, 784, 1047], 0.11, { vol: 0.18 }),
    alert: () => { tone(880, 0.09, { vol: 0.14 }); tone(1175, 0.12, { vol: 0.14, delay: 0.1 }); },
  };
  function play(name) {
    if (!ctx || !sfxOn || !SFX[name]) return;
    try { SFX[name](); } catch (e) { /* ignore */ }
  }

  // ---------- music: a cheerful chiptune loop ----------
  const BPM = 128, STEP = 60 / BPM / 2; // eighth notes
  const N = (n) => 440 * Math.pow(2, (n - 69) / 12); // MIDI note -> Hz
  const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am F C G
  const LEAD = [
    [76, 0, 74, 72, 74, 0, 72, 69], [72, 0, 69, 0, 67, 69, 72, 0],
    [76, 0, 79, 76, 74, 72, 74, 0], [74, 0, 71, 72, 74, 0, 79, 0],
    [81, 0, 79, 76, 79, 0, 76, 74], [72, 74, 76, 0, 72, 0, 69, 0],
    [76, 0, 74, 76, 79, 81, 79, 0], [79, 0, 74, 0, 71, 72, 74, 0],
  ];
  let step = 0, nextTime = 0, timer = null;
  function schedule() {
    if (!ctx) return;
    if (nextTime < ctx.currentTime - 0.3) nextTime = ctx.currentTime + 0.05; // tab was in the background: don't burst
    while (nextTime < ctx.currentTime + 0.12) {
      const bar = Math.floor(step / 8) % 8, beat = step % 8;
      const chord = CHORDS[bar % 4];
      const d = nextTime - ctx.currentTime;
      // bass: root, octave bounce
      tone(N(chord[0] - 24 + (beat % 2 ? 12 : 0)), STEP * 0.9, { type: "triangle", vol: 0.5, delay: d, out: musicGain });
      // lead melody
      const ln = LEAD[bar][beat];
      if (ln) tone(N(ln), STEP * 0.85, { type: "square", vol: 0.16, delay: d, out: musicGain });
      // soft chord stab on the off-beats
      if (beat % 4 === 2) chord.forEach((n) => tone(N(n), STEP * 0.5, { type: "square", vol: 0.05, delay: d, out: musicGain }));
      // drums
      if (beat % 4 === 0) tone(150, 0.12, { type: "sine", slideTo: 45, vol: 0.6, delay: d, out: musicGain });
      if (beat % 4 === 2) noise(0.1, { freq: 1800, vol: 0.25, delay: d, out: musicGain });
      noise(0.03, { freq: 8000, type: "highpass", vol: 0.12, delay: d, out: musicGain });
      nextTime += STEP;
      step++;
    }
  }
  function startMusic() {
    if (!ctx || timer) return;
    nextTime = ctx.currentTime + 0.1;
    timer = setInterval(schedule, 30);
  }

  function applyGains() {
    if (sfxGain) sfxGain.gain.value = sfxOn ? SFX_MAX * sfxVol : 0;
    if (musicGain) musicGain.gain.value = musicOn ? MUSIC_MAX * musicVol : 0;
  }
  function setVolumes(sfx, music) { sfxVol = sfx; musicVol = music; applyGains(); }
  function setSfx(on) {
    sfxOn = on;
    try { localStorage.setItem("vs-sfx", on ? "on" : "off"); } catch (e) {}
    applyGains();
  }
  function setMusic(on) {
    musicOn = on;
    try { localStorage.setItem("vs-music", on ? "on" : "off"); } catch (e) {}
    applyGains();
  }
  return { play, setSfx, setMusic, setVolumes, get sfxOn() { return sfxOn; }, get musicOn() { return musicOn; } };
})();
