import { useCallback, useEffect, useRef, useState } from "react";
import type { AudioEngine } from "@/lib/audio/audio-engine";
import {
    DEFAULT_AUDIO_INPUT,
    readAudioInputPreference,
    writeAudioInputPreference,
    type AudioInputPreference,
} from "@/lib/audio/audioInput";
import type { AudioInputOption } from "./sharkbite-model";

type UseAudioInputsParams = {
    getEngine: () => AudioEngine;
    statusRunning: boolean;
};

export function useAudioInputs({ getEngine, statusRunning }: UseAudioInputsParams) {
    const [audioInputs, setAudioInputs] = useState<AudioInputOption[]>([]);
    const [input, setInput] = useState<AudioInputPreference>(DEFAULT_AUDIO_INPUT);
    const [inputsReady, setInputsReady] = useState(false);
    const selected = useRef(DEFAULT_AUDIO_INPUT);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            let saved = DEFAULT_AUDIO_INPUT;
            try { saved = readAudioInputPreference(window.localStorage); }
            catch { /* Storage may be disabled. */ }
            selected.current = saved;
            setInput(saved);
            setInputsReady(true);
        }, 0);
        return () => window.clearTimeout(timer);
    }, []);

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
            // Enumeration can be empty until permission is granted. Keep the
            // saved device rather than replacing it with the system default.
        } catch {
            setAudioInputs([]);
        }
    }, []);

    useEffect(() => {
        const refreshTimer = window.setTimeout(() => { void refreshAudioInputs(); }, 0);
        const mediaDevices = navigator.mediaDevices;
        mediaDevices?.addEventListener("devicechange", refreshAudioInputs);
        return () => {
            window.clearTimeout(refreshTimer);
            mediaDevices?.removeEventListener("devicechange", refreshAudioInputs);
        };
    }, [refreshAudioInputs]);

    const updateInputDevice = (deviceId: string) => {
        const next = audioInputs.find((device) => device.deviceId === deviceId)
            ?? (deviceId ? { deviceId, label: selected.current.label } : DEFAULT_AUDIO_INPUT);
        selected.current = next;
        setInput(next);
        try { writeAudioInputPreference(window.localStorage, next); }
        catch { /* Input selection remains available without storage. */ }
        if (statusRunning) void getEngine().setInputDevice(deviceId || undefined).then(refreshAudioInputs);
    };

    return {
        audioInputs,
        inputDeviceId: input.deviceId,
        inputLabel: input.label,
        inputsReady,
        refreshAudioInputs,
        updateInputDevice,
    };
}
