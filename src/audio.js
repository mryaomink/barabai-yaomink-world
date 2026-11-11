const PENTA = [0, 3, 5, 7, 10, 12, 15, 17];

export class AmbientAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.started = false;
    this.melodyTimer = 0;
    this.nextNote = 4;
  }

  start() {
    if (this.started || !this.enabled) return;
    const AudioCtx = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioCtx) return;
    try {
      this.ctx = new AudioCtx();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.started = true;

    this.master = ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(ctx.destination);
    this.master.gain.linearRampToValueAtTime(0.5, ctx.currentTime + 3.5);

    this.padGain = ctx.createGain();
    this.padGain.gain.value = 0.14;
    this.padFilter = ctx.createBiquadFilter();
    this.padFilter.type = "lowpass";
    this.padFilter.frequency.value = 900;
    this.padGain.connect(this.padFilter);
    this.padFilter.connect(this.master);

    for (const [freq, detune] of [[110, 0], [164.8, 4], [220, -3], [277.2, 2]]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.detune.value = detune;
      const gain = ctx.createGain();
      gain.gain.value = 0.22;
      osc.connect(gain);
      gain.connect(this.padGain);
      osc.start();
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.08;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      lfo.start();
    }

    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;
    this.noiseSource = ctx.createBufferSource();
    this.noiseSource.buffer = noiseBuffer;
    this.noiseSource.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 420;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.05;
    this.noiseLfo = ctx.createOscillator();
    this.noiseLfo.frequency.value = 0.12;
    const noiseLfoGain = ctx.createGain();
    noiseLfoGain.gain.value = 0.035;
    this.noiseLfo.connect(noiseLfoGain);
    noiseLfoGain.connect(this.noiseGain.gain);
    this.noiseSource.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.master);
    this.noiseSource.start();
    this.noiseLfo.start();
  }

  update(dt) {
    if (!this.started || !this.enabled || !this.ctx) return;
    this.melodyTimer += dt;
    if (this.melodyTimer >= this.nextNote) {
      this.melodyTimer = 0;
      this.nextNote = 2.2 + Math.random() * 3.4;
      this.pluck();
    }
  }

  pluck() {
    const ctx = this.ctx;
    const semitone = PENTA[Math.floor(Math.random() * PENTA.length)];
    const octave = Math.random() > 0.72 ? 12 : 0;
    const freq = 293.66 * Math.pow(2, (semitone + octave) / 12);
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;
    const gain = ctx.createGain();
    const start = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.075, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 2.6);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + 2.8);
  }

  pop() {
    if (!this.started || !this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    const start = ctx.currentTime;
    osc.frequency.setValueAtTime(520, start);
    osc.frequency.exponentialRampToValueAtTime(880, start + 0.09);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(start);
    osc.stop(start + 0.25);
  }

  chime() {
    if (!this.started || !this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    for (const [offset, delay] of [[0, 0], [4, 0.14], [7, 0.28]]) {
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = 440 * Math.pow(2, offset / 12);
      const gain = ctx.createGain();
      const start = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.09, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.4);
      osc.connect(gain);
      gain.connect(this.master);
      osc.start(start);
      osc.stop(start + 1.5);
    }
  }

  setEnabled(value) {
    this.enabled = value;
    if (!value && this.started && this.ctx) {
      this.master.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
    } else if (value && this.started && this.ctx) {
      this.master.gain.linearRampToValueAtTime(0.5, this.ctx.currentTime + 0.6);
    } else if (value) {
      this.start();
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }
}
