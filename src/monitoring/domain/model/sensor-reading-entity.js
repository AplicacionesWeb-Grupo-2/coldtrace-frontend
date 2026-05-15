export class SensorReading {
    constructor({
        id = null,
        assetId = null,
        iotDeviceId = null,
        temperature = null,
        humidity = null,
        isOutOfRange = false,
        recordedAt = '',
        motionDetected = null,
        imageCaptured = null,
        batteryLevel = null,
        signalStrength = null,
    }) {
        this.id = id === null || id === undefined ? null : Number(id);
        this.assetId = Number(assetId);
        this.iotDeviceId = Number(iotDeviceId);
        this.temperature = temperature === null || temperature === undefined ? null : Number(temperature);
        this.humidity = humidity === null || humidity === undefined ? null : Number(humidity);
        this.isOutOfRange = Boolean(isOutOfRange);
        this.recordedAt = recordedAt;
        this.motionDetected = motionDetected;
        this.imageCaptured = imageCaptured;
        this.batteryLevel = batteryLevel === null || batteryLevel === undefined ? null : Number(batteryLevel);
        this.signalStrength = signalStrength === null || signalStrength === undefined ? null : Number(signalStrength);
    }
}
