import { DEFAULT_TAP_SETTINGS, type FrameSizeMs, type TapConfig, type TapId } from "@/config/taps";
import { buildTapSocketUrl } from "@/lib/audio/connection-url";
import { packFrame, unpackFrame } from "@/lib/audio/frame-codec";
import type { BufferMode, EngineStatus, TapMetrics, TapRuntimeSettings } from "@/lib/audio/types";

type BrowserWindow = Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };

type TapRuntime = TapConfig & {
  enabled: boolean;
  connected: boolean;
  ws: WebSocket | null;
  player: AudioWorkletNode | null;
  gain: GainNode | null;
  panner: StereoPannerNode | null;
  seq: number;
  returnLevel: number;
  feedback: number;
  pan: number;
  feedbackFrame: Float32Array | null;
  rttEwma: number | null;
  jitter: number;
  lastTransit: number | null;
  sent: number;
  received: number;
  lastSeqSeen: number;
  lost: number;
};

type AudioEngineOptions = {
  taps: TapConfig[];
  onStatus: (status: EngineStatus) => void;
  onTapEnabledChange: (id: TapId, enabled: boolean) => void;
  onTapMetrics: (id: TapId, metrics: TapMetrics) => void;
  onVu: (level: number) => void;
};

export type StartOptions = {
  frameMs: FrameSizeMs;
  wetDry: number;
  masterWet: number;
  inputLevel: number;
  bufferMode: BufferMode;
  jitterBufferMs: number;
  synthLevel: number;
};

export class AudioEngine {
  private readonly taps = new Map<TapId, TapRuntime>();
  private readonly onStatus: AudioEngineOptions["onStatus"];
  private readonly onTapEnabledChange: AudioEngineOptions["onTapEnabledChange"];
  private readonly onTapMetrics: AudioEngineOptions["onTapMetrics"];
  private readonly onVu: AudioEngineOptions["onVu"];

  private ctx: AudioContext | null = null;
  private micNode: MediaStreamAudioSourceNode | null = null;
  private micGain: GainNode | null = null;
  private micStream: MediaStream | null = null;
  private captureNode: AudioWorkletNode | null = null;
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private masterGain: GainNode | null = null;
  private sourceBus: GainNode | null = null;
  private synthGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private metricsTimer: number | null = null;
  private vuFrame: number | null = null;
  private vuPeak = 0;
  private frameMs: FrameSizeMs = 20;
  private frameLength = 960;
  private bufferMode: BufferMode = "buffered";
  private jitterBufferMs = 60;
  private synthWave: OscillatorType = "triangle";
  private synthLevel = 0.7;
  private readonly activeVoices = new Map<number, { osc: OscillatorNode; gain: GainNode }>();

  running = false;
  micEnabled = false;

  constructor(options: AudioEngineOptions) {
    this.onStatus = options.onStatus;
    this.onTapEnabledChange = options.onTapEnabledChange;
    this.onTapMetrics = options.onTapMetrics;
    this.onVu = options.onVu;

    for (const tap of options.taps) {
      this.taps.set(tap.id, {
        ...tap,
        enabled: false,
        connected: false,
        ws: null,
        player: null,
        gain: null,
        panner: null,
        seq: 0,
        returnLevel: DEFAULT_TAP_SETTINGS.returnLevel,
        feedback: DEFAULT_TAP_SETTINGS.feedback,
        pan: DEFAULT_TAP_SETTINGS.pan,
        feedbackFrame: null,
        rttEwma: null,
        jitter: 0,
        lastTransit: null,
        sent: 0,
        received: 0,
        lastSeqSeen: -1,
        lost: 0,
      });
    }
  }

