/* global AudioWorkletProcessor, registerProcessor, sampleRate */
// The listening sketch used 20 ms of mono 48 kHz, 16-bit PCM and a 12-byte
// header. Keep that virtual format independent of the sound card's sample rate.
const FRAME_MS = 20;
const FRAME_BITS = (960 * 2 + 12) * 8;
const DEADLINE_MS = 50;

class AtlasBandwidth extends AudioWorkletProcessor {
    static get parameterDescriptors() {
        return [
            { name: "kbps", defaultValue: 0, minValue: 0, maxValue: 800, automationRate: "k-rate" },
            { name: "excessMs", defaultValue: 0, minValue: 0, maxValue: DEADLINE_MS, automationRate: "k-rate" },
        ];
    }

    constructor() {
        super();
        this.backlog = 0;
        this.frameSamples = Math.round(sampleRate * FRAME_MS / 1000);
        this.remaining = 0;
        this.gain = 1;
        this.target = 1;
        this.fadeStep = 1 / Math.max(1, Math.round(sampleRate * 0.0015));
    }

    beginFrame(capacity, excessMs) {
        const finishMs = this.backlog + FRAME_BITS / capacity;
        const admitted = finishMs + excessMs <= DEADLINE_MS;
        this.target = admitted ? 1 : 0;
        this.backlog = Math.max(0, (admitted ? finishMs : this.backlog) - FRAME_MS);
        this.remaining = this.frameSamples;
    }

    process(_inputs, outputs, parameters) {
        const offset = outputs[0][0];
        const capacity = parameters.kbps[0];
        if (capacity === 0) {
            this.backlog = 0;
            this.remaining = 0;
            this.target = 1;
            if (this.gain === 1) {
                offset.fill(0);
                return true;
            }
        }
        for (let i = 0; i < offset.length; i++) {
            if (capacity > 0) {
                if (this.remaining === 0) this.beginFrame(capacity, parameters.excessMs[0]);
                this.remaining--;
            }
            this.gain += Math.max(-this.fadeStep, Math.min(this.fadeStep, this.target - this.gain));
            // This signal modulates a unity gain on the echo and feedback path.
            offset[i] = this.gain - 1;
        }
        return true;
    }
}

registerProcessor("atlas-bandwidth", AtlasBandwidth);
