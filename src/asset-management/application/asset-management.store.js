import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {AssetManagementApi} from '@/asset-management/infrastructure/asset-management-api.js';
import {AssetAssembler} from '@/asset-management/infrastructure/asset.assembler.js';
import {AssetSettingsAssembler} from '@/asset-management/infrastructure/asset-settings.assembler.js';
import {GatewayAssembler} from '@/asset-management/infrastructure/gateway.assembler.js';
import {IoTDeviceAssembler} from '@/asset-management/infrastructure/iot-device.assembler.js';
import {AssetStatus} from '@/asset-management/domain/model/asset-status.js';
import {CalibrationStatus} from '@/asset-management/domain/model/calibration-status.js';
import {ConnectivityStatus} from '@/asset-management/domain/model/connectivity-status.js';
import {GatewayStatus} from '@/asset-management/domain/model/gateway-status.js';
import {IoTDeviceStatus} from '@/asset-management/domain/model/iot-device-status.js';
import {Asset} from '@/asset-management/domain/model/asset-entity.js';
import {Gateway} from '@/asset-management/domain/model/gateway-entity.js';
import {IoTDevice} from '@/asset-management/domain/model/iot-device-entity.js';

const assetManagementApi = new AssetManagementApi();

/**
 * Pinia store that coordinates asset management application state and use cases.
 *
 * @returns {import('pinia').StoreDefinition}
 */
