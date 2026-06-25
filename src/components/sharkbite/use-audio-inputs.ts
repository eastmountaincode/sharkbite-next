import { useCallback, useEffect, useState } from "react";
import type { AudioEngine } from "@/lib/audio/audio-engine";
import type { AudioInputOption } from "./sharkbite-model";
import { DEFAULT_INPUT_DEVICE_ID } from "./sharkbite-model";

type UseAudioInputsParams = {
  getEngine: () => AudioEngine;
  statusRunning: boolean;
};

export function useAudioInputs({ getEngine, statusRunning }: UseAudioInputsParams) {
  const [audioInputs, setAudioInputs] = useState<AudioInputOption[]>([]);
  const [inputDeviceId, setInputDeviceId] = useState(DEFAULT_INPUT_DEVICE_ID);

  const refreshAudioInputs = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const seen = new Set<string>();
      const inputs = devices
        .filter((device) => device.kind === "audioinput" && device.deviceId && device.deviceId !== "default")
        .filter((device) => {
          if (seen.has(device.deviceId)) return false;
          seen.add(device.deviceId);
          return true;
        })
        .map((device, index) => ({
          deviceId: device.deviceId,
          label: device.label || `Input ${index + 1}`,
        }));

      setAudioInputs(inputs);
    } catch {
      setAudioInputs([]);
    }
  }, []);

  useEffect(() => {
    const refreshTimer = window.setTimeout(() => {
      void refreshAudioInputs();
    }, 0);

    const handleDeviceChange = () => {
      void refreshAudioInputs();
    };

    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) {
      return () => window.clearTimeout(refreshTimer);
    }

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      window.clearTimeout(refreshTimer);
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [refreshAudioInputs]);

  const updateInputDevice = (value: string) => {
    setInputDeviceId(value);

    if (!statusRunning) return;
    void getEngine().setInputDevice(value || undefined).then(refreshAudioInputs);
  };

  return {
    audioInputs,
    inputDeviceId,
    refreshAudioInputs,
    updateInputDevice,
  };
}
