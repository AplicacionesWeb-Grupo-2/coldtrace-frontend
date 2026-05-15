export const IOT_DEVICE_DEFINITIONS = [
    {
        type: 'temperature-sensor',
        modelPlaceholder: 'TempSense T100',
        parameters: ['temperature', 'battery', 'signal'],
    },
    {
        type: 'humidity-sensor',
        modelPlaceholder: 'HumidSense H200',
        parameters: ['humidity', 'temperature', 'battery', 'signal'],
    },
    {
        type: 'motion-sensor',
        modelPlaceholder: 'MoveSense M100',
        parameters: ['motion', 'battery', 'signal'],
    },
    {
        type: 'camera',
        modelPlaceholder: 'ColdCam C1',
        parameters: ['image', 'motion', 'battery', 'signal'],
    },
    {
        type: 'multi-sensor',
        modelPlaceholder: 'TraceSense M2',
        parameters: ['temperature', 'humidity', 'motion', 'battery', 'signal'],
    },
];
