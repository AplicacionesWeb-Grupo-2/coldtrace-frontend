import {AssetSettings} from '@/asset-management/domain/model/asset-settings-entity.js';

/**
 * @typedef {Object} AssetSettingsApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [uuid]
 * @property {*} [assetTypes]
 * @property {*} [iotDeviceTypes]
 * @property {*} [minimumTemperature]
 * @property {*} [maximumTemperature]
 * @property {*} [minimumHumidity]
 * @property {*} [maximumHumidity]
 * @property {*} [calibrationFrequencyDays]
 * @property {*} [readingFrequencySeconds]
 * @property {*} [alertThresholdMinutes]
 * @property {*} [temperatureUnit]
 * @property {*} [humidityUnit]
 * @property {*} [weightUnit]
 * @property {*} [assetId]
 */

/**
 * Maps asset settings resources between API payloads and domain entities.
 */
export class AssetSettingsAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {AssetSettingsApiResource} resource
     * @returns {AssetSettings}
     */
    static toEntityFromResource(resource) {
        return new AssetSettings({...resource});
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<AssetSettingsApiResource[]|Object>} response
     * @returns {AssetSettings[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.assetSettings;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {AssetSettings} entity
     * @returns {AssetSettingsApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            uuid: entity.uuid,
            assetTypes: entity.assetTypes,
            iotDeviceTypes: entity.iotDeviceTypes,
            minimumTemperature: entity.minimumTemperature,
            maximumTemperature: entity.maximumTemperature,
            minimumHumidity: entity.minimumHumidity,
            maximumHumidity: entity.maximumHumidity,
            calibrationFrequencyDays: entity.calibrationFrequencyDays,
            readingFrequencySeconds: entity.readingFrequencySeconds,
            alertThresholdMinutes: entity.alertThresholdMinutes,
            temperatureUnit: entity.temperatureUnit,
            humidityUnit: entity.humidityUnit,
            weightUnit: entity.weightUnit,
            assetId: entity.assetId,
        };
    }
}