const useAssetManagementStore = defineStore('asset-management', () => {
    const assets = ref([]);
    const iotDevices = ref([]);
    const gateways = ref([]);
    const assetSettings = ref([]);
    const errors = ref([]);
    const loading = ref(false);
    const assetsLoaded = ref(false);
    const iotDevicesLoaded = ref(false);
    const gatewaysLoaded = ref(false);
    const assetSettingsLoaded = ref(false);
    const assetCount = computed(() => assets.value.length);
    let telemetryUpdateStep = 0;

    /**
     * Loads assets from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchAssets() {
        const response = await assetManagementApi.getAssets();
        assets.value = AssetAssembler.toEntitiesFromResponse(response);
        assetsLoaded.value = true;
        return assets.value;
    }

    /**
     * Loads iot devices from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchIoTDevices() {
        const response = await assetManagementApi.getIoTDevices();
        iotDevices.value = IoTDeviceAssembler.toEntitiesFromResponse(response);
        iotDevicesLoaded.value = true;
        return iotDevices.value;
    }

    /**
     * Loads gateways from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchGateways() {
        const response = await assetManagementApi.getGateways();
        gateways.value = GatewayAssembler.toEntitiesFromResponse(response);
        gatewaysLoaded.value = true;
        return gateways.value;
    }

    /**
     * Loads asset settings from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchAssetSettings() {
        const response = await assetManagementApi.getAssetSettings();
        assetSettings.value = AssetSettingsAssembler.toEntitiesFromResponse(response);
        assetSettingsLoaded.value = true;
        return assetSettings.value;
    }

    /**
     * Loads asset management data from the API and updates application state.
     *
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function fetchAssetManagementData({includeSettings = true} = {}) {
        loading.value = true;
        errors.value = [];
        try {
            const requests = [fetchAssets(), fetchIoTDevices(), fetchGateways()];
            if (includeSettings) requests.push(fetchAssetSettings());
            await Promise.all(requests);
            return {assets: assets.value, iotDevices: iotDevices.value, gateways: gateways.value, assetSettings: assetSettings.value};
        } catch (error) {
            errors.value.push(error);
            throw error;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Creates asset in the asset management context.
     *
     * @param {*} asset
     * @returns {Promise<*>}
     */
    async function createAsset(asset) {
        const response = await assetManagementApi.createAsset(AssetAssembler.toResourceFromEntity(asset));
        const createdAsset = AssetAssembler.toEntityFromResource(response.data);
        assets.value.push(createdAsset);
        return createdAsset;
    }

    /**
     * Updates asset in the asset management context.
     *
     * @param {*} asset
     * @returns {Promise<*>}
     */
    async function updateAsset(asset) {
        const response = await assetManagementApi.updateAsset(AssetAssembler.toResourceFromEntity(asset));
        const updatedAsset = AssetAssembler.toEntityFromResource(response.data);
        assets.value = assets.value.map(current => current.id === updatedAsset.id ? updatedAsset : current);
        return updatedAsset;
    }

    /**
     * Deletes asset from the asset management context.
     *
     * @param {*} asset
     * @returns {Promise<*>}
     */
    async function deleteAsset(asset) {
        if (!assetSettingsLoaded.value) await fetchAssetSettings();

        const linkedDevices = iotDevices.value.filter(iotDevice => iotDevice.assetId === asset.id);
        const linkedSettings = assetSettings.value.filter(settings => settings.assetId === asset.id);

        await Promise.all(linkedDevices.map(iotDevice =>
            updateIoTDevice(new IoTDevice({...iotDevice, assetId: null, status: IoTDeviceStatus.Available})),
        ));
        await Promise.all(linkedSettings.map(settings => assetManagementApi.deleteAssetSettings(settings.id)));
        await assetManagementApi.deleteAsset(asset.id);

        assetSettings.value = assetSettings.value.filter(settings => settings.assetId !== asset.id);
        assets.value = assets.value.filter(current => current.id !== asset.id);
    }

    /**
     * Creates iot device in the asset management context.
     *
     * @param {*} iotDevice
     * @returns {Promise<*>}
     */
    async function createIoTDevice(iotDevice) {
        const response = await assetManagementApi.createIoTDevice(IoTDeviceAssembler.toResourceFromEntity(iotDevice));
        const createdIoTDevice = IoTDeviceAssembler.toEntityFromResource(response.data);
        iotDevices.value.push(createdIoTDevice);
        return createdIoTDevice;
    }

    /**
     * Updates iot device in the asset management context.
     *
     * @param {*} iotDevice
     * @returns {Promise<*>}
     */
    async function updateIoTDevice(iotDevice) {
        const response = await assetManagementApi.updateIoTDevice(IoTDeviceAssembler.toResourceFromEntity(iotDevice));
        const updatedIoTDevice = IoTDeviceAssembler.toEntityFromResource(response.data);
        iotDevices.value = iotDevices.value.map(current => current.id === updatedIoTDevice.id ? updatedIoTDevice : current);
        return updatedIoTDevice;
    }

    /**
     * Deletes iot device from the asset management context.
     *
     * @param {*} iotDevice
     * @returns {Promise<*>}
     */
    async function deleteIoTDevice(iotDevice) {
        await assetManagementApi.deleteIoTDevice(iotDevice.id);
        iotDevices.value = iotDevices.value.filter(current => current.id !== iotDevice.id);
    }

    /**
     * Creates gateway in the asset management context.
     *
     * @param {*} gateway
     * @returns {Promise<*>}
     */
    async function createGateway(gateway) {
        const response = await assetManagementApi.createGateway(GatewayAssembler.toResourceFromEntity(gateway));
        const createdGateway = GatewayAssembler.toEntityFromResource(response.data);
        gateways.value.push(createdGateway);
        return createdGateway;
    }

    /**
     * Updates gateway in the asset management context.
     *
     * @param {*} gateway
     * @returns {Promise<*>}
     */
    async function updateGateway(gateway) {
        const response = await assetManagementApi.updateGateway(GatewayAssembler.toResourceFromEntity(gateway));
        const updatedGateway = GatewayAssembler.toEntityFromResource(response.data);
        gateways.value = gateways.value.map(current => current.id === updatedGateway.id ? updatedGateway : current);
        return updatedGateway;
    }

    /**
     * Deletes gateway from the asset management context.
     *
     * @param {*} gateway
     * @returns {Promise<*>}
     */
    async function deleteGateway(gateway) {
        const linkedAssets = assets.value.filter(asset => asset.gatewayId === gateway.id);

        await Promise.all(linkedAssets.map(asset =>
            updateAsset(new Asset({...asset, gatewayId: null, location: asset.location || gateway.location})),
        ));
        await assetManagementApi.deleteGateway(gateway.id);
        gateways.value = gateways.value.filter(current => current.id !== gateway.id);
    }

    /**
     * Creates asset settings in the asset management context.
     *
     * @param {*} settings
     * @returns {Promise<*>}
     */
    async function createAssetSettings(settings) {
        const response = await assetManagementApi.createAssetSettings(AssetSettingsAssembler.toResourceFromEntity(settings));
        const createdSettings = AssetSettingsAssembler.toEntityFromResource(response.data);
        assetSettings.value.push(createdSettings);
        return createdSettings;
    }

    /**
     * Updates asset settings in the asset management context.
     *
     * @param {*} settings
     * @returns {Promise<*>}
     */
    async function updateAssetSettings(settings) {
        const response = await assetManagementApi.updateAssetSettings(AssetSettingsAssembler.toResourceFromEntity(settings));
        const updatedSettings = AssetSettingsAssembler.toEntityFromResource(response.data);
        assetSettings.value = assetSettings.value.map(current => current.id === updatedSettings.id ? updatedSettings : current);
        return updatedSettings;
    }

    /**
     * Handles asset issue count for behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @returns {number}
     */
    function assetIssueCountFor(organizationId) {
        if (!organizationId) return 0;
        return assets.value.filter(asset => asset.organizationId === organizationId && hasAssetIssue(asset)).length;
    }

    /**
     * Handles assets for organization behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @param {Array<*>} availableAssets
     * @returns {*}
     */
    function assetsForOrganization(organizationId, availableAssets = assets.value) {
        if (!organizationId) return [];
        return availableAssets.filter(asset => asset.organizationId === organizationId);
    }

    /**
     * Handles iot devices for organization behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @param {*} availableDevices
     * @returns {*}
     */
    function iotDevicesForOrganization(organizationId, availableDevices = iotDevices.value) {
        if (!organizationId) return [];
        return availableDevices.filter(iotDevice => iotDevice.organizationId === organizationId);
    }

    /**
     * Handles gateways for organization behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @param {*} availableGateways
     * @returns {*}
     */
    function gatewaysForOrganization(organizationId, availableGateways = gateways.value) {
        if (!organizationId) return [];
        return availableGateways.filter(gateway => gateway.organizationId === organizationId);
    }

    /**
     * Handles asset settings for organization behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @param {*} availableSettings
     * @returns {*}
     */
    function assetSettingsForOrganization(organizationId, availableSettings = assetSettings.value) {
        if (!organizationId) return [];
        return availableSettings.filter(settings => settings.organizationId === organizationId);
    }

    /**
     * Handles default settings for organization behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @returns {*}
     */
    function defaultSettingsForOrganization(organizationId) {
        return assetSettingsForOrganization(organizationId).find(settings => settings.assetId === null);
    }

    /**
     * Handles location for asset behavior in the asset management context.
     *
     * @param {*} asset
     * @param {*} availableGateways
     * @returns {string}
     */
    function locationForAsset(asset, availableGateways = gateways.value) {
        return locationForGateway(asset.gatewayId, availableGateways) ?? asset.location;
    }

    /**
     * Handles location for gateway behavior in the asset management context.
     *
     * @param {number|string} gatewayId
     * @param {*} availableGateways
     * @returns {string}
     */
    function locationForGateway(gatewayId, availableGateways = gateways.value) {
        if (!gatewayId) return null;
        return availableGateways.find(gateway => gateway.id === Number(gatewayId))?.location ?? null;
    }

    /**
     * Handles monitored assets for organization behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @param {Array<*>} availableAssets
     * @param {*} availableDevices
     * @returns {*}
     */
    function monitoredAssetsForOrganization(organizationId, availableAssets = assets.value, availableDevices = iotDevices.value) {
        const organizationAssets = assetsForOrganization(organizationId, availableAssets);
        const monitoredAssetIds = new Set(
            iotDevicesForOrganization(organizationId, availableDevices)
                .filter(iotDevice => iotDevice.assetId !== null)
                .map(iotDevice => iotDevice.assetId),
        );
        return organizationAssets.filter(asset => monitoredAssetIds.has(asset.id));
    }

    /**
     * Handles iot devices for asset behavior in the asset management context.
     *
     * @param {number|string} assetId
     * @param {*} availableDevices
     * @returns {*}
     */
    function iotDevicesForAsset(assetId, availableDevices = iotDevices.value) {
        if (!assetId) return [];
        return availableDevices.filter(iotDevice => iotDevice.assetId === Number(assetId));
    }

    /**
     * Handles settings for asset behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @param {number|string} assetId
     * @returns {void}
     */
    function settingsForAsset(organizationId, assetId) {
        const settings = assetSettingsForOrganization(organizationId);
        const assetSpecificSettings = settings.find(current => current.assetId !== null && current.assetId === Number(assetId));
        return assetSpecificSettings ?? settings.find(current => current.assetId === null) ?? settings[0];
    }

    /**
     * Handles next asset settings id behavior in the asset management context.
     *
     * @returns {*}
     */
    function nextAssetSettingsId() {
        return Math.max(...assetSettings.value.map(settings => settings.id), 0) + 1;
    }

    /**
     * Handles operational summary for behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @returns {*}
     */
    function operationalSummaryFor(organizationId) {
        const organizationAssets = assetsForOrganization(organizationId);
        const organizationDevices = iotDevicesForOrganization(organizationId);
        const organizationGateways = gatewaysForOrganization(organizationId);
        const monitoredAssetIds = new Set(
            organizationDevices
                .filter(iotDevice => iotDevice.assetId !== null)
                .map(iotDevice => iotDevice.assetId),
        );

        return {
            totalAssets: organizationAssets.length,
            monitoredAssets: organizationAssets.filter(asset => monitoredAssetIds.has(asset.id)).length,
            connectedDevices: organizationDevices.filter(iotDevice => iotDevice.status === IoTDeviceStatus.Linked).length,
            totalDevices: organizationDevices.length,
            connectedGateways: organizationGateways.filter(gateway => gateway.status === GatewayStatus.Active).length,
            assetsWithIssues: organizationAssets.filter(asset => hasAssetIssue(asset)).length,
            connectivityIssues: organizationAssets.filter(asset => asset.connectivity !== ConnectivityStatus.Online).length,
        };
    }

    /**
     * Determines whether asset issue exists.
     *
     * @param {*} asset
     * @returns {boolean}
     */
    function hasAssetIssue(asset) {
        return asset.lastIncident !== 'none' ||
            asset.connectivity !== ConnectivityStatus.Online ||
            asset.status !== AssetStatus.Active;
    }

    /**
     * Handles next asset behavior in the asset management context.
     *
     * @param {*} asset
     * @param {Object} fields
     * @returns {*}
     */
    function nextAsset(asset, fields) {
        return new Asset({...asset, ...fields});
    }

    /**
     * Handles next iot device behavior in the asset management context.
     *
     * @param {*} iotDevice
     * @param {Object} fields
     * @returns {*}
     */
    function nextIoTDevice(iotDevice, fields) {
        return new IoTDevice({...iotDevice, ...fields});
    }

    /**
     * Handles next gateway behavior in the asset management context.
     *
     * @param {*} gateway
     * @param {Object} fields
     * @returns {*}
     */
    function nextGateway(gateway, fields) {
        return new Gateway({...gateway, ...fields});
    }

    /**
     * Updates organization telemetry in the asset management context.
     *
     * @param {number|string} organizationId
     * @returns {void}
     */
    function updateOrganizationTelemetry(organizationId) {
        if (!organizationId) return;

        const organizationAssets = assetsForOrganization(organizationId);
        const organizationDevices = iotDevicesForOrganization(organizationId);
        const organizationGateways = gatewaysForOrganization(organizationId);
        const currentStep = telemetryUpdateStep % 3;
        telemetryUpdateStep += 1;

        if (currentStep === 0) {
            const gateway = sampleOne(organizationGateways);
            if (gateway) updateGateway(nextGateway(gateway, {status: randomGatewayStatus()})).catch(() => undefined);
            return;
        }

        if (currentStep === 1) {
            const iotDevice = sampleOne(organizationDevices);
            if (iotDevice) {
                updateIoTDevice(nextIoTDevice(iotDevice, {
                    status: randomIoTDeviceStatus(iotDevice),
                    calibrationStatus: randomCalibrationStatus(),
                })).catch(() => undefined);
            }
            return;
        }

        const asset = sampleOne(organizationAssets);
        if (!asset) return;

        const gateway = organizationGateways.find(current => current.id === asset.gatewayId);
        const iotDevice = organizationDevices.find(current => current.assetId === asset.id);
        const settings = settingsForAsset(organizationId, asset.id);
        const connectivity = randomConnectivity(gateway ?? null, iotDevice ?? null);
        const currentTemperature = randomTemperature(connectivity, settings);

        updateAsset(nextAsset(asset, {
            lastIncident: incidentFor(currentTemperature, connectivity, settings),
            currentTemperature,
            connectivity,
        })).catch(() => undefined);
    }

    /**
     * Handles random temperature behavior in the asset management context.
     *
     * @param {*} connectivity
     * @param {*} settings
     * @returns {*}
     */
    function randomTemperature(connectivity, settings) {
        if (connectivity === ConnectivityStatus.Offline || !settings) return '—';
        const anomalyRoll = Math.random();
        let temperature;
        if (anomalyRoll < 0.94) temperature = randomNumber(settings.minimumTemperature, settings.maximumTemperature);
        else if (anomalyRoll < 0.97) temperature = randomNumber(settings.minimumTemperature - 2, settings.minimumTemperature - 0.2);
        else temperature = randomNumber(settings.maximumTemperature + 0.2, settings.maximumTemperature + 3);
        return `${temperature.toFixed(1)}${settings.temperatureUnit}`;
    }

    /**
     * Handles incident for behavior in the asset management context.
     *
     * @param {*} currentTemperature
     * @param {*} connectivity
     * @param {*} settings
     * @returns {*}
     */
    function incidentFor(currentTemperature, connectivity, settings) {
        if (connectivity === ConnectivityStatus.Offline) return 'connection-lost';
        if (!settings) return 'none';
        const temperature = Number(currentTemperature.replace(/[^\d.-]/g, ''));
        if (temperature > settings.maximumTemperature) return 'high-temperature';
        if (temperature < settings.minimumTemperature) return 'low-temperature';
        return 'none';
    }

    /**
     * Handles random connectivity behavior in the asset management context.
     *
     * @param {*} gateway
     * @param {*} iotDevice
     * @returns {*}
     */
    function randomConnectivity(gateway, iotDevice) {
        if (!iotDevice || gateway?.status === GatewayStatus.Offline || iotDevice.status === IoTDeviceStatus.Offline) {
            return ConnectivityStatus.Offline;
        }
        if (gateway?.status === GatewayStatus.Maintenance) {
            return Math.random() < 0.75 ? ConnectivityStatus.Online : ConnectivityStatus.Unstable;
        }
        const randomValue = Math.random();
        if (randomValue < 0.92) return ConnectivityStatus.Online;
        if (randomValue < 0.98) return ConnectivityStatus.Unstable;
        return ConnectivityStatus.Offline;
    }

    /**
     * Handles random iot device status behavior in the asset management context.
     *
     * @param {*} iotDevice
     * @returns {string}
     */
    function randomIoTDeviceStatus(iotDevice) {
        if (!iotDevice.assetId) {
            return Math.random() < 0.96 ? IoTDeviceStatus.Available : IoTDeviceStatus.Offline;
        }
        return Math.random() < 0.96 ? IoTDeviceStatus.Linked : IoTDeviceStatus.Offline;
    }

    /**
     * Handles random calibration status behavior in the asset management context.
     *
     * @returns {string}
     */
    function randomCalibrationStatus() {
        const randomValue = Math.random();
        if (randomValue < 0.76) return CalibrationStatus.Compliant;
        if (randomValue < 0.93) return CalibrationStatus.DueSoon;
        if (randomValue < 0.98) return CalibrationStatus.Expired;
        return CalibrationStatus.Unknown;
    }

    /**
     * Handles random gateway status behavior in the asset management context.
     *
     * @returns {string}
     */
    function randomGatewayStatus() {
        const randomValue = Math.random();
        if (randomValue < 0.92) return GatewayStatus.Active;
        if (randomValue < 0.98) return GatewayStatus.Maintenance;
        return GatewayStatus.Offline;
    }

    /**
     * Handles random number behavior in the asset management context.
     *
     * @param {number|string} minimum
     * @param {number|string} maximum
     * @returns {number}
     */
    function randomNumber(minimum, maximum) {
        return minimum + Math.random() * (maximum - minimum);
    }

    /**
     * Handles sample one behavior in the asset management context.
     *
     * @param {Array<*>} items
     * @returns {*}
     */
    function sampleOne(items) {
        if (!items.length) return null;
        return items[Math.floor(Math.random() * items.length)];
    }

    return {
        assets,
        iotDevices,
        gateways,
        assetSettings,
        errors,
        loading,
        assetsLoaded,
        iotDevicesLoaded,
        gatewaysLoaded,
        assetSettingsLoaded,
        assetCount,
        fetchAssets,
        fetchIoTDevices,
        fetchGateways,
        fetchAssetSettings,
        fetchAssetManagementData,
        createAsset,
        updateAsset,
        deleteAsset,
        createIoTDevice,
        updateIoTDevice,
        deleteIoTDevice,
        createGateway,
        updateGateway,
        deleteGateway,
        createAssetSettings,
        updateAssetSettings,
        assetIssueCountFor,
        assetsForOrganization,
        iotDevicesForOrganization,
        gatewaysForOrganization,
        assetSettingsForOrganization,
        defaultSettingsForOrganization,
        locationForAsset,
        locationForGateway,
        monitoredAssetsForOrganization,
        iotDevicesForAsset,
        settingsForAsset,
        nextAssetSettingsId,
        operationalSummaryFor,
        updateOrganizationTelemetry,
    };
});

export default useAssetManagementStore;
