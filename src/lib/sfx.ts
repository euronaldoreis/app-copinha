// Efeitos sonoros em estilo 8-bit da festa do campeão, feitos na hora com a
// Web Audio API (sem arquivos de áudio). O navegador só libera o som depois de
// um toque na página; se ainda não liberou, nada toca e nada quebra.

const MUTE_KEY = "copinha:som";

export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "off";
  } catch {
    return false;
  }
}

export function saveMuted(muted: boolean) {
  try {
    localStorage.setItem(MUTE_KEY, muted ? "off" : "on");
  } catch {
    // sem armazenamento (aba anônima): a escolha vale só nesta visita
  }
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
// Cada efeito toca no seu "canal"; ao começar outro, o anterior é cortado.
let channel: GainNode | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
    } catch {
      return null;
    }
    master = ctx.createGain();
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

/** Chame dentro de um clique/toque para o navegador liberar o som. */
export function unlockAudio() {
  audio();
}

export function setMuted(muted: boolean) {
  saveMuted(muted);
  if (ctx && master) master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
}

/** Corta tudo e solta o áudio (ao fechar a festa). */
export function stopAudio() {
  const old = ctx;
  ctx = null;
  master = null;
  channel = null;
  crowdBed = null;
  void old?.close().catch(() => {});
}

interface Voice {
  c: AudioContext;
  out: GainNode;
  /** Instante (do relógio do áudio) em que o efeito começa. */
  t0: number;
}

function start(): Voice | null {
  const c = audio();
  if (!c || !master) return null;
  master.gain.setValueAtTime(isMuted() ? 0 : 1, c.currentTime);
  if (channel) {
    const old = channel;
    old.gain.setTargetAtTime(0, c.currentTime, 0.03);
    setTimeout(() => old.disconnect(), 400);
  }
  channel = c.createGain();
  channel.connect(master);
  return { c, out: channel, t0: c.currentTime + 0.02 };
}

