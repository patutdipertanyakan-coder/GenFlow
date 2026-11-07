const SOUND_PREF_STORAGE_KEY = 'gennas_pro_v51_sound_notification';

export function getSoundNotificationPreference(): boolean {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!storage) return true;
    const saved = storage.getItem(SOUND_PREF_STORAGE_KEY);
    if (saved === 'false') return false;
    if (saved === 'true') return true;
  } catch {
    // ignore storage errors
  }
  return true;
}

export function setSoundNotificationPreference(enabled: boolean): void {
  try {
    const storage = typeof window !== 'undefined' ? window.localStorage : (typeof globalThis !== 'undefined' ? globalThis.localStorage : null);
    if (!storage) return;
    storage.setItem(
      SOUND_PREF_STORAGE_KEY,
      enabled ? 'true' : 'false'
    );
  } catch {
    // ignore storage errors
  }
}

/**
 * Memutar bunyi notifikasi perayaan utama (arpeggio fanfare C5-E5-G5-C6) menggunakan Web Audio API
 * ketika naskah selesai diproses.
 */
export async function playGenerationSuccessSound(
  enabled: boolean = true
): Promise<boolean> {
  if (!enabled || typeof window === 'undefined') return false;

  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return false;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const now = ctx.currentTime;

    const playTone = (freq: number, startTime: number, duration: number, peakGain: number, type: OscillatorType = 'sine') => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.exponentialRampToValueAtTime(peakGain, startTime + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration + 0.02);
    };

    // Fanfare 4-nada perayaan: C5 (523.25Hz) -> E5 (659.25Hz) -> G5 (783.99Hz) -> C6 (1046.50Hz)
    playTone(523.25, now, 0.18, 0.09, 'triangle');
    playTone(659.25, now + 0.10, 0.20, 0.10, 'triangle');
    playTone(783.99, now + 0.20, 0.22, 0.11, 'sine');
    playTone(1046.50, now + 0.32, 0.45, 0.14, 'sine');

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 850);

    return true;
  } catch {
    return false;
  }
}

/**
 * Memutar suara letupan kembang api realistis (thump boom + crackle burst + sparkle chime)
 * menggunakan Web Audio API tanpa file audio eksternal.
 */
export function playFireworkBurstSound(enabled: boolean = true): void {
  if (!enabled || typeof window === 'undefined') return;

  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // 1. Low Thump / Explosion Pop (160Hz -> 35Hz)
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.18);

    oscGain.gain.setValueAtTime(0.12, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);

    // 2. White Noise Crackle Burst (gemeretak kembang api)
    const bufferSize = Math.floor(ctx.sampleRate * 0.14);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1400 + Math.random() * 800, now);
    noiseFilter.Q.setValueAtTime(1.8, now);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.07, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    whiteNoise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    whiteNoise.start(now);
    whiteNoise.stop(now + 0.15);

    // 3. High Sparkle Chime (kilauan nada tinggi)
    const sparkleNotes = [1046.5, 1318.51, 1567.98, 2093.0];
    const chosenFreq = sparkleNotes[Math.floor(Math.random() * sparkleNotes.length)];
    const sparkleOsc = ctx.createOscillator();
    const sparkleGain = ctx.createGain();

    sparkleOsc.type = 'sine';
    sparkleOsc.frequency.setValueAtTime(chosenFreq, now + 0.04);

    sparkleGain.gain.setValueAtTime(0.001, now);
    sparkleGain.gain.setValueAtTime(0.06, now + 0.04);
    sparkleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

    sparkleOsc.connect(sparkleGain);
    sparkleGain.connect(ctx.destination);
    sparkleOsc.start(now + 0.04);
    sparkleOsc.stop(now + 0.30);

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 450);
  } catch {
    // Ignore audio failures
  }
}
