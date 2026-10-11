export type AudioInputPreference = {
    deviceId: string;
    label: string;
};

export const DEFAULT_AUDIO_INPUT: AudioInputPreference = {
    deviceId: "",
    label: "System Default",
};

const STORAGE_KEY = "sharkbite.audio-input.v1";

export function readAudioInputPreference(storage: Pick<Storage, "getItem">): AudioInputPreference {
    try {
        const value: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null");
        if (!value || typeof value !== "object") return DEFAULT_AUDIO_INPUT;
        const input = value as Partial<AudioInputPreference>;
        if (typeof input.deviceId !== "string" || typeof input.label !== "string" || !input.label.trim()) {
            return DEFAULT_AUDIO_INPUT;
        }
        return { deviceId: input.deviceId, label: input.label };
    } catch {
        return DEFAULT_AUDIO_INPUT;
    }
}

export function writeAudioInputPreference(storage: Pick<Storage, "setItem">, input: AudioInputPreference) {
    storage.setItem(STORAGE_KEY, JSON.stringify({ deviceId: input.deviceId, label: input.label }));
}
