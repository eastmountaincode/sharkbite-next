// Unity gain below the knee; only overlapping peaks are rounded off.
export function createOutputPeakGuard(ctx: BaseAudioContext) {
    const input = ctx.createGain();
    const output = ctx.createWaveShaper();
    const range = 4;
    const knee = 0.8;
    const ceiling = 0.98;
    const curve = new Float32Array(8193);

    for (let i = 0; i < curve.length; i++) {
        const sample = (i * 2 / (curve.length - 1) - 1) * range;
        const magnitude = Math.abs(sample);
        curve[i] = magnitude <= knee ? sample : Math.sign(sample) * (
            knee + (ceiling - knee) * Math.tanh((magnitude - knee) / (ceiling - knee))
        );
    }

    // WaveShaper curves span [-1, 1]. The curve restores this fixed input
    // scaling, so quiet audio has unity gain regardless of destination count.
    input.gain.value = 1 / range;
    output.curve = curve;
    input.connect(output);
    return { input, output };
}