function tone(
  v: Voice,
  at: number,
  dur: number,
  freq: number,
  {
    type = "square",
    gain = 0.07,
    slideTo,
  }: { type?: OscillatorType; gain?: number; slideTo?: number } = {},
) {
  const osc = v.c.createOscillator();
  const g = v.c.createGain();
  const t = v.t0 + at;
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.linearRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.setValueAtTime(gain, t + dur * 0.7);
  g.gain.linearRampToValueAtTime(0, t + dur);
  osc.connect(g).connect(v.out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

let noiseBuffer: AudioBuffer | null = null;

function noise(
  v: Voice,
  at: number,
  dur: number,
  { gain = 0.08, cutoff = 4000 }: { gain?: number; cutoff?: number } = {},
) {
  if (!noiseBuffer || noiseBuffer.sampleRate !== v.c.sampleRate) {
    noiseBuffer = v.c.createBuffer(1, v.c.sampleRate, v.c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const src = v.c.createBufferSource();
  const filter = v.c.createBiquadFilter();
  const g = v.c.createGain();
  const t = v.t0 + at;
  src.buffer = noiseBuffer;
  src.loop = true;
  filter.type = "lowpass";
  filter.frequency.value = cutoff;
  g.gain.setValueAtTime(gain, t);
  g.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(filter).connect(g).connect(v.out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

// Notas usadas nas musiquinhas (Hz).
const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;
const E6 = 1318.5;
const G6 = 1568;

export const sfx = {
  /** Caminhão chegando: motor grave e o "tsss" do freio no fim. */
  truck() {
    const v = start();
    if (!v) return;
    tone(v, 0, 1.3, 62, { type: "sawtooth", gain: 0.09, slideTo: 44 });
    tone(v, 0, 1.3, 93, { type: "square", gain: 0.03, slideTo: 66 });
    noise(v, 1.25, 0.3, { gain: 0.06, cutoff: 6000 });
  },
  /** Alguém pula do caminhão e, ao chegar no degrau, toca o acorde dele. */
  podium(place: 2 | 3, arriveAt: number) {
    const v = start();
    if (!v) return;
    tone(v, 0, 0.12, 300, { slideTo: 620 });
    const notes = place === 3 ? [C5, E5] : [C5, E5, G5];
    notes.forEach((f, i) => tone(v, arriveAt + i * 0.11, 0.16, f));
  },
  /** Rufar de tambores, crescendo. */
  drumroll(dur: number) {
    const v = start();
    if (!v) return;
    for (let t = 0; t < dur; t += 0.06) {
      noise(v, t, 0.05, { gain: 0.03 + 0.07 * (t / dur), cutoff: 1800 });
    }
  },
  /** O campeão aparece: prato e uma subida. */
  champion() {
    const v = start();
    if (!v) return;
    noise(v, 0, 0.7, { gain: 0.09, cutoff: 9000 });
    tone(v, 0, 0.5, 220, { type: "triangle", gain: 0.1, slideTo: 880 });
  },
  /** Fanfarra da festa, com a torcida ao fundo. */
  fanfare() {
    const v = start();
    if (!v) return;
    const tune: [number, number, number][] = [
      [0, 0.12, C5],
      [0.14, 0.12, E5],
      [0.28, 0.12, G5],
      [0.42, 0.34, C6],
      [0.84, 0.12, G5],
      [0.98, 0.12, C6],
      [1.12, 0.12, E6],
      [1.26, 0.7, G6],
    ];
    for (const [at, dur, f] of tune) {
      tone(v, at, dur, f, { gain: 0.07 });
      tone(v, at, dur, f / 2, { type: "triangle", gain: 0.08 });
    }
    noise(v, 0, 3.2, { gain: 0.035, cutoff: 1200 });
  },
};

// ---------------------------------------------------------------------------
// Sons do estádio (sorteio e festa em 3D): tocam por cima uns dos outros, sem
// cortar o efeito anterior, e a torcida fica de fundo o tempo todo.

/** Voz que toca junto com as outras. */
function layer(): Voice | null {
  const c = audio();
  if (!c || !master) return null;
  master.gain.setValueAtTime(isMuted() ? 0 : 1, c.currentTime);
  const out = c.createGain();
  out.connect(master);
  setTimeout(() => out.disconnect(), 6000);
  return { c, out, t0: c.currentTime + 0.02 };
}

/** Ruído com filtro passa-faixa e envelope (subida, sustentação, descida). */
function band(
  v: Voice,
  at: number,
  { attack, hold, release, gain, freq, q = 0.8 }: { attack: number; hold: number; release: number; gain: number; freq: number; q?: number },
) {
  noise(v, 0, 0); // garante o buffer de ruído
  const src = v.c.createBufferSource();
  const filter = v.c.createBiquadFilter();
  const g = v.c.createGain();
  const t = v.t0 + at;
  src.buffer = noiseBuffer;
  src.loop = true;
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + attack);
  g.gain.setValueAtTime(gain, t + attack + hold);
  g.gain.linearRampToValueAtTime(0, t + attack + hold + release);
  src.connect(filter).connect(g).connect(v.out);
  src.start(t);
  src.stop(t + attack + hold + release + 0.05);
}

let crowdBed: { gain: GainNode; stop: () => void } | null = null;
let lastLaunch = 0;
let lastBang = 0;

export const stadiumSfx = {
  /** Murmúrio da torcida de fundo, que acompanha o nível de empolgação. */
  crowdStart() {
    const c = audio();
    if (!c || !master || crowdBed) return;
    master.gain.setValueAtTime(isMuted() ? 0 : 1, c.currentTime);
    const v = { c, out: master, t0: c.currentTime };
    noise(v, 0, 0);
    const gain = c.createGain();
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.03, c.currentTime + 1.5);
    gain.connect(master);
    const sources: AudioBufferSourceNode[] = [];
    // duas faixas de ruído: o "burburinho" das vozes e o ronco grave do estádio
    for (const [freq, q, g] of [
      [900, 0.7, 1],
      [260, 0.9, 0.8],
    ] as const) {
      const src = c.createBufferSource();
      const filter = c.createBiquadFilter();
      const level = c.createGain();
      src.buffer = noiseBuffer;
      src.loop = true;
      filter.type = "bandpass";
      filter.frequency.value = freq;
      filter.Q.value = q;
      level.gain.value = g;
      src.connect(filter).connect(level).connect(gain);
      src.start();
      sources.push(src);
    }
    crowdBed = {
      gain,
      stop: () => {
        const t = c.currentTime;
        gain.gain.setTargetAtTime(0, t, 0.2);
        sources.forEach((s) => s.stop(t + 1));
      },
    };
  },
  /** 0 = torcida tranquila, 1 = estádio pulando. */
  crowdLevel(level: number) {
    if (!ctx || !crowdBed) return;
    crowdBed.gain.gain.setTargetAtTime(0.025 + 0.09 * Math.min(1, Math.max(0, level)), ctx.currentTime, 0.25);
  },
  crowdStop() {
    crowdBed?.stop();
    crowdBed = null;
  },
  /** Grito da torcida: sobe rápido e vai baixando, com o "uhhh" das vozes. */
  roar(strength = 1) {
    const v = layer();
    if (!v) return;
    band(v, 0, { attack: 0.25, hold: 0.5 * strength, release: 1.6, gain: 0.11 * strength, freq: 1100, q: 0.6 });
    band(v, 0, { attack: 0.3, hold: 0.4 * strength, release: 1.4, gain: 0.08 * strength, freq: 420, q: 0.9 });
    for (const f of [196, 233, 262]) tone(v, 0.05, 0.9 + 0.4 * strength, f, { type: "sawtooth", gain: 0.012 * strength, slideTo: f * 0.85 });
  },
  /** Buzina do caminhão: "fom-fom" (ou um toque curto). */
  horn(double = true) {
    const v = layer();
    if (!v) return;
    const beeps = double ? [0, 0.42] : [0];
    for (const at of beeps) {
      const dur = double ? 0.32 : 0.18;
      tone(v, at, dur, 311, { type: "square", gain: double ? 0.05 : 0.03 });
      tone(v, at, dur, 370, { type: "square", gain: double ? 0.04 : 0.025 });
    }
  },
  /** Rojão subindo (assobio). */
  launch() {
    const c = audio();
    if (!c || c.currentTime - lastLaunch < 0.18) return;
    lastLaunch = c.currentTime;
    const v = layer();
    if (!v) return;
    tone(v, 0, 1, 900, { type: "triangle", gain: 0.018, slideTo: 2300 });
  },
  /** Estouro do rojão. */
  bang() {
    const c = audio();
    if (!c || c.currentTime - lastBang < 0.12) return;
    lastBang = c.currentTime;
    const v = layer();
    if (!v) return;
    noise(v, 0, 0.55, { gain: 0.13, cutoff: 2600 });
    tone(v, 0, 0.35, 110, { type: "sine", gain: 0.14, slideTo: 40 });
    // estalinhos depois do estouro
    for (let i = 0; i < 5; i++) noise(v, 0.25 + Math.random() * 0.5, 0.05, { gain: 0.04, cutoff: 7000 });
  },
};
