/**
 * Web Audio API synthesizer for Google Pixel Haptic Feedback Audio.
 * Produces short, high-fidelity tactile feedback for task completion,
 * modal transitions, and tab switches without external audio assets.
 */

class SoundSynthesizer {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private unlocked: boolean = false;

  constructor() {
    this.ensureContextUnlocked();
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Seamlessly unlocks AudioContext on the first user interaction
   * to comply with browser autoplay & audio device policies.
   */
  private ensureContextUnlocked(): void {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.unlocked = true;
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('touchstart', unlock);
    };

    window.addEventListener('pointerdown', unlock, { passive: true, once: true });
    window.addEventListener('keydown', unlock, { passive: true, once: true });
    window.addEventListener('touchstart', unlock, { passive: true, once: true });
  }

  private initCtx(): AudioContext | null {
    if (!this.enabled) return null;

    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    return this.ctx;
  }

  /**
   * Google Pixel Haptic Feedback: Tab & View Mode Switch
   * Tactile notch tick (crisp, damped micro-impulse simulating a physical rotary notch/switch).
   * Duration: ~24ms.
   */
  playTabSwitch(): void {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Tactile sub-pulse (simulating physical linear resonant actuator mass movement)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(150, now);
      subOsc.frequency.exponentialRampToValueAtTime(50, now + 0.02);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.07, now + 0.0015);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.022);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.022);

      // 2. High-damping tactile tick (rounded transient via lowpass biquad filter)
      const tickOsc = ctx.createOscillator();
      const tickGain = ctx.createGain();
      const tickFilter = ctx.createBiquadFilter();

      tickFilter.type = 'lowpass';
      tickFilter.frequency.setValueAtTime(1350, now);
      tickFilter.Q.setValueAtTime(1.2, now);

      tickOsc.type = 'triangle';
      tickOsc.frequency.setValueAtTime(380, now);
      tickOsc.frequency.exponentialRampToValueAtTime(160, now + 0.016);

      tickGain.gain.setValueAtTime(0.001, now);
      tickGain.gain.linearRampToValueAtTime(0.065, now + 0.001);
      tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

      tickOsc.connect(tickFilter);
      tickFilter.connect(tickGain);
      tickGain.connect(ctx.destination);

      tickOsc.start(now);
      tickOsc.stop(now + 0.02);
    } catch {
      // Audio policy safe fallback
    }
  }

  /** Alias for playTabSwitch */
  playSwitch(): void {
    this.playTabSwitch();
  }

  /**
   * Google Pixel Haptic Feedback: Task Completion
   * Velvety dual-tone haptic bloom (warm, rewarding checkmark sensation).
   * Duration: ~280ms.
   */
  playTaskComplete(): void {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Tactile LRA base pulse (physical click sensation)
      const subOsc = ctx.createOscillator();
      const subGain = ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(110, now);
      subOsc.frequency.exponentialRampToValueAtTime(45, now + 0.03);

      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.08, now + 0.002);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

      subOsc.connect(subGain);
      subGain.connect(ctx.destination);
      subOsc.start(now);
      subOsc.stop(now + 0.035);

      // 2. Note 1: Warm resonant primary harmonic (G5 ~ 784 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      const filter1 = ctx.createBiquadFilter();

      filter1.type = 'lowpass';
      filter1.frequency.setValueAtTime(1600, now);

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(783.99, now);

      gain1.gain.setValueAtTime(0.001, now);
      gain1.gain.linearRampToValueAtTime(0.11, now + 0.004);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

      osc1.connect(filter1);
      filter1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // 3. Note 2: Velvety upper harmonic bloom (C6 ~ 1046.5 Hz) with 36ms offset
      const t2 = now + 0.036;
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      const filter2 = ctx.createBiquadFilter();

      filter2.type = 'lowpass';
      filter2.frequency.setValueAtTime(1800, t2);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046.5, t2);

      gain2.gain.setValueAtTime(0.001, t2);
      gain2.gain.linearRampToValueAtTime(0.09, t2 + 0.004);
      gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.28);

      osc2.connect(filter2);
      filter2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(t2);
      osc2.stop(t2 + 0.28);
    } catch {
      // Audio policy safe fallback
    }
  }

  /** Alias for playTaskComplete */
  playComplete(): void {
    this.playTaskComplete();
  }

  /** Alias for playTaskComplete */
  playSuccess(): void {
    this.playTaskComplete();
  }

  /**
   * Google Pixel Haptic Feedback: Modal Open
   * Airy frosted glass lift & cushioned tactile pop.
   * Duration: ~75ms.
   */
  playModalOpen(): void {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      // 1. Soft low-mid tactile body
      const bodyOsc = ctx.createOscillator();
      const bodyGain = ctx.createGain();
      bodyOsc.type = 'sine';
      bodyOsc.frequency.setValueAtTime(140, now);
      bodyOsc.frequency.exponentialRampToValueAtTime(65, now + 0.035);

      bodyGain.gain.setValueAtTime(0.001, now);
      bodyGain.gain.linearRampToValueAtTime(0.06, now + 0.002);
      bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      bodyOsc.connect(bodyGain);
      bodyGain.connect(ctx.destination);
      bodyOsc.start(now);
      bodyOsc.stop(now + 0.04);

      // 2. Airy upward frosted glass lift
      const liftOsc = ctx.createOscillator();
      const liftGain = ctx.createGain();
      const liftFilter = ctx.createBiquadFilter();

      liftFilter.type = 'lowpass';
      liftFilter.frequency.setValueAtTime(950, now);

      liftOsc.type = 'sine';
      liftOsc.frequency.setValueAtTime(260, now);
      liftOsc.frequency.exponentialRampToValueAtTime(520, now + 0.055);

      liftGain.gain.setValueAtTime(0.001, now);
      liftGain.gain.linearRampToValueAtTime(0.065, now + 0.008);
      liftGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

      liftOsc.connect(liftFilter);
      liftFilter.connect(liftGain);
      liftGain.connect(ctx.destination);
      liftOsc.start(now);
      liftOsc.stop(now + 0.075);
    } catch {
      // Audio policy safe fallback
    }
  }

  /**
   * Google Pixel Haptic Feedback: Modal Close / Dismiss
   * Soft cushioned release tap.
   * Duration: ~45ms.
   */
  playModalClose(): void {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(750, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(130, now + 0.04);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.05, now + 0.003);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.045);
    } catch {
      // Audio policy safe fallback
    }
  }

  /** Alias for playModalClose */
  playDismiss(): void {
    this.playModalClose();
  }

  /**
   * Google Pixel Haptic Feedback: Micro-Tap
   * Muted, short, tactile tap for standard interactive elements.
   * Duration: ~20ms.
   */
  playTap(): void {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1100, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(210, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.015);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.065, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.02);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.02);
    } catch {
      // Audio policy safe fallback
    }
  }

  /** Alias for playTap */
  playClick(): void {
    this.playTap();
  }

  /**
   * Delete / Cancel action sound: soft low-frequency damped tap.
   */
  playDelete(): void {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(600, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(170, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.035);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.075, now + 0.002);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // Audio policy safe fallback
    }
  }

  /**
   * Soft notification chime for timer completions and rollover alerts.
   */
  playAlert(): void {
    try {
      const ctx = this.initCtx();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1500, now);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.setValueAtTime(880, now + 0.1); // A5

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // Audio policy safe fallback
    }
  }
}

export const sound = new SoundSynthesizer();
