import {IoTDevice} from '@/asset-management/domain/model/iot-device-entity.js';

export class IoTDeviceAssembler {
    static toEntityFromResource(resource) {
        return new IoTDevice({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.iotDevices;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
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
