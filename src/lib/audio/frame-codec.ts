const HEADER_BYTES = 12;

export function packFrame(seq: number, frame: Float32Array) {
  const buffer = new ArrayBuffer(HEADER_BYTES + frame.length * 2);
  const view = new DataView(buffer);

  view.setUint32(0, seq, true);
  view.setFloat64(4, performance.now(), true);

  let offset = HEADER_BYTES;
  for (let index = 0; index < frame.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, frame[index] ?? 0));
    view.setInt16(offset, sample * 32767, true);
    offset += 2;
  }

  return buffer;
}

export function unpackFrame(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const seq = view.getUint32(0, true);
  const sentAt = view.getFloat64(4, true);
  const sampleCount = (buffer.byteLength - HEADER_BYTES) / 2;
  const frame = new Float32Array(sampleCount);

  let offset = HEADER_BYTES;
  for (let index = 0; index < sampleCount; index += 1) {
    frame[index] = view.getInt16(offset, true) / 32768;
    offset += 2;
  }

  return { seq, sentAt, frame };
}
