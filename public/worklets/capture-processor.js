class SharkbiteCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.frameLength = 960;
    this.port.onmessage = (event) => {
      if (event.data.frameLength) this.frameLength = event.data.frameLength;
    };
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;

    for (let index = 0; index < channel.length; index += 1) {
      this.buffer.push(channel[index]);
    }

    while (this.buffer.length >= this.frameLength) {
      const frame = new Float32Array(this.buffer.splice(0, this.frameLength));
      this.port.postMessage(frame, [frame.buffer]);
    }

    return true;
  }
}

registerProcessor("sharkbite-capture", SharkbiteCapture);
