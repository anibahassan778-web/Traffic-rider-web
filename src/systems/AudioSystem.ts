type SfxKey = 'engine' | 'crash' | 'whoosh' | 'brake' | 'click';

const SFX_PATHS: Record<SfxKey, string> = {
  engine: 'sfx/motorcycle_engine.mp3',
  crash: 'sfx/crash_impact.mp3',
  whoosh: 'sfx/traffic_whoosh.mp3',
  brake: 'sfx/tire_brake.mp3',
  click: 'sfx/ui_click.mp3',
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Decoded real internet-sourced SFX buffers
  private buffers: Partial<Record<SfxKey, AudioBuffer>> = {};
  private samplesLoading = false;

  // Sample-based continuous loops
  private engineSampleSrc: AudioBufferSourceNode | null = null;
  private engineSampleFilter: BiquadFilterNode | null = null;
  private engineSampleGain: GainNode | null = null;

  private brakeSampleSrc: AudioBufferSourceNode | null = null;
  private brakeSampleGain: GainNode | null = null;

  // Procedural fallback & subtle harmonic layer
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;
  private brakeGain: GainNode | null = null;

  private volume = 0.75;
  private muted = false;
  private engineActive = false;
  private disposed = false;

  unlock(): void {
    if (typeof window === 'undefined' || this.disposed) return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : this.volume;
      this.masterGain.connect(this.ctx.destination);
      this.setupContinuousVoices();
      void this.preloadSamples();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
  }

  private async preloadSamples(): Promise<void> {
    if (this.samplesLoading || !this.ctx || this.disposed) return;
    this.samplesLoading = true;

    const ctx = this.ctx;
    const entries = Object.entries(SFX_PATHS) as [SfxKey, string][];

    await Promise.all(
      entries.map(async ([key, url]) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const arr = await res.arrayBuffer();
          if (this.disposed || this.ctx !== ctx) return;
          const decoded = await ctx.decodeAudioData(arr);
          if (this.disposed || this.ctx !== ctx) return;
          this.buffers[key] = decoded;

          if (key === 'engine') {
            this.startEngineSampleLoop(decoded);
          } else if (key === 'brake') {
            this.startBrakeSampleLoop(decoded);
          }
        } catch {
          // Graceful procedural Web Audio fallback remains active if offline/blocked
        }
      })
    );
  }

  private startEngineSampleLoop(buffer: AudioBuffer): void {
    if (!this.ctx || !this.masterGain || this.disposed || this.engineSampleSrc) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    // Trim quiet lead-in/tail inside the sample for seamless continuous revving
    if (buffer.duration > 1.2) {
      src.loopStart = 0.2;
      src.loopEnd = buffer.duration - 0.2;
    }

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 950;
    filter.Q.value = 1.1;

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    src.start(0, buffer.duration > 1.2 ? 0.2 : 0);

    this.engineSampleSrc = src;
    this.engineSampleFilter = filter;
    this.engineSampleGain = gain;
  }

  private startBrakeSampleLoop(buffer: AudioBuffer): void {
    if (!this.ctx || !this.masterGain || this.disposed || this.brakeSampleSrc) return;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    if (buffer.duration > 0.6) {
      src.loopStart = 0.08;
      src.loopEnd = buffer.duration - 0.08;
    }

    const gain = this.ctx.createGain();
    gain.gain.value = 0;

    src.connect(gain);
    gain.connect(this.masterGain);
    src.start(0);

    this.brakeSampleSrc = src;
    this.brakeSampleGain = gain;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const len = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private setupContinuousVoices(): void {
    if (!this.ctx || !this.masterGain) return;

    // Inline-4 motorcycle harmonic bed (blends with real engine MP3 & covers pre-decode)
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc1.type = 'sawtooth';
    this.engineOsc1.frequency.value = 65;

    this.engineOsc2 = this.ctx.createOscillator();
    this.engineOsc2.type = 'triangle';
    this.engineOsc2.frequency.value = 130;

    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 420;
    this.engineFilter.Q.value = 2.2;

    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // Filtered noise for wind & fallback brake pad hiss
    const noiseBuffer = this.createNoiseBuffer(this.ctx);

    const windSrc = this.ctx.createBufferSource();
    windSrc.buffer = noiseBuffer;
    windSrc.loop = true;
    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 380;
    this.windFilter.Q.value = 0.7;
    this.windGain = this.ctx.createGain();
    this.windGain.gain.value = 0;
    windSrc.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);
    windSrc.start();

    const brakeSrc = this.ctx.createBufferSource();
    brakeSrc.buffer = noiseBuffer;
    brakeSrc.loop = true;
    const brakeFilter = this.ctx.createBiquadFilter();
    brakeFilter.type = 'highpass';
    brakeFilter.frequency.value = 1900;
    this.brakeGain = this.ctx.createGain();
    this.brakeGain.gain.value = 0;
    brakeSrc.connect(brakeFilter);
    brakeFilter.connect(this.brakeGain);
    this.brakeGain.connect(this.masterGain);
    brakeSrc.start();
  }

  private playBufferOneShot(key: SfxKey, gainVal: number, rate = 1.0, maxDurationSec?: number): boolean {
    const buffer = this.buffers[key];
    if (!buffer || !this.ctx || !this.masterGain || this.muted) return false;

    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;

    const gain = this.ctx.createGain();
    gain.gain.value = gainVal;

    src.connect(gain);
    gain.connect(this.masterGain);

    const t = this.ctx.currentTime;
    src.start(t);
    if (maxDurationSec !== undefined && buffer.duration > maxDurationSec) {
      gain.gain.setValueAtTime(gainVal, t + Math.max(0.02, maxDurationSec - 0.08));
      gain.gain.exponentialRampToValueAtTime(0.001, t + maxDurationSec);
      src.stop(t + maxDurationSec + 0.02);
    }
    return true;
  }

  setVolumeAndMute(volume: number, muted: boolean): void {
    this.volume = Math.max(0, Math.min(1, volume));
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.ctx.currentTime, 0.03);
    }
  }

  setEngineActive(active: boolean): void {
    this.engineActive = active;
    if (!active && this.ctx) {
      const t = this.ctx.currentTime;
      this.engineGain?.gain.setTargetAtTime(0, t, 0.04);
      this.engineSampleGain?.gain.setTargetAtTime(0, t, 0.04);
      this.windGain?.gain.setTargetAtTime(0, t, 0.04);
      this.brakeGain?.gain.setTargetAtTime(0, t, 0.04);
      this.brakeSampleGain?.gain.setTargetAtTime(0, t, 0.04);
    }
  }

  updateRidingAudio(rpmRatio: number, speedMs: number, throttle: boolean, braking: boolean): void {
    if (!this.ctx || !this.engineActive) return;

    const t = this.ctx.currentTime;
    const speedNorm = Math.min(1, speedMs / 82);

    // Real downloaded engine MP3 pitched dynamically by RPM
    const hasEngineSample = Boolean(this.engineSampleSrc && this.engineSampleGain && this.engineSampleFilter);
    if (hasEngineSample && this.engineSampleSrc && this.engineSampleGain && this.engineSampleFilter) {
      const targetRate = 0.72 + rpmRatio * 0.92;
      this.engineSampleSrc.playbackRate.setTargetAtTime(targetRate, t, 0.04);
      this.engineSampleFilter.frequency.setTargetAtTime(
        throttle ? 1100 + rpmRatio * 2400 : 650 + rpmRatio * 900,
        t,
        0.04
      );
      this.engineSampleGain.gain.setTargetAtTime(throttle ? 0.34 + rpmRatio * 0.14 : 0.17, t, 0.04);
    }

    // Inline-4 harmonic layer (full gain before MP3 finishes decoding, subtle low-end reinforcement after)
    if (this.engineOsc1 && this.engineOsc2 && this.engineFilter && this.engineGain) {
      const baseFreq = 58 + rpmRatio * 205;
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.03);
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 2.01, t, 0.03);
      this.engineFilter.frequency.setTargetAtTime(
        throttle ? 480 + rpmRatio * 1450 : 280 + rpmRatio * 650,
        t,
        0.04
      );
      const synthScale = hasEngineSample ? 0.25 : 1.0;
      this.engineGain.gain.setTargetAtTime(
        (throttle ? 0.14 + rpmRatio * 0.08 : 0.06) * synthScale,
        t,
        0.04
      );
    }

    // Wind rush scales quadratically with speed
    if (this.windFilter && this.windGain) {
      this.windFilter.frequency.setTargetAtTime(280 + speedNorm * 1100, t, 0.05);
      this.windGain.gain.setTargetAtTime(speedNorm * speedNorm * 0.14, t, 0.05);
    }

    // Real tire/brake sample or fallback noise
    const brakingActive = braking && speedMs > 5;
    if (this.brakeSampleGain) {
      this.brakeSampleGain.gain.setTargetAtTime(
        brakingActive ? Math.min(0.24, speedNorm * 0.26) : 0,
        t,
        0.04
      );
      this.brakeGain?.gain.setTargetAtTime(0, t, 0.03);
    } else if (this.brakeGain) {
      this.brakeGain.gain.setTargetAtTime(
        brakingActive ? Math.min(0.09, speedNorm * 0.1) : 0,
        t,
        0.04
      );
    }
  }

  playNearMiss(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;

    // Play real Doppler vehicle pass whoosh sample
    const playedSample = this.playBufferOneShot('whoosh', 0.45, 0.94 + Math.random() * 0.12, 0.65);

    if (!playedSample) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(540, t);
      osc.frequency.exponentialRampToValueAtTime(180, t + 0.14);
      gain.gain.setValueAtTime(0.16, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.17);
    }

    // Subtle crisp combo confirmation chime
    const chime = this.ctx.createOscillator();
    const cGain = this.ctx.createGain();
    chime.type = 'triangle';
    chime.frequency.setValueAtTime(880, t + 0.04);
    chime.frequency.setValueAtTime(1174, t + 0.09);
    cGain.gain.setValueAtTime(0.07, t + 0.04);
    cGain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    chime.connect(cGain);
    cGain.connect(this.masterGain);
    chime.start(t + 0.04);
    chime.stop(t + 0.24);
  }

  playBarrierScrape(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    this.playBufferOneShot('brake', 0.28, 1.15, 0.22);
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.14);
    gain.gain.setValueAtTime(0.14, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.17);
  }

  playCrash(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const playedSample = this.playBufferOneShot('crash', 0.72, 0.96 + Math.random() * 0.08, 1.4);
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(32, t + 0.45);
    gain.gain.setValueAtTime(playedSample ? 0.18 : 0.36, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.48);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.5);
  }

  playUiClick(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    if (this.playBufferOneShot('click', 0.35, 1.0, 0.2)) return;

    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(620, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.05);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.065);
  }

  playHorn(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    for (const freq of [415, 523.25]) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1450;

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.11, t + 0.02);
      gain.gain.setValueAtTime(0.1, t + 0.16);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.24);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.26);
    }
  }

  playGearShift(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(145, t);
    osc.frequency.exponentialRampToValueAtTime(68, t + 0.07);
    gain.gain.setValueAtTime(0.08, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + 0.085);
  }

  playVictory(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      const start = t + i * 0.09;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.14, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }

  playEngineRevPreview(): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const t = this.ctx.currentTime;

    if (this.buffers.engine) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.engine;
      src.playbackRate.setValueAtTime(0.85, t);
      src.playbackRate.linearRampToValueAtTime(1.68, t + 0.32);
      src.playbackRate.exponentialRampToValueAtTime(0.9, t + 0.92);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.01, t);
      gain.gain.linearRampToValueAtTime(0.45, t + 0.08);
      gain.gain.setValueAtTime(0.42, t + 0.45);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.95);

      src.connect(gain);
      gain.connect(this.masterGain);
      src.start(t, this.buffers.engine.duration > 1.2 ? 0.25 : 0);
      src.stop(t + 0.98);
      return;
    }

    // Inline-4 exhaust rev fallback if MP3 buffer hasn't decoded yet
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(72, t);
    osc1.frequency.linearRampToValueAtTime(245, t + 0.34);
    osc1.frequency.exponentialRampToValueAtTime(78, t + 0.9);

    osc2.frequency.setValueAtTime(144, t);
    osc2.frequency.linearRampToValueAtTime(490, t + 0.34);
    osc2.frequency.exponentialRampToValueAtTime(156, t + 0.9);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, t);
    filter.frequency.linearRampToValueAtTime(2100, t + 0.34);
    filter.frequency.exponentialRampToValueAtTime(480, t + 0.9);

    gain.gain.setValueAtTime(0.01, t);
    gain.gain.linearRampToValueAtTime(0.24, t + 0.07);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.92);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.95);
    osc2.stop(t + 0.95);
  }

  dispose(): void {
    this.disposed = true;
    this.setEngineActive(false);
    try {
      this.engineSampleSrc?.stop();
    } catch {
      // ignore if already stopped
    }
    try {
      this.brakeSampleSrc?.stop();
    } catch {
      // ignore if already stopped
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}
