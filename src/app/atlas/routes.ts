import { destinations, MAX_DELAY_MS, MAX_FEEDBACK, type Measurement, type Measurements } from "./destinations";

export function createAtlasReturns(ctx: BaseAudioContext, source: GainNode, wet: GainNode) {
    const curve = new Float32Array(4097);
    for (let i = 0; i < curve.length; i++) {
        curve[i] = Math.tanh(i * 2 / (curve.length - 1) - 1);
    }
    const taps = destinations.map(city => {
        const send = ctx.createGain();
        const input = ctx.createGain();
        const mix = ctx.createGain();
        const packetGain = ctx.createGain();
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
        mix.connect(packetGain);
        packetGain.connect(feedback).connect(saturate).connect(input);
        packetGain.connect(level).connect(wet);
        return {
            city, send, delays, fades, feedback, level, packetGain, head: 0, ms: null as number | null,
            packetControl: null as AudioWorkletNode | null,
            capacity: null as number | null,
            reading: undefined as Measurement | undefined,
        };
    });

    return (selected: ReadonlySet<string>, feedback: number, measurements: Measurements,
        feedbackStopped = false, bandwidthKbps: number | null = null) => {
        const ready = (code: string) => {
            const ms = measurements[code]?.ms;
            return selected.has(code) && ms != null && Number.isFinite(ms) && ms > 0 && ms < MAX_DELAY_MS;
        };
        for (const tap of taps) {
            const on = ready(tap.city.code);
            const reading = measurements[tap.city.code];
            const ms = reading?.ms;
            const capacity = on ? bandwidthKbps : null;
            if (capacity !== null && !tap.packetControl) {
                tap.packetControl = new AudioWorkletNode(ctx, "atlas-bandwidth", {
                    numberOfInputs: 0, numberOfOutputs: 1, outputChannelCount: [1],
                });
                tap.packetControl.connect(tap.packetGain.gain);
            }
            if (tap.packetControl && (capacity !== tap.capacity || (capacity !== null && tap.reading !== reading))) {
                const now = ctx.currentTime;
                const parameters = tap.packetControl.parameters;
                parameters.get("kbps")!.value = capacity ?? 0;
                const excess = parameters.get("excessMs")!;
                excess.cancelScheduledValues(now);
                excess.setValueAtTime(Math.min(50, reading?.live ? reading.excessMs ?? 0 : 0), now);
                // Each live probe briefly tightens its own playout deadline.
                excess.setTargetAtTime(0, now, 0.20);
                tap.capacity = capacity;
                tap.reading = reading;
            }
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
            tap.feedback.gain.setTargetAtTime(on && !feedbackStopped ? Math.max(0, Math.min(MAX_FEEDBACK, feedback)) / 100 : 0, ctx.currentTime, 0.008);
            // Each return keeps its level; the master output handles overlapping peaks.
            tap.level.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.008);
        }
    };
}
