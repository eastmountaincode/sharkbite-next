export const cities = [
    { name: "New York", code: "NYC", lon: -74.00, lat: 40.71, ms: 11.3 },
    { name: "Chicago", code: "CHI", lon: -87.63, lat: 41.88, ms: 29.7 },
    { name: "San Jose", code: "SJC", lon: -121.89, lat: 37.34, ms: 78.3 },
    { name: "London", code: "LON", lon: -0.13, lat: 51.51, ms: 87.3 },
    { name: "São Paulo", code: "SAO", lon: -46.63, lat: -23.55, ms: 133.6 },
    { name: "Tokyo", code: "TYO", lon: 139.69, lat: 35.68, ms: 232.8 },
    { name: "Sydney", code: "SYD", lon: 151.21, lat: -33.87, ms: 228.2 },
];

export type Mixer = { dry: number; wet: number; feedback: number };
export const initialMix: Mixer = { dry: 70, wet: 60, feedback: 35 };

// Each tap has its own loop. Changing the wet level only changes the audible return.
export class AtlasAudio {
    readonly ctx = new AudioContext();
    readonly input = this.ctx.createGain();
    private readonly dry = this.ctx.createGain();
    private readonly wet = this.ctx.createGain();
    private readonly taps = cities.map(city => {
        const delay = this.ctx.createDelay(1);
        delay.delayTime.value = city.ms / 1000;
        const send = this.ctx.createGain();
        const feedback = this.ctx.createGain();
        const level = this.ctx.createGain();
        send.gain.value = level.gain.value = feedback.gain.value = 0;
        this.input.connect(send).connect(delay);
        delay.connect(feedback).connect(delay);
        delay.connect(level).connect(this.wet);
        return { send, feedback, level };
    });
    private stream?: MediaStream;
    private mic?: MediaStreamAudioSourceNode;
    private micVersion = 0;

    constructor() {
        this.input.connect(this.dry).connect(this.ctx.destination);
        this.wet.connect(this.ctx.destination);
    }

    update(selected: ReadonlySet<string>, mix: Mixer) {
        const now = this.ctx.currentTime;
        this.dry.gain.setTargetAtTime(mix.dry / 100, now, 0.008);
        this.wet.gain.setTargetAtTime(mix.wet / 100, now, 0.008);
        this.taps.forEach((tap, i) => {
            const on = selected.has(cities[i].code);
            tap.send.gain.setTargetAtTime(on ? 1 : 0, now, 0.008);
            tap.feedback.gain.setTargetAtTime(on ? Math.min(mix.feedback, 90) / 100 : 0, now, 0.008);
            tap.level.gain.setTargetAtTime(on ? 1 / Math.max(1, selected.size) : 0, now, 0.008);
        });
    }

    strike() {
        const tone = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        const t = this.ctx.currentTime + 0.005;
        tone.frequency.setValueAtTime(1200, t);
        tone.frequency.exponentialRampToValueAtTime(240, t + 0.018);
        env.gain.setValueAtTime(0.55, t);
        env.gain.exponentialRampToValueAtTime(0.001, t + 0.028);
        tone.connect(env).connect(this.input);
        tone.onended = () => { tone.disconnect(); env.disconnect(); };
        tone.start(t);
        tone.stop(t + 0.03);
    }

    async startMic() {
        const version = ++this.micVersion;
        const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
        if (version !== this.micVersion) {
            stream.getTracks().forEach(track => track.stop());
            return;
        }
        this.stream = stream;
        this.mic = this.ctx.createMediaStreamSource(stream);
        this.mic.connect(this.input);
    }

    stopMic() {
        this.micVersion++;
        this.stream?.getTracks().forEach(track => track.stop());
        this.mic?.disconnect();
        this.mic = undefined;
        this.stream = undefined;
    }

    dispose() {
        this.stopMic();
        void this.ctx.close();
    }
}
