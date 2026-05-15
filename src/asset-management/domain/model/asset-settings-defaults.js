import {AssetSettings} from '@/asset-management/domain/model/asset-settings-entity.js';

export const DEFAULT_ASSET_SETTING_VALUES = {
    assetTypes: ['Cold room', 'Refrigerated transport'],
    iotDeviceTypes: [
        'Temperature sensor',
        'Humidity sensor',
        'Motion sensor',
        'Camera',
        'Multi-sensor',
    ],
    minimumTemperature: -5,
    maximumTemperature: 8,
    maximumHumidity: 85,
    calibrationFrequencyDays: 180,
    temperatureUnit: '°C',
    humidityUnit: '%',
    weightUnit: 'kg',
};

export function buildDefaultAssetSettings(id, organizationId, uuid, assetId = null, fallbackSettings = null) {
    return new AssetSettings({
        id,
        organizationId,
        uuid,
        assetTypes: [...(fallbackSettings?.assetTypes ?? DEFAULT_ASSET_SETTING_VALUES.assetTypes)],
        iotDeviceTypes: [...(fallbackSettings?.iotDeviceTypes ?? DEFAULT_ASSET_SETTING_VALUES.iotDeviceTypes)],
        minimumTemperature: fallbackSettings?.minimumTemperature ?? DEFAULT_ASSET_SETTING_VALUES.minimumTemperature,
        maximumTemperature: fallbackSettings?.maximumTemperature ?? DEFAULT_ASSET_SETTING_VALUES.maximumTemperature,
        maximumHumidity: fallbackSettings?.maximumHumidity ?? DEFAULT_ASSET_SETTING_VALUES.maximumHumidity,
        calibrationFrequencyDays: fallbackSettings?.calibrationFrequencyDays ?? DEFAULT_ASSET_SETTING_VALUES.calibrationFrequencyDays,
        temperatureUnit: fallbackSettings?.temperatureUnit ?? DEFAULT_ASSET_SETTING_VALUES.temperatureUnit,
        humidityUnit: fallbackSettings?.humidityUnit ?? DEFAULT_ASSET_SETTING_VALUES.humidityUnit,
        weightUnit: fallbackSettings?.weightUnit ?? DEFAULT_ASSET_SETTING_VALUES.weightUnit,
        assetId,
    });
}
