import { useCallback, useEffect, useState } from "react";
import type { AudioEngine } from "@/lib/audio/audio-engine";
import { DEFAULT_OUTPUT_DEVICE_ID, type AudioOutputOption } from "./sharkbite-model";

type UseAudioOutputsParams = {
  getEngine: () => AudioEngine;
  statusRunning: boolean;
};

export function useAudioOutputs({ getEngine, statusRunning }: UseAudioOutputsParams) {
  const [audioOutputs, setAudioOutputs] = useState<AudioOutputOption[]>([]);
  const [outputDeviceId, setOutputDeviceId] = useState(DEFAULT_OUTPUT_DEVICE_ID);

  const refreshAudioOutputs = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const seen = new Set<string>();
      const outputs = devices
        .filter((device) => device.kind === "audiooutput" && device.deviceId && device.deviceId !== "default")
        .filter((device) => {
          if (seen.has(device.deviceId)) return false;
          seen.add(device.deviceId);
          return true;
        })
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Output ${index + 1}`,
        }));

      setAudioOutputs(outputs);
    } catch {
      setAudioOutputs([]);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshAudioOutputs();
    }, 0);

    const handleDeviceChange = () => {
      void refreshAudioOutputs();
    };

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) {
      return () => window.clearTimeout(refreshTimer);
    }

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      window.clearTimeout(refreshTimer);
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshAudioOutputs]);

  const updateOutputDevice = (value: string) => {
    const previousDeviceId = outputDeviceId;
    setOutputDeviceId(value);

    if (!statusRunning) return;
    void getEngine()
      .setOutputDevice(value || undefined)
      .then((changed) => {
        if (!changed) setOutputDeviceId(previousDeviceId);
        void refreshAudioOutputs();
      });
  };

  return {
    audioOutputs,
    outputDeviceId,
    refreshAudioOutputs,
    updateOutputDevice,
  };
}
