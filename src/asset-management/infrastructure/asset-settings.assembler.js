import {AssetSettings} from '@/asset-management/domain/model/asset-settings-entity.js';

export class AssetSettingsAssembler {
    static toEntityFromResource(resource) {
        return new AssetSettings({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.assetSettings;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            uuid: entity.uuid,
            assetTypes: entity.assetTypes,
            iotDeviceTypes: entity.iotDeviceTypes,
            minimumTemperature: entity.minimumTemperature,
            maximumTemperature: entity.maximumTemperature,
            maximumHumidity: entity.maximumHumidity,
            calibrationFrequencyDays: entity.calibrationFrequencyDays,
            temperatureUnit: entity.temperatureUnit,
            humidityUnit: entity.humidityUnit,
            weightUnit: entity.weightUnit,
            assetId: entity.assetId,
        };
    }
}
