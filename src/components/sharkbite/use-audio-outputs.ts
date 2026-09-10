import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioEngine } from "@/lib/audio/audio-engine";
import {
  DEFAULT_AUDIO_OUTPUT,
  readAudioOutputPreference,
  readAudioOutputChannelPreference,
  writeAudioOutputPreference,
  writeAudioOutputChannelPreference,
  type AudioOutputChannel,
  type AudioOutputDevice,
} from "@/lib/audio/audioOutput";
import type { AudioOutputOption } from "./sharkbite-model";

type UseAudioOutputsParams = {
  getEngine: () => AudioEngine;
  statusRunning: boolean;
};

export function useAudioOutputs({ getEngine, statusRunning }: UseAudioOutputsParams) {
  const [audioOutputs, setAudioOutputs] = useState<AudioOutputOption[]>([]);
  const [output, setOutput] = useState<AudioOutputDevice>(DEFAULT_AUDIO_OUTPUT);
  const [outputChannel, setOutputChannel] = useState<AudioOutputChannel>("stereo");
  const [outputsReady, setOutputsReady] = useState(false);
  const selected = useRef({ output: DEFAULT_AUDIO_OUTPUT as AudioOutputDevice, channel: "stereo" as AudioOutputChannel });

  const refreshAudioOutputs = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const seen = new Set(["", "default"]);
      const outputs = devices
        .filter((device) => {
          if (device.kind !== "audiooutput" || seen.has(device.deviceId)) return false;
          seen.add(device.deviceId);
          return true;
        })
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Output ${index + 1}`,
        }));
      setAudioOutputs(outputs);
      // Keep the saved choice visible; never silently substitute another sink.
      if (statusRunning && selected.current.output.deviceId &&
          !outputs.some((device) => device.deviceId === selected.current.output.deviceId)) {
        getEngine().muteOutput("Output muted: selected device is unavailable. Reconnect it or choose another output.");
      }
    } catch {
      // Enumeration failure alone does not mean the running device disconnected.
    }
  }, [getEngine, statusRunning]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      let output = DEFAULT_AUDIO_OUTPUT as AudioOutputDevice;
      let channel: AudioOutputChannel = "stereo";
      try {
        output = readAudioOutputPreference(window.localStorage);
        channel = readAudioOutputChannelPreference(window.localStorage);
      } catch { /* Storage may be disabled. */ }
      selected.current = { output, channel };
      setOutput(output);
      setOutputChannel(channel);
      setOutputsReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshAudioOutputs(), 0);
    const mediaDevices = navigator.mediaDevices;
    mediaDevices?.addEventListener("devicechange", refreshAudioOutputs);
    return () => {
      window.clearTimeout(timer);
      mediaDevices?.removeEventListener("devicechange", refreshAudioOutputs);
    };
  }, [refreshAudioOutputs]);

  const apply = (output: AudioOutputDevice, channel: AudioOutputChannel) => {
    selected.current = { output, channel };
    setOutput(output);
    setOutputChannel(channel);
    try {
      writeAudioOutputPreference(window.localStorage, output);
      writeAudioOutputChannelPreference(window.localStorage, channel);
    } catch { /* Routing remains available without persistent storage. */ }
    if (statusRunning) void getEngine().setOutputRoute(output.deviceId, channel);
  };

  return {
    audioOutputs,
    outputDeviceId: output.deviceId,
    outputLabel: output.label,
    outputChannel,
    outputsReady,
    refreshAudioOutputs,
    updateOutputDevice: (deviceId: string) => apply(
      audioOutputs.find((device) => device.deviceId === deviceId) ??
        (deviceId ? { deviceId, label: selected.current.output.label } : DEFAULT_AUDIO_OUTPUT),
      selected.current.channel,
    ),
    updateOutputChannel: (channel: AudioOutputChannel) => apply(selected.current.output, channel),
    retryOutput: () => {
      void refreshAudioOutputs();
      if (statusRunning) void getEngine().setOutputRoute(selected.current.output.deviceId, selected.current.channel);
    },
  };
}
