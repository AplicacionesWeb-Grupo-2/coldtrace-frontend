import {SensorReading} from '@/monitoring/domain/model/sensor-reading-entity.js';

/**
 * @typedef {Object} SensorReadingApiResource
 * @property {*} [id]
 * @property {*} [assetId]
 * @property {*} [iotDeviceId]
 * @property {*} [temperature]
 * @property {*} [humidity]
 * @property {*} [isOutOfRange]
 * @property {*} [recordedAt]
 * @property {*} [motionDetected]
 * @property {*} [imageCaptured]
 * @property {*} [batteryLevel]
 * @property {*} [signalStrength]
 */

/**
 * Maps sensor reading resources between API payloads and domain entities.
 */
export class SensorReadingAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {SensorReadingApiResource} resource
     * @returns {SensorReading}
     */
    static toEntityFromResource(resource) {
        return new SensorReading({...resource});
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<SensorReadingApiResource[]|Object>} response
     * @returns {SensorReading[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status < 200 || response.status >= 300) return [];
        const resources = response.data instanceof Array ? response.data : response.data.sensorReadings;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {SensorReading} entity
     * @returns {SensorReadingApiResource}
     */
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
