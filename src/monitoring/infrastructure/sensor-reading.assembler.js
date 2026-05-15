import {SensorReading} from '@/monitoring/domain/model/sensor-reading-entity.js';

export class SensorReadingAssembler {
    static toEntityFromResource(resource) {
        return new SensorReading({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.sensorReadings;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            assetId: entity.assetId,
            iotDeviceId: entity.iotDeviceId,
            temperature: entity.temperature,
            humidity: entity.humidity,
            isOutOfRange: entity.isOutOfRange,
            recordedAt: entity.recordedAt,
            motionDetected: entity.motionDetected,
            imageCaptured: entity.imageCaptured,
            batteryLevel: entity.batteryLevel,
            signalStrength: entity.signalStrength,
        };
    }
}