  async start(options: StartOptions) {
    if (this.running) {
      await this.resume();
      return;
    }

    const AudioContextCtor =
      window.AudioContext ?? (window as BrowserWindow).webkitAudioContext;

    if (!AudioContextCtor) {
      this.setStatus(false, false, "This browser does not support Web Audio.");
      return;
    }

    this.ctx = new AudioContextCtor();
    this.frameMs = options.frameMs;
    this.bufferMode = options.bufferMode;
    this.jitterBufferMs = options.jitterBufferMs;
    this.synthLevel = options.synthLevel;
    this.frameLength = Math.round(this.ctx.sampleRate * this.frameMs / 1000);

    await Promise.all([
      this.ctx.audioWorklet.addModule("/worklets/capture-processor.js"),
      this.ctx.audioWorklet.addModule("/worklets/player-processor.js"),
    ]);

    this.dryGain = this.ctx.createGain();
    this.wetGain = this.ctx.createGain();
    this.masterGain = this.ctx.createGain();
    this.sourceBus = this.ctx.createGain();
    this.synthGain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.captureNode = new AudioWorkletNode(this.ctx, "sharkbite-capture");

    this.sourceBus.gain.value = 1;
    this.synthGain.gain.value = this.synthLevel;
    this.analyser.fftSize = 512;
    this.captureNode.port.postMessage({ frameLength: this.frameLength });
    this.captureNode.port.onmessage = (event: MessageEvent<Float32Array>) => {
      this.sendFrameToEnabledTaps(event.data);
    };

    this.sourceBus.connect(this.dryGain);
    this.sourceBus.connect(this.analyser);
    this.sourceBus.connect(this.captureNode);
    this.dryGain.connect(this.masterGain);
    this.wetGain.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    this.synthGain.connect(this.sourceBus);

    const captureSink = this.ctx.createGain();
    captureSink.gain.value = 0;
    this.captureNode.connect(captureSink);
    captureSink.connect(this.ctx.destination);

    this.micGain = this.ctx.createGain();
    this.micGain.gain.value = options.inputLevel;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          autoGainControl: false,
          echoCancellation: false,
          noiseSuppression: false,
        },
      });
      this.micNode = this.ctx.createMediaStreamSource(this.micStream);
      this.micNode.connect(this.micGain);
      this.micGain.connect(this.sourceBus);
      this.micEnabled = true;
      this.setStatus(true, true, "Live with mic and synth.");
    } catch {
      this.micEnabled = false;
      this.setStatus(true, false, "Live in synth-only mode. Microphone was not granted.");
    }

    this.running = true;
    this.setWetDry(options.wetDry, options.masterWet);
    this.applyPrebuffer();
    this.startVuLoop();
    this.startMetricsLoop();

    for (const tap of this.taps.values()) {
      if (tap.defaultEnabled) this.setTapEnabled(tap.id, true);
    }
  }

  async resume() {
    if (this.ctx?.state === "suspended") {
      await this.ctx.resume();
    }
  }

  panic() {
    if (this.masterGain) this.masterGain.gain.value = 0;
    for (const voice of this.activeVoices.values()) {
      try {
        voice.osc.stop();
      } catch {
        // Voice may already be stopped.
      }
    }
    this.activeVoices.clear();
    this.setStatus(this.running, this.micEnabled, "Muted. Reload the page to rebuild audio.");
  }

  destroy() {
    for (const tap of this.taps.values()) {
      this.disconnectTap(tap.id);
    }

    if (this.metricsTimer !== null) window.clearInterval(this.metricsTimer);
    if (this.vuFrame !== null) window.cancelAnimationFrame(this.vuFrame);

    this.micStream?.getTracks().forEach((track) => track.stop());
    void this.ctx?.close();
  }

  setFrameMs(frameMs: FrameSizeMs) {
    this.frameMs = frameMs;
    if (!this.ctx) return;
    this.frameLength = Math.round(this.ctx.sampleRate * frameMs / 1000);
    this.captureNode?.port.postMessage({ frameLength: this.frameLength });
  }

  setWetDry(wetDry: number, masterWet: number) {
    if (this.dryGain) this.dryGain.gain.value = 1 - wetDry;
    if (this.wetGain) this.wetGain.gain.value = wetDry * masterWet;
  }

  setInputLevel(level: number) {
    if (this.micGain) this.micGain.gain.value = level;
  }

  setBuffering(bufferMode: BufferMode, jitterBufferMs: number) {
    this.bufferMode = bufferMode;
    this.jitterBufferMs = jitterBufferMs;
    this.applyPrebuffer();
  }

  setSynth(wave: OscillatorType, level: number) {
    this.synthWave = wave;
    this.synthLevel = level;
    if (this.synthGain) this.synthGain.gain.value = level;
  }

  setTapSettings(id: TapId, settings: TapRuntimeSettings) {
    const tap = this.taps.get(id);
    if (!tap) return;

    tap.returnLevel = settings.returnLevel;
    tap.feedback = settings.feedback;
    tap.pan = settings.pan;

    if (tap.gain) tap.gain.gain.value = settings.returnLevel;
    if (tap.panner) tap.panner.pan.value = settings.pan;
  }

  setTapEnabled(id: TapId, enabled: boolean) {
    const tap = this.taps.get(id);
    if (!tap || tap.enabled === enabled) return;

    tap.enabled = enabled;
    this.onTapEnabledChange(id, enabled);

    if (enabled) {
      this.connectTap(id);
    } else {
      this.disconnectTap(id);
    }
  }

  async noteOn(midi: number) {
    if (!this.running) return;
    await this.resume();
    if (!this.ctx || !this.synthGain || this.activeVoices.has(midi)) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    const peak = Math.max(0.0001, this.synthLevel);

    osc.type = this.synthWave;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(peak * 0.7, now + 0.18);
    osc.connect(gain);
    gain.connect(this.synthGain);
    osc.start();
    this.activeVoices.set(midi, { osc, gain });
  }

  noteOff(midi: number) {
    const voice = this.activeVoices.get(midi);
    if (!voice || !this.ctx) return;

    this.activeVoices.delete(midi);
    const now = this.ctx.currentTime;

    try {
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(Math.max(0.0001, voice.gain.gain.value), now);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
      voice.osc.stop(now + 0.15);
    } catch {
      try {
        voice.osc.stop();
      } catch {
        // Already stopped.
      }
    }
  }

  private connectTap(id: TapId) {
    const tap = this.taps.get(id);
    if (!tap) return;

    if (!this.ctx || !this.wetGain) {
      tap.enabled = false;
      this.onTapEnabledChange(id, false);
      this.setStatus(this.running, this.micEnabled, "Enable audio before enabling a tap.");
      return;
    }

    const url = buildTapSocketUrl(tap.ip);
    if (!url) {
      tap.enabled = false;
      this.onTapEnabledChange(id, false);
      this.setStatus(
        this.running,
        this.micEnabled,
        "HTTPS deployments need NEXT_PUBLIC_SHARKBITE_RELAY_ORIGIN pointing to a WSS relay.",
      );
      return;
    }

    tap.player = new AudioWorkletNode(this.ctx, "sharkbite-player");
    tap.gain = this.ctx.createGain();
    tap.panner = this.ctx.createStereoPanner();
    tap.gain.gain.value = tap.returnLevel;
    tap.panner.pan.value = tap.pan;
    tap.player.connect(tap.gain);
    tap.gain.connect(tap.panner);
    tap.panner.connect(this.wetGain);
    this.applyPrebuffer();

    const socket = new WebSocket(url);
    socket.binaryType = "arraybuffer";
    tap.ws = socket;

    socket.onopen = () => {
      tap.connected = true;
      this.emitTapMetrics(tap);
    };
    socket.onclose = () => {
      tap.connected = false;
      this.emitTapMetrics(tap);
    };
    socket.onerror = () => {
      tap.connected = false;
      this.emitTapMetrics(tap);
    };
    socket.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        this.handleEcho(id, event.data);
      }
    };
  }

  private disconnectTap(id: TapId) {
    const tap = this.taps.get(id);
    if (!tap) return;

    if (tap.ws) {
      try {
        tap.ws.close();
      } catch {
        // Closing a dead socket is harmless.
      }
    }

    tap.ws = null;
    tap.connected = false;

    try {
      tap.player?.port.postMessage({ cmd: "flush" });
      tap.player?.disconnect();
      tap.gain?.disconnect();
      tap.panner?.disconnect();
    } catch {
      // Audio nodes may already be disconnected.
    }

    tap.player = null;
    tap.gain = null;
    tap.panner = null;
    tap.feedbackFrame = null;
    this.emitTapMetrics(tap);
  }

  private sendFrameToEnabledTaps(frame: Float32Array) {
    for (const tap of this.taps.values()) {
      if (!tap.enabled || !tap.ws || tap.ws.readyState !== WebSocket.OPEN) continue;

      let outgoing = frame;
      if (tap.feedback > 0 && tap.feedbackFrame && tap.feedbackFrame.length === frame.length) {
        outgoing = new Float32Array(frame.length);
        for (let index = 0; index < frame.length; index += 1) {
          outgoing[index] = (frame[index] ?? 0) + (tap.feedbackFrame[index] ?? 0) * tap.feedback;
        }
        tap.feedbackFrame = null;
      }

      try {
        tap.ws.send(packFrame(tap.seq, outgoing));
        tap.seq += 1;
        tap.sent += 1;
      } catch {
        // A closed socket will be reflected by its close/error handlers.
      }
    }
  }

  private handleEcho(id: TapId, data: ArrayBuffer) {
    const tap = this.taps.get(id);
    if (!tap) return;

    const { seq, sentAt, frame } = unpackFrame(data);
    const rtt = performance.now() - sentAt;

    tap.rttEwma = tap.rttEwma === null ? rtt : tap.rttEwma * 0.9 + rtt * 0.1;

    if (tap.lastTransit !== null) {
      const delta = Math.abs(rtt - tap.lastTransit);
      tap.jitter += (delta - tap.jitter) / 16;
    }
    tap.lastTransit = rtt;

    if (tap.lastSeqSeen >= 0 && seq > tap.lastSeqSeen + 1) {
      tap.lost += seq - tap.lastSeqSeen - 1;
    }
    tap.lastSeqSeen = seq;
    tap.received += 1;

    if (tap.player) {
      const playbackFrame = new Float32Array(frame);
      tap.player.port.postMessage({ frame: playbackFrame }, [playbackFrame.buffer]);
    }
    if (tap.feedback > 0) tap.feedbackFrame = frame;

    this.emitTapMetrics(tap);
  }

  private applyPrebuffer() {
    const ctx = this.ctx;
    if (!ctx) return;

    const ms = this.bufferMode === "raw" ? 5 : this.jitterBufferMs;
    const samples = Math.round(ctx.sampleRate * ms / 1000);

    for (const tap of this.taps.values()) {
      tap.player?.port.postMessage({ cmd: "prebuffer", value: samples });
    }
  }

  private startMetricsLoop() {
    if (this.metricsTimer !== null) window.clearInterval(this.metricsTimer);
    this.metricsTimer = window.setInterval(() => {
      for (const tap of this.taps.values()) this.emitTapMetrics(tap);
    }, 400);
  }

  private startVuLoop() {
    const loop = () => {
      if (!this.running || !this.analyser) return;

      const samples = new Float32Array(this.analyser.fftSize);
      this.analyser.getFloatTimeDomainData(samples);

      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
      this.vuPeak = Math.max(peak, this.vuPeak * 0.92);
      this.onVu(Math.min(1, this.vuPeak * 1.4));
      this.vuFrame = window.requestAnimationFrame(loop);
    };

    this.vuFrame = window.requestAnimationFrame(loop);
  }

  private emitTapMetrics(tap: TapRuntime) {
    const lossPct = tap.sent > 0 ? (tap.lost / Math.max(1, tap.sent)) * 100 : null;
    this.onTapMetrics(tap.id, {
      connected: tap.connected,
      rttMs: tap.rttEwma,
      jitterMs: tap.received > 2 ? tap.jitter : null,
      lossPct: tap.received > 2 ? lossPct : null,
    });
  }

  private setStatus(running: boolean, micEnabled: boolean, message: string) {
    this.onStatus({ running, micEnabled, message });
  }
}
