export const cities = [
    { name: "New York", code: "NYC", lon: -74.00, lat: 40.71, ms: 11.3 },
    { name: "Chicago", code: "CHI", lon: -87.63, lat: 41.88, ms: 29.7 },
    { name: "San Jose", code: "SJC", lon: -121.89, lat: 37.34, ms: 78.3 },
    { name: "London", code: "LON", lon: -0.13, lat: 51.51, ms: 87.3 },
    { name: "São Paulo", code: "SAO", lon: -46.63, lat: -23.55, ms: 133.6 },
    { name: "Tokyo", code: "TYO", lon: 139.69, lat: 35.68, ms: 232.8 },
    { name: "Sydney", code: "SYD", lon: 151.21, lat: -33.87, ms: 228.2 },
];

// These four destinations have footswitches. All seven share the map and audio graph.
export const footswitchCities = { rich: cities[0], sf: cities[2], fra: cities[3], blr: cities[5] };

export function createAtlasReturns(ctx: AudioContext, source: GainNode, wet: GainNode) {
    const taps = cities.map(city => {
        const delay = ctx.createDelay(1);
        delay.delayTime.value = city.ms / 1000;
        const send = ctx.createGain();
        const feedback = ctx.createGain();
        const level = ctx.createGain();
        send.gain.value = level.gain.value = feedback.gain.value = 0;
        source.connect(send).connect(delay);
        delay.connect(feedback).connect(delay);
        delay.connect(level).connect(wet);
        return { send, feedback, level };
    });

    return (selected: ReadonlySet<string>, feedback: number) => {
        const audibleCount = cities.filter(city => selected.has(city.code)).length;
        taps.forEach((tap, i) => {
            const on = selected.has(cities[i].code);
            tap.send.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.008);
            tap.feedback.gain.setTargetAtTime(on ? feedback / 100 : 0, ctx.currentTime, 0.008);
            tap.level.gain.setTargetAtTime(on ? 1 / audibleCount : 0, ctx.currentTime, 0.008);
        });
    };
}
