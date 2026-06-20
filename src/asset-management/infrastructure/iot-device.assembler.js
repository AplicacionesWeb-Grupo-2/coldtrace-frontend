import {IoTDevice} from '@/asset-management/domain/model/iot-device-entity.js';

/**
 * @typedef {Object} IoTDeviceApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [gatewayId]
 * @property {*} [uuid]
 * @property {*} [deviceType]
 * @property {*} [model]
 * @property {*} [measurementType]
 * @property {*} [measurementParameters]
 * @property {*} [readingFrequencySeconds]
 * @property {*} [assetId]
 * @property {*} [status]
 * @property {*} [calibrationStatus]
 * @property {*} [lastCalibrationDate]
 * @property {*} [nextCalibrationDate]
 */

/**
 * Maps iot device resources between API payloads and domain entities.
 */
export class IoTDeviceAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {IoTDeviceApiResource} resource
     * @returns {IoTDevice}
     */
    static toEntityFromResource(resource) {
        return new IoTDevice({...resource});
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<IoTDeviceApiResource[]|Object>} response
     * @returns {IoTDevice[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.iotDevices;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {IoTDevice} entity
     * @returns {IoTDeviceApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            gatewayId: entity.gatewayId,
            uuid: entity.uuid,
            deviceType: entity.deviceType,
            model: entity.model,
            measurementType: entity.measurementType,
            measurementParameters: entity.measurementParameters,
            readingFrequencySeconds: entity.readingFrequencySeconds,
            assetId: entity.assetId,
            status: entity.status,
            calibrationStatus: entity.calibrationStatus,
            lastCalibrationDate: entity.lastCalibrationDate,
            nextCalibrationDate: entity.nextCalibrationDate,
        };
    }
}
