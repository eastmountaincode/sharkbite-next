/** Match the capture processor's first-channel input before dry/wet diverge. */
export function createMonoSourceBus(context: BaseAudioContext): GainNode {
  const bus = context.createGain();
  bus.channelCount = 1;
  bus.channelCountMode = "explicit";
  // Discrete conversion keeps channel one at unity, without averaging it with
  // an empty second interface channel and cutting the vocal level in half.
  bus.channelInterpretation = "discrete";
  return bus;
}
