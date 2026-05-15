export class AssetSettings {
    constructor({
        id = null,
        organizationId = null,
        uuid = '',
        assetTypes = [],
        iotDeviceTypes = [],
        minimumTemperature = -5,
        maximumTemperature = 8,
        maximumHumidity = 85,
        calibrationFrequencyDays = 180,
        temperatureUnit = '°C',
        humidityUnit = '%',
        weightUnit = 'kg',
        assetId = null,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.uuid = uuid;
        this.assetTypes = [...assetTypes];
        this.iotDeviceTypes = [...iotDeviceTypes];
        this.minimumTemperature = Number(minimumTemperature);
        this.maximumTemperature = Number(maximumTemperature);
        this.maximumHumidity = Number(maximumHumidity);
        this.calibrationFrequencyDays = Number(calibrationFrequencyDays);
        this.temperatureUnit = temperatureUnit;
        this.humidityUnit = humidityUnit;
        this.weightUnit = weightUnit;
        this.assetId = assetId === null || assetId === undefined ? null : Number(assetId);
    }
}
