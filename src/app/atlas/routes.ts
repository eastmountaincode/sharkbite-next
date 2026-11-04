import { destinations, MAX_DELAY_MS, MAX_FEEDBACK, type Measurements } from "./destinations";

export function createAtlasReturns(ctx: BaseAudioContext, source: GainNode, wet: GainNode) {
    const curve = new Float32Array(4097);
    for (let i = 0; i < curve.length; i++) {
        curve[i] = Math.tanh(i * 2 / (curve.length - 1) - 1);
    }
    const taps = destinations.map(city => {
        const send = ctx.createGain();
        const input = ctx.createGain();
        const mix = ctx.createGain();
        const feedback = ctx.createGain();
        const saturate = ctx.createWaveShaper();
        const level = ctx.createGain();
        const delays = [ctx.createDelay(MAX_DELAY_MS / 1000), ctx.createDelay(MAX_DELAY_MS / 1000)];
        const fades = [ctx.createGain(), ctx.createGain()];
        saturate.curve = curve;
        send.gain.value = level.gain.value = feedback.gain.value = 0;
        fades[0].gain.value = 1;
        fades[1].gain.value = 0;
        source.connect(send).connect(input);
        delays.forEach((delay, i) => input.connect(delay).connect(fades[i]).connect(mix));
        // Saturation bounds the loop even above unity feedback; repeats can build up.
        mix.connect(feedback).connect(saturate).connect(input);
        mix.connect(level).connect(wet);
        return { city, send, delays, fades, feedback, level, head: 0, ms: null as number | null };
    });

    return (selected: ReadonlySet<string>, feedback: number, measurements: Measurements) => {
        const ready = (code: string) => {
            const ms = measurements[code]?.ms;
            return selected.has(code) && ms != null && Number.isFinite(ms) && ms > 0 && ms < MAX_DELAY_MS;
        };
        const count = destinations.filter(city => ready(city.code)).length;
        for (const tap of taps) {
            const on = ready(tap.city.code);
            const ms = measurements[tap.city.code]?.ms;
            if (on && ms != null && (tap.ms === null || Math.abs(tap.ms - ms) >= 0.5)) {
                if (tap.ms === null) {
                    tap.delays.forEach(delay => { delay.delayTime.value = ms / 1000; });
                } else {
                    // Switch between read heads instead of bending the pitch of the tail.
                    const next = 1 - tap.head;
                    tap.delays[next].delayTime.setValueAtTime(ms / 1000, ctx.currentTime);
                    tap.fades.forEach((fade, i) => {
                        fade.gain.cancelScheduledValues(ctx.currentTime);
                        fade.gain.setValueAtTime(i === tap.head ? 1 : 0, ctx.currentTime);
                        fade.gain.linearRampToValueAtTime(i === next ? 1 : 0, ctx.currentTime + 0.04);
                    });
                    tap.head = next;
                }
                tap.ms = ms;
            }
            tap.send.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.008);
            tap.feedback.gain.setTargetAtTime(on ? Math.max(0, Math.min(MAX_FEEDBACK, feedback)) / 100 : 0, ctx.currentTime, 0.008);
            tap.level.gain.setTargetAtTime(on ? 1 / count : 0, ctx.currentTime, 0.008);
        }
    };
}
