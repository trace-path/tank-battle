/* ============================================================
   TANK BATTLE
   A tiny Battle City–style arcade game in vanilla JS + Canvas.
   ============================================================ */
(() => {
  'use strict';

  /* ---------------- DOM ---------------- */

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    score: document.getElementById('score'),
    hiScore: document.getElementById('hiScore'),
    stage: document.getElementById('stage'),
    lives: document.getElementById('lives'),
    enemies: document.getElementById('enemies'),
    menuHi: document.getElementById('menuHi'),
    soundBtn: document.getElementById('soundBtn'),
    pauseBtn: document.getElementById('pauseBtn'),
    overScore: document.getElementById('overScore'),
    overStage: document.getElementById('overStage'),
    overHi: document.getElementById('overHi'),
    winScore: document.getElementById('winScore'),
    winStage: document.getElementById('winStage'),
    winHi: document.getElementById('winHi'),
  };

  /* ---------------- Constants ---------------- */

  const TILE = 16;
  const BIG = 32;
  const COLS = 26;
  const ROWS = 26;
  const W = COLS * TILE;
  const H = ROWS * TILE;
  const TANK = 32;
  const BASE_CELL = { c: 6, r: 12 };
  const PLAYER_SPAWN = { c: 4, r: 12 };
  const ENEMY_SPAWNS = [{ c: 0, r: 0 }, { c: 6, r: 0 }, { c: 12, r: 0 }];
  const DIRS = [
    { x: 0, y: -1 }, // 0 up
    { x: 1, y: 0 },  // 1 right
    { x: 0, y: 1 },  // 2 down
    { x: -1, y: 0 }, // 3 left
  ];
  const T = { EMPTY: 0, BRICK: 1, STEEL: 2, WATER: 3, GRASS: 4 };
  const FONT = '"Cascadia Mono", ui-monospace, Consolas, "Microsoft YaHei", monospace';
  const INTRO_TIME = 2.2;
  const SPAWN_FLASH = 0.9;

  const TANK_DEFS = {
    basic: { speed: 54, hp: 1, score: 100, fireCd: 1.9, bulletSpeed: 195, color: '#93a1af', dark: '#505b66', light: '#d2dce5' },
    fast:  { speed: 98, hp: 1, score: 200, fireCd: 2.0, bulletSpeed: 228, color: '#62c98b', dark: '#2f6d4a', light: '#c3f5d8' },
    power: { speed: 64, hp: 1, score: 300, fireCd: 1.1, bulletSpeed: 300, color: '#dd7949', dark: '#7e3c21', light: '#ffc49c' },
    armor: { speed: 48, hp: 4, score: 400, fireCd: 1.45, bulletSpeed: 215, color: '#c4a54c', dark: '#6f5a24', light: '#f1dd97' },
  };

  const POWERUP_META = {
    star:   { color: '#ffd54a', label: '火力提升' },
    shield: { color: '#6fe3ff', label: '护盾启动' },
    bomb:   { color: '#ff7b6b', label: '全屏爆破！' },
    life:   { color: '#7dffb0', label: '生命 +1' },
    freeze: { color: '#9bb8ff', label: '敌军冻结！' },
  };

  const LEVELS = [
    {
      name: 'OUTPOST',
      maxActive: 4,
      spawnEvery: 2.5,
      map: [
        '.............',
        '..BB.B.B.BB..',
        '..BB.B.B.BB..',
        '..BB...B.BB..',
        '..BB.B.B.BB..',
        '.............',
        '.BB.SS.SS.BB.',
        '.............',
        '..BB.B.B.BB..',
        '..BB.B.B.BB..',
        '..WW..B..WW..',
        '.....BBB.....',
        '..GG.B.B.GG..',
      ],
      enemies: ['basic', 'basic', 'fast', 'basic', 'power', 'basic', 'fast', 'armor', 'basic', 'power', 'fast', 'basic'],
    },
    {
      name: 'CROSSFIRE',
      maxActive: 4,
      spawnEvery: 2.3,
      map: [
        '.............',
        '..B.......B..',
        '..B.SS.SS.B..',
        '..B...G...B..',
        '......G......',
        'BB.WW.G.WW.BB',
        '......G......',
        'BB.WW...WW.BB',
        '......G......',
        '..B...G...B..',
        '..B.SS.SS.B..',
        '.....BBB.....',
        '..GG.B.B.GG..',
      ],
      enemies: ['basic', 'fast', 'power', 'armor', 'fast', 'basic', 'power', 'fast', 'armor', 'basic', 'fast', 'power', 'armor', 'fast'],
    },
    {
      name: 'FORTRESS',
      maxActive: 5,
      spawnEvery: 2.1,
      map: [
        '.............',
        '.SS.BB.BB.SS.',
        '.SS.B...B.SS.',
        '....B.W.B....',
        '..BB..W..BB..',
        '..BB..W..BB..',
        '......W......',
        '..BB..W..BB..',
        '..BB..W..BB..',
        '....B.W.B....',
        '.SS.B...B.SS.',
        '.SS..BBB..SS.',
        '..GG.B.B.GG..',
      ],
      enemies: ['power', 'armor', 'fast', 'armor', 'power', 'fast', 'basic', 'armor', 'power', 'fast', 'armor', 'basic', 'power', 'fast', 'armor', 'fast'],
    },
  ];

  /* ---------------- Storage ---------------- */

  function storageGet(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* ignore */ }
  }

  /* ---------------- Sound ---------------- */

  const Sound = {
    ctx: null,
    master: null,
    noiseBuf: null,
    muted: false,
    init() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.3;
        this.master.connect(this.ctx.destination);
        const len = Math.floor(this.ctx.sampleRate * 0.7);
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      } catch (e) {
        this.ctx = null;
      }
    },
    resume() {
      this.init();
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    setMuted(muted) {
      this.muted = !!muted;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.3;
      storageSet('tank-battle:muted', this.muted ? '1' : '0');
    },
    tone(freq, dur, type = 'square', vol = 0.12, slideTo = null, delay = 0) {
      if (!this.ctx || this.muted) return;
      try {
        const t0 = this.ctx.currentTime + delay;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t0 + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        osc.connect(gain);
        gain.connect(this.master);
        osc.start(t0);
        osc.stop(t0 + dur + 0.03);
      } catch (e) { /* ignore */ }
    },
    noise(dur, vol, freq, type = 'lowpass', delay = 0) {
      if (!this.ctx || this.muted || !this.noiseBuf) return;
      try {
        const t0 = this.ctx.currentTime + delay;
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const filter = this.ctx.createBiquadFilter();
        filter.type = type;
        filter.frequency.value = freq;
        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(Math.max(0.0002, vol), t0);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        src.start(t0);
        src.stop(t0 + dur + 0.03);
      } catch (e) { /* ignore */ }
    },
    shoot() {
      this.tone(760, 0.09, 'square', 0.05, 180);
      this.noise(0.05, 0.025, 2600, 'highpass');
    },
    hit() {
      this.noise(0.07, 0.06, 1400);
    },
    explode(big) {
      this.noise(big ? 0.65 : 0.3, big ? 0.42 : 0.2, big ? 420 : 750);
      this.tone(big ? 95 : 150, big ? 0.5 : 0.22, 'triangle', big ? 0.25 : 0.12, 40);
    },
    playerDie() {
      this.tone(420, 0.55, 'sawtooth', 0.22, 55);
      this.noise(0.4, 0.2, 460);
    },
    pickup() {
      [620, 830, 1240].forEach((f, i) => this.tone(f, 0.09, 'square', 0.08, null, i * 0.07));
    },
    stageStart() {
      [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.11, 'triangle', 0.08, null, i * 0.1));
    },
    stageClear() {
      [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.09, null, i * 0.11));
    },
    gameOver() {
      [392, 330, 262, 175].forEach((f, i) => this.tone(f, 0.24, 'sawtooth', 0.11, null, i * 0.16));
    },
    fanfare() {
      [523, 659, 784, 1046, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.15, 'triangle', 0.1, null, i * 0.13));
    },
    click() {
      this.tone(320, 0.045, 'square', 0.035, 260);
    },
  };

  /* ---------------- Input ---------------- */

  const Input = {
    dirStack: [],
    fire: false,
    pressDir(dir) {
      this.dirStack = this.dirStack.filter((d) => d !== dir);
      this.dirStack.push(dir);
    },
    releaseDir(dir) {
      this.dirStack = this.dirStack.filter((d) => d !== dir);
    },
    get dir() {
      return this.dirStack.length ? this.dirStack[this.dirStack.length - 1] : null;
    },
    clear() {
      this.dirStack = [];
      this.fire = false;
    },
  };

  const KEY_DIRS = {
    ArrowUp: 0, ArrowRight: 1, ArrowDown: 2, ArrowLeft: 3,
    w: 0, d: 1, s: 2, a: 3,
    W: 0, D: 1, S: 2, A: 3,
  };

  /* ---------------- Game state ---------------- */

  let state = 'menu';
  let tiles = [];
  let base = null;
  let player = null;
  let enemies = [];
  let bullets = [];
  let particles = [];
  let rings = [];
  let floaters = [];
  let powerups = [];
  let enemyQueue = [];
  let stageCfg = LEVELS[0];
  let stageIndex = 0;
  let score = 0;
  let lives = 3;
  let hiScore = 0;
  let spawnTimer = 0;
  let spawnCursor = 0;
  let spawnedCount = 0;
  let levelIntro = 0;
  let clearTimer = 0;
  let stageClearTriggered = false;
  let deadTimer = 0;
  let ending = null;
  let frozenTimer = 0;
  let shake = 0;
  let flash = 0;
  let time = 0;
  let toastText = '';
  let toastColor = '#ffd35e';
  let toastTimer = 0;
  let toastMax = 0;
  let floorLayer = null;

  /* ---------------- Utilities ---------------- */

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  function fmt(n, len = 6) {
    return String(Math.max(0, Math.floor(n))).padStart(len, '0');
  }

  function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function hash(a, b, s) {
    const v = Math.sin(a * 127.1 + b * 311.7 + s * 74.7) * 43758.5453;
    return v - Math.floor(v);
  }

  function roundRectPath(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function updateSoundButton() {
    if (!ui.soundBtn) return;
    ui.soundBtn.textContent = Sound.muted ? '✕' : '♪';
    ui.soundBtn.classList.toggle('is-off', Sound.muted);
    ui.soundBtn.setAttribute('aria-pressed', String(Sound.muted));
    ui.soundBtn.setAttribute('aria-label', Sound.muted ? '开启声音' : '关闭声音');
  }

  function toggleMute() {
    Sound.setMuted(!Sound.muted);
    updateSoundButton();
    if (!Sound.muted) Sound.click();
  }

  /* ---------------- HUD & overlays ---------------- */

  function enemyRemaining() {
    return enemyQueue.length + enemies.filter((e) => e.alive).length;
  }

  function updateHUD() {
    ui.score.textContent = fmt(score);
    ui.hiScore.textContent = fmt(Math.max(hiScore, score));
    ui.stage.textContent = fmt(stageIndex + 1, 2);
    ui.lives.textContent = fmt(lives, 2);
    ui.enemies.textContent = fmt(enemyRemaining(), 2);
    ui.menuHi.textContent = fmt(hiScore);
  }

  function addScore(points) {
    score += points;
    if (score > hiScore) hiScore = score;
    updateHUD();
  }

  const OVERLAY_IDS = ['menuScreen', 'pauseScreen', 'overScreen', 'winScreen'];

  function showOverlay(id) {
    for (const overlayId of OVERLAY_IDS) {
      const el = document.getElementById(overlayId);
      if (!el) continue;
      const visible = overlayId === id;
      el.classList.toggle('is-visible', visible);
      el.setAttribute('aria-hidden', String(!visible));
    }
  }

  function hideOverlays() {
    for (const overlayId of OVERLAY_IDS) {
      const el = document.getElementById(overlayId);
      if (!el) continue;
      el.classList.remove('is-visible');
      el.setAttribute('aria-hidden', 'true');
    }
  }

  function toast(text, color = '#ffd35e', duration = 1.6) {
    toastText = text;
    toastColor = color;
    toastTimer = duration;
    toastMax = duration;
  }

  /* ---------------- Sound button ---------------- */

  ui.soundBtn.addEventListener('click', () => {
    Sound.resume();
    toggleMute();
  });

  ui.pauseBtn.addEventListener('click', () => {
    if (state === 'playing' || state === 'paused') togglePause();
  });

  /* ---------------- Buttons ---------------- */

  document.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    Sound.resume();
    Sound.click();
    btn.blur();
    switch (btn.dataset.action) {
      case 'start':
      case 'restart':
        startGame();
        break;
      case 'resume':
        if (state === 'paused') togglePause();
        break;
      case 'menu':
        goMenu();
        break;
      default:
        break;
    }
  });

  /* ---------------- Flow ---------------- */

  function startGame() {
    Sound.resume();
    score = 0;
    lives = 3;
    stageIndex = 0;
    state = 'playing';
    Input.clear();
    hideOverlays();
    buildStage(0);
    updateHUD();
  }

  function goMenu() {
    state = 'menu';
    Input.clear();
    score = 0;
    lives = 3;
    buildStage(0);
    updateHUD();
    showOverlay('menuScreen');
  }

  function togglePause() {
    if (state === 'playing' && !ending) {
      state = 'paused';
      Input.clear();
      document.querySelectorAll('.dpad-btn.active, .fire-btn.active').forEach((el) => el.classList.remove('active'));
      showOverlay('pauseScreen');
      Sound.click();
    } else if (state === 'paused') {
      state = 'playing';
      hideOverlays();
      Sound.click();
    }
  }

  function buildStage(index) {
    stageIndex = index;
    stageCfg = LEVELS[index];

    tiles = Array.from({ length: ROWS }, () => new Uint8Array(COLS));
    stageCfg.map.forEach((row, br) => {
      for (let bc = 0; bc < 13; bc++) {
        const ch = row[bc] || '.';
        let type = T.EMPTY;
        if (ch === 'B') type = T.BRICK;
        else if (ch === 'S') type = T.STEEL;
        else if (ch === 'W') type = T.WATER;
        else if (ch === 'G') type = T.GRASS;
        if (!type) continue;
        for (let dy = 0; dy < 2; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            tiles[br * 2 + dy][bc * 2 + dx] = type;
          }
        }
      }
    });

    base = { x: BASE_CELL.c * BIG, y: BASE_CELL.r * BIG, w: BIG, h: BIG, alive: true };
    player = createPlayer();
    enemies = [];
    bullets = [];
    particles = [];
    rings = [];
    floaters = [];
    powerups = [];
    enemyQueue = stageCfg.enemies.slice();
    spawnCursor = 0;
    spawnedCount = 0;
    spawnTimer = 1.1;
    levelIntro = INTRO_TIME;
    clearTimer = 0;
    stageClearTriggered = false;
    deadTimer = 0;
    ending = null;
    frozenTimer = 0;
    toastText = '';
    toastTimer = 0;

    if (state === 'playing') Sound.stageStart();
    updateHUD();
  }

  function beginEnding(kind, delay) {
    if (ending) return;
    ending = { kind, timer: delay };
    Input.clear();
  }

  function endRun(kind) {
    ending = null;
    state = kind === 'win' ? 'victory' : 'gameover';
    Input.clear();
    hiScore = Math.max(hiScore, score);
    saveBest();
    updateHUD();

    const isWin = kind === 'win';
    if (isWin) {
      ui.winScore.textContent = fmt(score);
      ui.winStage.textContent = fmt(stageIndex + 1, 2);
      ui.winHi.textContent = fmt(hiScore);
    } else {
      ui.overScore.textContent = fmt(score);
      ui.overStage.textContent = fmt(stageIndex + 1, 2);
      ui.overHi.textContent = fmt(hiScore);
    }
    showOverlay(isWin ? 'winScreen' : 'overScreen');
    if (isWin) Sound.fanfare();
    else Sound.gameOver();
  }

  function advanceStage() {
    if (stageIndex + 1 >= LEVELS.length) {
      endRun('win');
      return;
    }
    const carriedPower = player ? player.power : 0;
    stageIndex += 1;
    buildStage(stageIndex);
    if (player) player.power = carriedPower;
    updateHUD();
  }

  function saveBest() {
    hiScore = Math.max(hiScore, score);
    storageSet('tank-battle:hiscore', String(hiScore));
  }

  /* ---------------- Entities ---------------- */

  function createPlayer() {
    return {
      x: PLAYER_SPAWN.c * BIG,
      y: PLAYER_SPAWN.r * BIG,
      dir: 0,
      isEnemy: false,
      alive: true,
      speed: 110,
      cooldown: 0,
      power: 0,
      shield: 3.2,
      spawning: 0,
      hitFlash: 0,
      dist: 0,
    };
  }

  function spawnEnemy(x, y, type) {
    const def = TANK_DEFS[type];
    const e = {
      x, y,
      dir: 2,
      isEnemy: true,
      alive: true,
      type,
      def,
      speed: def.speed * (1 + stageIndex * 0.06),
      hp: def.hp,
      maxHp: def.hp,
      cooldown: 0.9 + Math.random() * 0.9,
      dirTimer: 0.4 + Math.random() * 0.8,
      stuck: 0,
      spawning: SPAWN_FLASH,
      shield: 0.5,
      bonus: spawnedCount % 4 === 3,
      hitFlash: 0,
      dist: 0,
    };
    spawnedCount += 1;
    enemies.push(e);
    updateHUD();
  }

  /* ---------------- Collision helpers ---------------- */

  function tilesBlockTank(x, y) {
    const c0 = Math.floor(x / TILE);
    const c1 = Math.floor((x + TANK - 0.01) / TILE);
    const r0 = Math.floor(y / TILE);
    const r1 = Math.floor((y + TANK - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = tiles[r] ? tiles[r][c] : T.STEEL;
        if (t === T.BRICK || t === T.STEEL || t === T.WATER) return true;
      }
    }
    return false;
  }

  function tankBlockedAt(tank, x, y) {
    if (x < 0 || y < 0 || x + TANK > W || y + TANK > H) return true;
    if (base.alive && rectsOverlap(x, y, TANK, TANK, base.x, base.y, base.w, base.h)) return true;
    if (tilesBlockTank(x, y)) return true;
    if (player && player !== tank && player.alive && rectsOverlap(x, y, TANK, TANK, player.x, player.y, TANK, TANK)) return true;
    for (const e of enemies) {
      if (e === tank || !e.alive || e.spawning > 0) continue;
      if (rectsOverlap(x, y, TANK, TANK, e.x, e.y, TANK, TANK)) return true;
    }
    return false;
  }

  function turnTank(tank, dir) {
    if (tank.dir === dir) return;
    const oldAxis = tank.dir % 2;
    const newAxis = dir % 2;
    tank.dir = dir;
    if (oldAxis !== newAxis) {
      if (newAxis === 1) {
        const snapped = Math.round(tank.y / 4) * 4;
        if (snapped !== tank.y && !tankBlockedAt(tank, tank.x, snapped)) tank.y = snapped;
      } else {
        const snapped = Math.round(tank.x / 4) * 4;
        if (snapped !== tank.x && !tankBlockedAt(tank, snapped, tank.y)) tank.x = snapped;
      }
    }
  }

  function tryMove(tank, dt) {
    const d = DIRS[tank.dir];
    const step = tank.speed * dt;
    const nx = tank.x + d.x * step;
    const ny = tank.y + d.y * step;

    if (!tankBlockedAt(tank, nx, ny)) {
      tank.x = nx;
      tank.y = ny;
      tank.dist = (tank.dist || 0) + step;
      return true;
    }

    // Corner assist: nudge slightly sideways to slip into openings.
    for (let offset = 1; offset <= 6; offset++) {
      for (const sign of [1, -1]) {
        const ax = nx + (d.y !== 0 ? sign * offset : 0);
        const ay = ny + (d.x !== 0 ? sign * offset : 0);
        if (!tankBlockedAt(tank, ax, ay)) {
          tank.x = ax;
          tank.y = ay;
          tank.dist = (tank.dist || 0) + step + offset * 0.1;
          return true;
        }
      }
    }
    return false;
  }

  /* ---------------- Effects ---------------- */

  function spark(x, y, color = '#ffd977') {
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 30 + Math.random() * 70;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.15 + Math.random() * 0.2,
        max: 0.35,
        size: 1 + Math.random() * 2,
        color,
      });
    }
  }

  function brickDebris(x, y) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: x + (Math.random() * 10 - 5),
        y: y + (Math.random() * 10 - 5),
        vx: Math.random() * 80 - 40,
        vy: Math.random() * 80 - 60,
        life: 0.25 + Math.random() * 0.25,
        max: 0.5,
        size: 1.5 + Math.random() * 2,
        color: Math.random() < 0.5 ? '#a8452a' : '#7e3320',
      });
    }
  }

  function steelDebris(x, y) {
    for (let i = 0; i < 4; i++) {
      particles.push({
        x, y,
        vx: Math.random() * 100 - 50,
        vy: Math.random() * 100 - 60,
        life: 0.2 + Math.random() * 0.2,
        max: 0.4,
        size: 1 + Math.random() * 1.8,
        color: '#aebbc7',
      });
    }
  }

  function explode(x, y, scale = 1, big = false, playSound = true) {
    const count = Math.round((big ? 30 : 16) * scale);
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = (25 + Math.random() * (big ? 190 : 115)) * scale;
      const colors = ['#fff0b4', '#ffd06a', '#ff9a3d', '#f26034', '#a8341f'];
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 12,
        life: 0.3 + Math.random() * (big ? 0.7 : 0.45),
        max: big ? 1 : 0.75,
        size: 1.5 + Math.random() * 3.4 * scale,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
    rings.push({
      x, y,
      r: 4,
      maxR: (big ? 56 : 28) * scale,
      life: 0.45,
      max: 0.45,
      color: big ? 'rgba(255,170,80,0.8)' : 'rgba(255,200,120,0.6)',
    });
    shake = Math.max(shake, big ? 15 : 5 * scale);
    flash = Math.max(flash, big ? 0.7 : 0.22);
    if (playSound) Sound.explode(big);
  }

  function muzzle(x, y, dir, color) {
    const d = DIRS[dir];
    for (let i = 0; i < 4; i++) {
      particles.push({
        x: x + (Math.random() * 2 - 1),
        y: y + (Math.random() * 2 - 1),
        vx: d.x * (40 + Math.random() * 50) + (Math.random() * 30 - 15),
        vy: d.y * (40 + Math.random() * 50) + (Math.random() * 30 - 15),
        life: 0.06 + Math.random() * 0.08,
        max: 0.14,
        size: 1 + Math.random() * 2,
        color,
      });
    }
  }

  function updateEffects(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2.2 * dt;
      p.vy *= 1 - 2.2 * dt;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const r of rings) {
      r.r += (r.maxR - r.r) * Math.min(1, dt * 7);
      r.life -= dt;
    }
    rings = rings.filter((r) => r.life > 0);
    for (const f of floaters) {
      f.y -= 18 * dt;
      f.life -= dt;
    }
    floaters = floaters.filter((f) => f.life > 0);
    shake = Math.max(0, shake - dt * 42);
    flash = Math.max(0, flash - dt * 2.4);
  }

  /* ---------------- Shooter ---------------- */

  function playerShoot() {
    if (!player.alive || player.cooldown > 0 || ending) return;
    const maxBullets = player.power >= 2 ? 2 : 1;
    let count = 0;
    for (const b of bullets) if (b.alive && b.owner === 'player') count += 1;
    if (count >= maxBullets) return;

    player.cooldown = 0.27;
    const d = DIRS[player.dir];
    const bx = player.x + TANK / 2 + d.x * 21;
    const by = player.y + TANK / 2 + d.y * 21;
    bullets.push({
      x: bx,
      y: by,
      dir: player.dir,
      speed: 285 + player.power * 25,
      owner: 'player',
      power: player.power >= 3 ? 2 : 1,
      alive: true,
    });
    muzzle(bx, by, player.dir, '#ffe9a0');
    Sound.shoot();
  }

  function enemyShoot(e) {
    const d = DIRS[e.dir];
    const bx = e.x + TANK / 2 + d.x * 21;
    const by = e.y + TANK / 2 + d.y * 21;
    bullets.push({
      x: bx,
      y: by,
      dir: e.dir,
      speed: e.def.bulletSpeed,
      owner: 'enemy',
      power: 1,
      alive: true,
    });
    muzzle(bx, by, e.dir, '#ffb28a');
    Sound.shoot();
  }

  /* ---------------- Player updates ---------------- */

  function updatePlayer(dt) {
    if (!player.alive) {
      if (ending) return;
      deadTimer -= dt;
      if (deadTimer <= 0) {
        const spawnTank = { x: PLAYER_SPAWN.c * BIG, y: PLAYER_SPAWN.r * BIG, dir: 0, alive: true, isEnemy: false, spawning: 0 };
        if (tankBlockedAt(spawnTank, spawnTank.x, spawnTank.y)) {
          deadTimer = 0.25;
          return;
        }
        player = createPlayer();
        player.power = 0;
        player.shield = 2.9;
        toast('PLAYER 1', '#7dffb0', 0.8);
      }
      return;
    }

    if (player.shield > 0) player.shield = Math.max(0, player.shield - dt);
    if (player.hitFlash > 0) player.hitFlash -= dt;

    const dir = Input.dir;
    if (dir !== null) {
      if (player.dir !== dir) turnTank(player, dir);
      tryMove(player, dt);
    }

    player.cooldown = Math.max(0, player.cooldown - dt);
    if (Input.fire) playerShoot();
  }

  function hitPlayer() {
    if (!player || !player.alive || ending) return;
    if (player.shield > 0) {
      spark(player.x + 16, player.y + 16, '#9fe8ff');
      Sound.hit();
      return;
    }
    player.alive = false;
    explode(player.x + 16, player.y + 16, 1.35, false, false);
    Sound.playerDie();
    lives -= 1;
    deadTimer = 1.7;
    if (lives <= 0) beginEnding('lose', 1.7);
    updateHUD();
  }

  /* ---------------- Enemy updates ---------------- */

  function enemyAimsAt(enemy, cx, cy) {
    const ex = enemy.x + 16;
    const ey = enemy.y + 16;
    if (enemy.dir === 0) return cy < ey - 4 && Math.abs(cx - ex) < 22;
    if (enemy.dir === 2) return cy > ey + 4 && Math.abs(cx - ex) < 22;
    if (enemy.dir === 1) return cx > ex + 4 && Math.abs(cy - ey) < 22;
    return cx < ex - 4 && Math.abs(cy - ey) < 22;
  }

  function chooseEnemyDir(e) {
    const preferBase = Math.random() < 0.55 || !player.alive;
    const tx = preferBase ? base.x + 16 : player.x + 16;
    const ty = preferBase ? base.y + 16 : player.y + 16;
    const ex = e.x + 16;
    const ey = e.y + 16;
    const dx = tx - ex;
    const dy = ty - ey;

    const vdir = dy > 0 ? 2 : 0;
    const hdir = dx > 0 ? 1 : 3;
    let prefs;
    if (Math.abs(dx) > Math.abs(dy)) {
      prefs = [hdir, vdir, hdir === 1 ? 3 : 1, vdir === 2 ? 0 : 2];
    } else {
      prefs = [vdir, hdir, vdir === 2 ? 0 : 2, hdir === 1 ? 3 : 1];
    }
    if (Math.random() < 0.22) prefs.unshift((e.dir + (Math.random() < 0.5 ? 1 : 3)) % 4);

    for (const dir of prefs) {
      const nx = e.x + DIRS[dir].x * 6;
      const ny = e.y + DIRS[dir].y * 6;
      if (!tankBlockedAt(e, nx, ny)) return dir;
    }
    return e.dir;
  }

  function updateEnemies(dt) {
    for (const e of enemies) {
      if (!e.alive) continue;

      if (e.spawning > 0) {
        e.spawning -= dt;
        if (e.spawning <= 0) {
          if (tankBlockedAt(e, e.x, e.y)) {
            e.spawning = 0.25;
          } else {
            e.spawning = 0;
            e.shield = 0.55;
          }
        }
        continue;
      }

      if (e.shield > 0) e.shield = Math.max(0, e.shield - dt);
      if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
      if (frozenTimer > 0) continue;

      e.cooldown -= dt;
      e.dirTimer -= dt;

      const moved = tryMove(e, dt);
      if (!moved) {
        e.stuck += dt;
        if (e.stuck > 0.12) {
          e.dir = chooseEnemyDir(e);
          e.dirTimer = 0.6 + Math.random() * 1.1;
          e.stuck = 0;
        }
      } else if (e.dirTimer <= 0) {
        e.dir = chooseEnemyDir(e);
        e.dirTimer = 0.7 + Math.random() * 1.2;
      }

      if (e.cooldown <= 0) {
        const aimsPlayer = player.alive && enemyAimsAt(e, player.x + 16, player.y + 16);
        const aimsBase = base.alive && enemyAimsAt(e, base.x + 16, base.y + 16);
        if (aimsPlayer || aimsBase || Math.random() < 0.12) {
          enemyShoot(e);
          e.cooldown = e.def.fireCd * (0.85 + Math.random() * 0.5);
        } else {
          e.cooldown = 0.2 + Math.random() * 0.25;
        }
      }
    }
  }

  function updateSpawner(dt) {
    if (enemyQueue.length === 0) return;
    const active = enemies.filter((e) => e.alive).length;
    if (active >= stageCfg.maxActive) return;

    spawnTimer -= dt;
    if (spawnTimer > 0) return;

    for (let i = 0; i < ENEMY_SPAWNS.length; i++) {
      const idx = (spawnCursor + i) % ENEMY_SPAWNS.length;
      const spot = ENEMY_SPAWNS[idx];
      const x = spot.c * BIG;
      const y = spot.r * BIG;
      if (spawnAreaClear(x, y)) {
        spawnCursor = (idx + 1) % ENEMY_SPAWNS.length;
        const type = enemyQueue.shift();
        spawnEnemy(x, y, type);
        spawnTimer = stageCfg.spawnEvery;
        return;
      }
    }
    spawnTimer = 0.5;
  }

  function spawnAreaClear(x, y) {
    if (tilesBlockTank(x, y)) return false;
    if (base.alive && rectsOverlap(x, y, TANK, TANK, base.x, base.y, base.w, base.h)) return false;
    if (player && player.alive && rectsOverlap(x, y, TANK, TANK, player.x, player.y, TANK, TANK)) return false;
    for (const e of enemies) {
      if (e.alive && rectsOverlap(x, y, TANK, TANK, e.x, e.y, TANK, TANK)) return false;
    }
    return true;
  }

  /* ---------------- Damage & power-ups ---------------- */

  function damageEnemy(e) {
    if (!e.alive || e.spawning > 0) return;
    if (e.shield > 0) {
      spark(e.x + 16, e.y + 16, '#bfefff');
      Sound.hit();
      return;
    }
    e.hp -= 1;
    if (e.hp > 0) {
      e.hitFlash = 0.12;
      spark(e.x + 16, e.y + 12, '#ffe6a8');
      Sound.hit();
      return;
    }
    killEnemy(e, true);
  }

  function killEnemy(e, allowDrop = true) {
    if (!e.alive) return;
    e.alive = false;
    explode(e.x + 16, e.y + 16, 1.05, false, false);
    Sound.explode(false);
    addScore(e.def.score);
    floaters.push({
      x: e.x + 16,
      y: e.y + 10,
      text: '+' + e.def.score,
      color: '#ffe28a',
      life: 0.9,
      max: 0.9,
    });
    if (e.bonus && allowDrop) dropPowerup(e.x, e.y);
    updateHUD();
  }

  function destroyBase() {
    if (!base.alive) return;
    base.alive = false;
    explode(base.x + 16, base.y + 16, 2.1, true, false);
    Sound.explode(true);
    toast('基地失守', '#ff6b6b', 2.2);
    beginEnding('lose', 1.8);
  }

  function bombAll() {
    Sound.explode(true);
    let gained = 0;
    for (const e of enemies) {
      if (!e.alive) continue;
      e.alive = false;
      explode(e.x + 16, e.y + 16, 0.9, false, false);
      gained += e.def.score;
    }
    addScore(gained);
    updateHUD();
  }

  function randomPowerupKind() {
    let table = [
      ['star', 26],
      ['shield', 22],
      ['freeze', 22],
      ['bomb', 16],
      ['life', 14],
    ];
    if (player.power >= 3) table = table.filter(([kind]) => kind !== 'star');
    const total = table.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = Math.random() * total;
    for (const [kind, weight] of table) {
      roll -= weight;
      if (roll <= 0) return kind;
    }
    return 'shield';
  }

  function dropPowerup(x, y) {
    const kind = randomPowerupKind();
    powerups.push({
      x: clamp(x, 4, W - 36),
      y: clamp(y, 4, H - 36),
      kind,
      color: POWERUP_META[kind].color,
      life: 12,
      maxLife: 12,
      seed: Math.random() * Math.PI * 2,
      alive: true,
    });
  }

  function applyPowerup(p) {
    Sound.pickup();
    addScore(500);
    floaters.push({
      x: p.x + 16,
      y: p.y,
      text: '+500',
      color: '#fff0b4',
      life: 0.9,
      max: 0.9,
    });
    switch (p.kind) {
      case 'star':
        if (player.power < 3) {
          player.power += 1;
          toast('火力提升 ' + '★'.repeat(player.power), '#ffd54a', 1.5);
        } else {
          toast('火力全开！', '#ffd54a', 1.2);
          addScore(300);
        }
        break;
      case 'shield':
        player.shield = Math.max(player.shield, 10);
        toast('护盾启动', '#6fe3ff', 1.5);
        break;
      case 'bomb':
        toast('全屏爆破！', '#ff8a70', 1.5);
        bombAll();
        break;
      case 'life':
        lives += 1;
        toast('生命 +1', '#7dffb0', 1.5);
        break;
      case 'freeze':
        frozenTimer = 6;
        toast('敌军冻结 6 秒', '#9bb8ff', 1.5);
        break;
      default:
        break;
    }
    p.alive = false;
    updateHUD();
  }

  function updatePowerups(dt) {
    for (const p of powerups) {
      if (!p.alive) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        continue;
      }
      if (player && player.alive && rectsOverlap(player.x, player.y, TANK, TANK, p.x + 3, p.y + 3, 26, 26)) {
        applyPowerup(p);
      }
    }
    powerups = powerups.filter((p) => p.alive);
  }

  /* ---------------- Bullets ---------------- */

  function updateBullets(dt) {
    for (const b of bullets) {
      if (!b.alive) continue;
      const travel = b.speed * dt;
      const steps = Math.max(1, Math.ceil(travel / 4));
      const stepDist = travel / steps;
      const d = DIRS[b.dir];
      for (let i = 0; i < steps && b.alive; i++) {
        b.x += d.x * stepDist;
        b.y += d.y * stepDist;
        bulletCollide(b);
      }
    }

    for (let i = 0; i < bullets.length; i++) {
      const a = bullets[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < bullets.length; j++) {
        const c = bullets[j];
        if (!c.alive || a.owner === c.owner) continue;
        if (rectsOverlap(a.x - 3, a.y - 3, 6, 6, c.x - 3, c.y - 3, 6, 6)) {
          a.alive = false;
          c.alive = false;
          spark((a.x + c.x) / 2, (a.y + c.y) / 2, '#ffe9b0');
          break;
        }
      }
    }

    bullets = bullets.filter((b) => b.alive);
  }

  function bulletCollide(b) {
    const r = 3;
    if (b.x < -8 || b.y < -8 || b.x > W + 8 || b.y > H + 8) {
      b.alive = false;
      return;
    }

    // Base
    if (base.alive && rectsOverlap(b.x - r, b.y - r, r * 2, r * 2, base.x, base.y, base.w, base.h)) {
      b.alive = false;
      if (b.owner === 'enemy') destroyBase();
      else spark(b.x, b.y, '#ffd35e');
      return;
    }

    // Tiles
    const c0 = Math.floor((b.x - r) / TILE);
    const c1 = Math.floor((b.x + r) / TILE);
    const r0 = Math.floor((b.y - r) / TILE);
    const r1 = Math.floor((b.y + r) / TILE);
    let hitWall = false;
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        if (row < 0 || col < 0 || row >= ROWS || col >= COLS) {
          hitWall = true;
          continue;
        }
        const type = tiles[row][col];
        if (type === T.BRICK) {
          tiles[row][col] = T.EMPTY;
          brickDebris(col * TILE + 8, row * TILE + 8);
          hitWall = true;
        } else if (type === T.STEEL) {
          if (b.owner === 'player' && b.power >= 2) {
            tiles[row][col] = T.EMPTY;
            steelDebris(col * TILE + 8, row * TILE + 8);
          }
          hitWall = true;
        }
      }
    }
    if (hitWall) {
      b.alive = false;
      spark(b.x, b.y, b.owner === 'player' ? '#ffd977' : '#ff9f7a');
      Sound.hit();
      return;
    }

    // Tanks
    if (b.owner === 'player') {
      for (const e of enemies) {
        if (!e.alive || e.spawning > 0) continue;
        if (rectsOverlap(b.x - r, b.y - r, r * 2, r * 2, e.x, e.y, TANK, TANK)) {
          b.alive = false;
          damageEnemy(e);
          return;
        }
      }
    } else if (player && player.alive) {
      if (rectsOverlap(b.x - r, b.y - r, r * 2, r * 2, player.x, player.y, TANK, TANK)) {
        b.alive = false;
        hitPlayer();
      }
    }
  }

  /* ---------------- Stage flow ---------------- */

  function checkLevelClear() {
    if (stageClearTriggered || ending) return;
    if (enemyQueue.length > 0) return;
    if (enemies.some((e) => e.alive)) return;
    stageClearTriggered = true;
    addScore(1000);
    toast('STAGE CLEAR  +1000', '#7dffb0', 2.0);
    Sound.stageClear();
    clearTimer = 2.4;
  }

  /* ---------------- Update ---------------- */

  function update(dt) {
    time += dt;
    if (state !== 'playing') return;

    updateEffects(dt);
    if (toastTimer > 0) toastTimer -= dt;

    if (ending) {
      ending.timer -= dt;
      if (ending.timer <= 0) endRun(ending.kind);
      return;
    }

    if (clearTimer > 0) {
      clearTimer -= dt;
      if (clearTimer <= 0) advanceStage();
      return;
    }

    if (levelIntro > 0) {
      levelIntro -= dt;
      if (levelIntro <= 0) toast('GO!', '#8effc0', 0.8);
      return;
    }

    if (frozenTimer > 0) frozenTimer = Math.max(0, frozenTimer - dt);

    updateSpawner(dt);
    updatePlayer(dt);
    updateEnemies(dt);
    updateBullets(dt);
    updatePowerups(dt);
    checkLevelClear();
  }

  /* ---------------- Rendering: world ---------------- */

  function makeFloorLayer() {
    const layer = document.createElement('canvas');
    layer.width = W;
    layer.height = H;
    const g = layer.getContext('2d');

    g.fillStyle = '#0a0f14';
    g.fillRect(0, 0, W, H);

    const grad = g.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H / 2, 330);
    grad.addColorStop(0, 'rgba(32, 48, 60, 0.34)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    g.fillStyle = 'rgba(170, 200, 220, 0.05)';
    for (let i = 0; i < 210; i++) {
      g.fillRect((Math.random() * W) | 0, (Math.random() * H) | 0, 1, 1);
    }

    g.strokeStyle = 'rgba(110, 160, 190, 0.055)';
    g.lineWidth = 1;
    for (let x = 0; x <= W; x += BIG) {
      g.beginPath();
      g.moveTo(x + 0.5, 0);
      g.lineTo(x + 0.5, H);
      g.stroke();
    }
    for (let y = 0; y <= H; y += BIG) {
      g.beginPath();
      g.moveTo(0, y + 0.5);
      g.lineTo(W, y + 0.5);
      g.stroke();
    }
    return layer;
  }

  function drawBrick(x, y, c, r) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE, TILE);
    ctx.clip();

    ctx.fillStyle = '#3c1810';
    ctx.fillRect(x, y, TILE, TILE);

    const shade = (c * 3 + r * 5) % 3;
    const main = shade === 0 ? '#a8452a' : shade === 1 ? '#9c3f26' : '#b14b2e';

    for (let row = 0; row < 2; row++) {
      const yy = y + row * 8 + 1;
      const offset = row === 0 ? 0 : 4;
      for (let bx = -8; bx < 24; bx += 8) {
        const xx = x + bx + offset;
        ctx.fillStyle = main;
        ctx.fillRect(xx, yy, 7, 6);
        ctx.fillStyle = '#cf6240';
        ctx.fillRect(xx, yy, 7, 1);
      }
    }
    ctx.restore();
  }

  function drawSteel(x, y) {
    ctx.fillStyle = '#3b444e';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#78848f';
    ctx.fillRect(x + 1, y + 1, 14, 14);
    ctx.fillStyle = '#97a4b0';
    ctx.fillRect(x + 1, y + 1, 14, 2);
    ctx.fillRect(x + 1, y + 1, 2, 14);
    ctx.fillStyle = '#59646f';
    ctx.fillRect(x + 4, y + 4, 8, 8);
    ctx.fillStyle = '#c7d2dc';
    ctx.fillRect(x + 2, y + 2, 2, 2);
    ctx.fillRect(x + 12, y + 2, 2, 2);
    ctx.fillRect(x + 2, y + 12, 2, 2);
    ctx.fillRect(x + 12, y + 12, 2, 2);
  }

  function drawWater(x, y, c, r) {
    ctx.fillStyle = '#0b2238';
    ctx.fillRect(x, y, TILE, TILE);
    const phase = time * 2.2 + c * 0.7 + r * 0.5;
    const wave = Math.sin(phase) * 1.5;
    ctx.fillStyle = '#123a5e';
    ctx.fillRect(x, y + 4 + wave, TILE, 4);
    ctx.fillStyle = '#1a567f';
    ctx.fillRect(x, y + 10 - wave, TILE, 3);
    ctx.fillStyle = 'rgba(120, 205, 255, 0.45)';
    const sparkle = (c * 5 + Math.floor(time * 9)) % 12;
    ctx.fillRect(x + sparkle, y + 2 + wave, 3, 1);
  }

  function drawGrass(x, y, c, r) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, TILE, TILE);
    ctx.clip();
    ctx.fillStyle = 'rgba(15, 55, 33, 0.94)';
    ctx.fillRect(x, y, TILE, TILE);
    const colors = ['#1b5b36', '#226b3f', '#2a7d49'];
    for (let i = 0; i < 5; i++) {
      const h1 = hash(c, r, i);
      const h2 = hash(c + 9, r + 4, i + 3);
      const px = x - 3 + h1 * 22;
      const py = y - 3 + h2 * 22;
      const rad = 4 + h1 * 4.5;
      ctx.fillStyle = colors[(i + Math.floor(h1 * 3)) % 3];
      ctx.beginPath();
      ctx.arc(px, py, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(130, 220, 160, 0.10)';
    for (let i = 0; i < 3; i++) {
      const h = hash(c + 3, r + 7, i + 9);
      ctx.fillRect(x + 2 + h * 12, y + 2 + hash(c, r, i + 11) * 12, 2, 1);
    }
    ctx.restore();
  }

  function drawBase() {
    const x = base.x;
    const y = base.y;

    ctx.save();
    ctx.fillStyle = '#10151a';
    ctx.fillRect(x, y, BIG, BIG);
    ctx.shadowColor = 'rgba(255, 205, 90, 0.55)';
    ctx.shadowBlur = 10 + Math.sin(time * 2.4) * 4;

    ctx.fillStyle = '#c9a545';
    // wings
    ctx.fillRect(x + 6, y + 13, 8, 3);
    ctx.fillRect(x + 18, y + 13, 8, 3);
    ctx.fillRect(x + 3, y + 16, 10, 3);
    ctx.fillRect(x + 19, y + 16, 10, 3);
    ctx.fillRect(x + 2, y + 19, 11, 3);
    ctx.fillRect(x + 19, y + 19, 11, 3);
    // body + head
    ctx.fillRect(x + 13, y + 10, 6, 14);
    ctx.fillRect(x + 12, y + 6, 8, 6);
    ctx.fillRect(x + 20, y + 8, 3, 3);
    // pedestal
    ctx.fillRect(x + 11, y + 24, 11, 2);
    ctx.fillRect(x + 5, y + 26, 22, 2);

    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f6dd8e';
    ctx.fillRect(x + 13, y + 10, 2, 11);
    ctx.fillRect(x + 6, y + 13, 4, 1);
    ctx.fillRect(x + 22, y + 19, 5, 1);
    ctx.fillStyle = '#241c0a';
    ctx.fillRect(x + 15, y + 8, 2, 2);
    ctx.restore();
  }

  function drawRubble() {
    const x = base.x;
    const y = base.y;
    ctx.save();
    ctx.fillStyle = '#101317';
    ctx.fillRect(x, y, BIG, BIG);
    ctx.fillStyle = '#3d4249';
    for (let i = 0; i < 14; i++) {
      const h1 = hash(i, 3, 7);
      const h2 = hash(i, 9, 2);
      const w = 3 + Math.floor(h1 * 7);
      const h = 2 + Math.floor(h2 * 5);
      ctx.fillRect(x + 2 + h1 * (28 - w), y + 4 + h2 * (24 - h), w, h);
    }
    ctx.fillStyle = 'rgba(255, 120, 50, ' + (0.3 + 0.3 * Math.sin(time * 4)) + ')';
    ctx.fillRect(x + 12, y + 18, 3, 2);
    ctx.fillRect(x + 21, y + 11, 2, 2);
    ctx.restore();
  }

  function drawTiles(grassPass) {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const type = tiles[r][c];
        if (!type) continue;
        const x = c * TILE;
        const y = r * TILE;
        if (grassPass) {
          if (type === T.GRASS) drawGrass(x, y, c, r);
        } else if (type === T.BRICK) {
          drawBrick(x, y, c, r);
        } else if (type === T.STEEL) {
          drawSteel(x, y);
        } else if (type === T.WATER) {
          drawWater(x, y, c, r);
        }
      }
    }
  }

  /* ---------------- Rendering: tanks ---------------- */

  const ARMOR_PALETTES = [
    { main: '#a8683d', light: '#e0b07a', dark: '#5f3a1f' },
    { main: '#c08a3d', light: '#ecc27a', dark: '#71501f' },
    { main: '#c9a347', light: '#f0d788', dark: '#756023' },
    { main: '#d6b455', light: '#f7e7a4', dark: '#7d6d27' },
  ];

  function tankPalette(t) {
    let p;
    if (!t.isEnemy) {
      p = { main: '#e6b53e', light: '#ffe28d', dark: '#8a631a', track: '#252b31', tread: '#737a6a' };
    } else {
      const def = t.def;
      let main = def.color;
      let light = def.light;
      let dark = def.dark;
      if (t.type === 'armor') {
        const pal = ARMOR_PALETTES[clamp(t.hp - 1, 0, 3)];
        main = pal.main;
        light = pal.light;
        dark = pal.dark;
      }
      p = { main, light, dark, track: '#252a31', tread: '#5c646e' };
    }
    if (t.hitFlash > 0 || (t.isEnemy && t.bonus && Math.sin(time * 11) > 0.55)) {
      p = { main: '#ffffff', light: '#ffffff', dark: '#e2eaf0', track: '#c5d0d9', tread: '#ffffff' };
    }
    return p;
  }

  function drawTankSprite(t, pal) {
    ctx.save();
    ctx.translate(t.x + 16, t.y + 16);
    ctx.rotate(t.dir * Math.PI / 2);

    // ground shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.32)';
    ctx.fillRect(-14, -12, 28, 26);

    // tracks
    ctx.fillStyle = pal.track;
    ctx.fillRect(-15, -13, 6, 27);
    ctx.fillRect(9, -13, 6, 27);

    // treads (animate when moving)
    const phase = Math.floor(((t.dist || 0) / 3) % 4);
    ctx.fillStyle = pal.tread;
    for (let i = 0; i < 6; i++) {
      const yy = -12 + ((i * 4 + phase) % 24);
      ctx.fillRect(-15, yy, 6, 2);
      ctx.fillRect(9, yy, 6, 2);
    }

    // barrels
    ctx.fillStyle = pal.light;
    ctx.fillRect(-2.5, -22, 5, 18);
    ctx.fillStyle = pal.dark;
    ctx.fillRect(-3.5, -23, 7, 4);
    if (!t.isEnemy && t.power >= 2) {
      ctx.fillStyle = pal.light;
      ctx.fillRect(-6.5, -19, 3, 14);
      ctx.fillStyle = pal.dark;
      ctx.fillRect(-7.5, -20, 5, 3);
    }

    // hull
    ctx.fillStyle = pal.dark;
    ctx.fillRect(-10, -11, 20, 24);
    ctx.fillStyle = pal.main;
    ctx.fillRect(-9, -10, 18, 22);
    ctx.fillStyle = pal.light;
    ctx.fillRect(-9, -10, 18, 2.5);
    ctx.fillRect(-9, -10, 2, 20);
    ctx.fillStyle = pal.dark;
    ctx.fillRect(-7, 8, 14, 3);

    // turret
    ctx.fillStyle = pal.dark;
    ctx.beginPath();
    ctx.arc(0, 1, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.main;
    ctx.beginPath();
    ctx.arc(0, 0, 6.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.light;
    ctx.beginPath();
    ctx.arc(-1.6, -1.6, 2.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = pal.dark;
    ctx.fillRect(-1, -1, 2, 2);

    // armor plating detail
    if (t.isEnemy && t.type === 'armor') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(-7, -6, 3, 8);
      ctx.fillRect(4, -6, 3, 8);
    } else if (t.isEnemy) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      ctx.fillRect(-7, -5, 3, 5);
    }

    ctx.restore();
  }

  function drawShieldRing(t) {
    if (!t.shield || t.shield <= 0) return;
    const cx = t.x + 16;
    const cy = t.y + 16;
    const flashing = t.shield < 1.2 && Math.sin(time * 32) < 0;
    ctx.save();
    const color = t.isEnemy ? 'rgba(190, 236, 255, 0.8)' : 'rgba(110, 228, 255, 0.9)';
    ctx.globalAlpha = flashing ? 0.16 : 0.28;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 23, 0, Math.PI * 2);
    ctx.stroke();

    ctx.globalAlpha = flashing ? 0.2 : 0.85;
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(110, 220, 255, 0.7)';
    ctx.shadowBlur = 8;
    for (let i = 0; i < 2; i++) {
      const start = time * 3.2 + i * Math.PI;
      ctx.beginPath();
      ctx.arc(cx, cy, 23, start, start + 1.4);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSnowflake(cx, cy, radius, color) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3;
      const dx = Math.cos(a) * radius;
      const dy = Math.sin(a) * radius;
      ctx.beginPath();
      ctx.moveTo(cx - dx, cy - dy);
      ctx.lineTo(cx + dx, cy + dy);
      ctx.stroke();
      for (const sign of [1, -1]) {
        const bx = cx + dx * 0.45 * sign;
        const by = cy + dy * 0.45 * sign;
        for (const branch of [-0.7, 0.7]) {
          const ba = a + branch;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(ba) * radius * 0.35, by + Math.sin(ba) * radius * 0.35);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function drawSpawnMarker(e) {
    const cx = e.x + 16;
    const cy = e.y + 16;
    const pulse = 0.55 + 0.45 * Math.sin(time * 22);
    const radius = 15 - 4 * Math.abs(Math.sin(time * 7));

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.translate(cx, cy);
    ctx.rotate(time * 4);
    ctx.strokeStyle = '#9fe8ff';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(130, 225, 255, 0.8)';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const rr = i % 2 === 0 ? radius + 3 : radius - 5;
      const a = (i * Math.PI) / 4;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(130, 225, 255, 0.15)';
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#e8fbff';
    ctx.fillRect(cx - 2, cy - 2, 4, 4);
    ctx.restore();
  }

  /* ---------------- Rendering: power-ups & bullets ---------------- */

  function drawPowerup(p) {
    const bob = Math.sin(time * 3 + p.seed) * 2;
    const cx = p.x + 16;
    const cy = p.y + 16 + bob;
    const blink = p.life < 3 && Math.sin(time * 18) < -0.2 ? 0.25 : 1;

    ctx.save();
    ctx.globalAlpha = blink;
    ctx.translate(cx, cy);
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 12;

    ctx.beginPath();
    ctx.moveTo(-10, -12);
    ctx.lineTo(10, -12);
    ctx.lineTo(12, -10);
    ctx.lineTo(12, 10);
    ctx.lineTo(10, 12);
    ctx.lineTo(-10, 12);
    ctx.lineTo(-12, 10);
    ctx.lineTo(-12, -10);
    ctx.closePath();
    ctx.fillStyle = 'rgba(8, 13, 19, 0.92)';
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = p.color;
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.fillStyle = p.color;
    ctx.strokeStyle = p.color;

    if (p.kind === 'star') {
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? 7.2 : 3.2;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'shield') {
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(7, -5);
      ctx.lineTo(6, 2);
      ctx.quadraticCurveTo(4, 7, 0, 9);
      ctx.quadraticCurveTo(-4, 7, -6, 2);
      ctx.lineTo(-7, -5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#0b1118';
      ctx.fillRect(-1.5, -4, 3, 8);
      ctx.fillRect(-4, -1, 8, 3);
    } else if (p.kind === 'bomb') {
      ctx.beginPath();
      ctx.arc(0, 1, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(3, -4);
      ctx.quadraticCurveTo(7, -9, 4, -10);
      ctx.stroke();
      ctx.fillStyle = '#fff2c9';
      ctx.fillRect(3, -11, 2, 2);
      ctx.fillStyle = '#0b1118';
      ctx.fillRect(-3, -2, 2, 2);
    } else if (p.kind === 'life') {
      ctx.beginPath();
      ctx.moveTo(0, 7);
      ctx.bezierCurveTo(-10, -1, -7, -9, 0, -4);
      ctx.bezierCurveTo(7, -9, 10, -1, 0, 7);
      ctx.closePath();
      ctx.fill();
    } else if (p.kind === 'freeze') {
      ctx.lineWidth = 1.7;
      ctx.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const dx = Math.cos(a) * 7;
        const dy = Math.sin(a) * 7;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(dx, dy);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(dx * 0.7, dy * 0.7, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawBullet(b) {
    const enemy = b.owner === 'enemy';
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate((b.dir * Math.PI) / 2);
    ctx.shadowColor = enemy ? '#ff7050' : '#ffd24a';
    ctx.shadowBlur = 8;
    ctx.fillStyle = enemy ? '#ff8a62' : '#ffe37a';
    ctx.fillRect(-2.5, -5, 5, 10);
    ctx.fillStyle = '#fff8e0';
    ctx.fillRect(-1, -4, 2, 6);
    ctx.restore();
  }

  /* ---------------- Rendering: effects & overlays ---------------- */

  function drawParticlesAndRings() {
    for (const p of particles) {
      const alpha = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      const s = p.size;
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    for (const r of rings) {
      const alpha = clamp(r.life / r.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2 + alpha * 1.5;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '700 10px ' + FONT;
    for (const f of floaters) {
      const alpha = clamp(f.life / f.max, 0, 1);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawWorld() {
    if (floorLayer) ctx.drawImage(floorLayer, 0, 0);

    drawTiles(false);
    if (base.alive) drawBase();
    else drawRubble();

    for (const e of enemies) {
      if (!e.alive) continue;
      if (e.spawning > 0) {
        drawSpawnMarker(e);
      } else {
        drawTankSprite(e, tankPalette(e));
      }
    }

    if (player && player.alive) drawTankSprite(player, tankPalette(player));

    // grass conceals tanks
    drawTiles(true);

    for (const p of powerups) drawPowerup(p);

    if (player && player.alive) drawShieldRing(player);
    for (const e of enemies) {
      if (!e.alive || e.spawning > 0) continue;
      drawShieldRing(e);
      if (frozenTimer > 0) drawSnowflake(e.x + 25, e.y + 5, 4.5, 'rgba(170, 225, 255, 0.95)');
    }

    for (const b of bullets) if (b.alive) drawBullet(b);

    drawParticlesAndRings();
  }

  function drawStageBanner() {
    if (state !== 'playing' || levelIntro <= 0) return;
    const elapsed = INTRO_TIME - levelIntro;
    const alpha = clamp(Math.min(elapsed / 0.25, levelIntro / 0.35), 0, 1);
    if (alpha <= 0) return;

    const w = 264;
    const h = 84;
    const x = (W - w) / 2;
    const y = H / 2 - h / 2;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(4, 8, 12, 0.8)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 203, 69, 0.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);

    ctx.strokeStyle = 'rgba(255, 203, 69, 0.9)';
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 1);
    ctx.lineTo(x + 10, y + 12);
    ctx.moveTo(x + w - 10, y + h + 1);
    ctx.lineTo(x + w - 10, y + h - 12);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffd35e';
    ctx.font = '800 27px ' + FONT;
    ctx.fillText('STAGE ' + fmt(stageIndex + 1, 2), W / 2, y + 32);
    ctx.fillStyle = '#8fa3b4';
    ctx.font = '700 10px ' + FONT;
    ctx.fillText(stageCfg.name, W / 2, y + 60);
    ctx.restore();
  }

  function drawToast() {
    if (state !== 'playing' || toastTimer <= 0 || !toastText) return;
    const elapsed = toastMax - toastTimer;
    const alpha = clamp(Math.min(elapsed / 0.12, toastTimer / 0.3), 0, 1);
    if (alpha <= 0) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '700 10px ' + FONT;
    const textWidth = ctx.measureText(toastText).width;
    const w = textWidth + 30;
    const h = 26;
    const x = (W - w) / 2;
    const y = 16;

    roundRectPath(x, y, w, h, 6);
    ctx.fillStyle = 'rgba(5, 10, 15, 0.88)';
    ctx.fill();
    ctx.strokeStyle = toastColor;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = toastColor;
    ctx.fillText(toastText, W / 2, y + h / 2 + 0.5);
    ctx.restore();
  }

  function drawScreenFx() {
    drawStageBanner();
    drawToast();

    if (state === 'playing' && frozenTimer > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(130, 190, 255, 0.05)';
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.font = '700 9px ' + FONT;
      ctx.fillStyle = 'rgba(170, 220, 255, 0.85)';
      ctx.fillText('FREEZE ' + frozenTimer.toFixed(1) + 's', W - 10, 10);
      ctx.restore();
    }

    if (flash > 0.01) {
      ctx.save();
      ctx.globalAlpha = clamp(flash * 0.55, 0, 0.5);
      ctx.fillStyle = '#fff5dc';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }

    // faint inner border so the arena reads as a screen
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 190, 220, 0.07)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
    ctx.restore();
  }

  function draw() {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#05080b';
    ctx.fillRect(0, 0, W, H);

    const shakeAmount = Math.min(shake, 7);
    const sx = shakeAmount > 0 ? (Math.random() * 2 - 1) * shakeAmount : 0;
    const sy = shakeAmount > 0 ? (Math.random() * 2 - 1) * shakeAmount : 0;

    ctx.save();
    ctx.translate(sx, sy);
    drawWorld();
    ctx.restore();

    drawScreenFx();
  }

  /* ---------------- Main loop ---------------- */

  let lastFrame = performance.now();

  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  /* ---------------- Input wiring ---------------- */

  window.addEventListener('keydown', (e) => {
    const key = e.key;
    if (key === ' ' || key.startsWith('Arrow')) e.preventDefault();
    if (e.repeat) return;

    const dir = KEY_DIRS[key];
    if (dir !== undefined) {
      Input.pressDir(dir);
      Sound.resume();
    }
    if (key === ' ' || key === 'j' || key === 'J') {
      Input.fire = true;
      Sound.resume();
    }

    if (key === 'p' || key === 'P' || key === 'Escape') {
      if (state === 'playing' || state === 'paused') togglePause();
    } else if (key === 'm' || key === 'M') {
      toggleMute();
    } else if (key === 'Enter') {
      if (state === 'menu' || state === 'gameover' || state === 'victory') {
        Sound.resume();
        startGame();
      } else if (state === 'paused') {
        togglePause();
      }
    }
  });

  window.addEventListener('keyup', (e) => {
    const dir = KEY_DIRS[e.key];
    if (dir !== undefined) Input.releaseDir(dir);
    if (e.key === ' ' || e.key === 'j' || e.key === 'J') Input.fire = false;
  });

  window.addEventListener('blur', () => {
    Input.clear();
    if (state === 'playing' && !ending) togglePause();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'playing' && !ending) togglePause();
  });

  window.addEventListener('pagehide', saveBest);

  // Touch / pointer controls
  document.querySelectorAll('[data-dir]').forEach((btn) => {
    const dir = Number(btn.dataset.dir);

    const press = (ev) => {
      ev.preventDefault();
      Sound.resume();
      Input.pressDir(dir);
      btn.classList.add('active');
      if (btn.setPointerCapture && ev.pointerId !== undefined) {
        try { btn.setPointerCapture(ev.pointerId); } catch (err) { /* ignore */ }
      }
    };
    const release = (ev) => {
      if (ev) ev.preventDefault();
      Input.releaseDir(dir);
      btn.classList.remove('active');
    };

    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('lostpointercapture', release);
    btn.addEventListener('contextmenu', (ev) => ev.preventDefault());
  });

  const fireBtn = document.getElementById('fireBtn');
  if (fireBtn) {
    const press = (ev) => {
      ev.preventDefault();
      Sound.resume();
      Input.fire = true;
      fireBtn.classList.add('active');
      if (fireBtn.setPointerCapture && ev.pointerId !== undefined) {
        try { fireBtn.setPointerCapture(ev.pointerId); } catch (err) { /* ignore */ }
      }
    };
    const release = (ev) => {
      if (ev) ev.preventDefault();
      Input.fire = false;
      fireBtn.classList.remove('active');
    };
    fireBtn.addEventListener('pointerdown', press);
    fireBtn.addEventListener('pointerup', release);
    fireBtn.addEventListener('pointercancel', release);
    fireBtn.addEventListener('lostpointercapture', release);
    fireBtn.addEventListener('contextmenu', (ev) => ev.preventDefault());
  }

  document.querySelector('.touch')?.addEventListener('contextmenu', (ev) => ev.preventDefault());

  window.addEventListener('pointerdown', () => Sound.resume(), { once: true });

  /* ---------------- Boot ---------------- */

  Sound.muted = storageGet('tank-battle:muted', '0') === '1';
  updateSoundButton();
  hiScore = parseInt(storageGet('tank-battle:hiscore', '0'), 10) || 0;
  floorLayer = makeFloorLayer();
  state = 'menu';
  buildStage(0);
  updateHUD();
  showOverlay('menuScreen');
  requestAnimationFrame(loop);
})();
