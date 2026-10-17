class SharkbitePlayer extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ring = new Float32Array(Math.ceil(sampleRate * 0.5));
    this.read = 0;
    this.write = 0;
    this.size = 0;
    this.capacity = this.ring.length;
    this.prebuffer = 2880;
    this.playing = false;

    this.port.onmessage = (event) => {
      const data = event.data;

      if (data.cmd === "prebuffer") {
        this.prebuffer = data.value;
        return;
      }

      if (data.cmd === "flush") {
        this.read = 0;
        this.write = 0;
        this.size = 0;
        this.playing = false;
        return;
      }

      const frame = data.frame;
      if (!frame) return;
      if (Number.isFinite(data.receivedAt) && currentTime - data.receivedAt > 0.1) return;
      // Bursts after a stall must not turn into a second long playback queue.
      const target = Math.min(this.capacity, this.prebuffer + frame.length);
      if (this.size + frame.length > this.prebuffer + sampleRate * 0.1) {
        const discard = Math.max(0, this.size + frame.length - target);
        this.read = (this.read + discard) % this.capacity;
        this.size = Math.max(0, this.size - discard);
      }

      for (let index = 0; index < frame.length; index += 1) {
        this.ring[this.write] = frame[index];
        this.write = (this.write + 1) % this.capacity;
        if (this.size < this.capacity) {
          this.size += 1;
        } else {
          this.read = (this.read + 1) % this.capacity;
        }
      }
    };
  }

  process(_, outputs) {
    const out = outputs[0] && outputs[0][0];
    if (!out) return true;

    if (!this.playing && this.size >= this.prebuffer) this.playing = true;

    for (let index = 0; index < out.length; index += 1) {
      if (this.playing && this.size > 0) {
        out[index] = this.ring[this.read];
        this.read = (this.read + 1) % this.capacity;
        this.size -= 1;
      } else {
        out[index] = 0;
        if (this.playing) this.playing = false;
      }
    }

    return true;
  }
}

registerProcessor("sharkbite-player", SharkbitePlayer);
