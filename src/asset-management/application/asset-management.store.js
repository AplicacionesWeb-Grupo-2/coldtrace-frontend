import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {AssetManagementApi} from '@/asset-management/infrastructure/asset-management-api.js';
import {AssetAssembler} from '@/asset-management/infrastructure/asset.assembler.js';
import {AssetSettingsAssembler} from '@/asset-management/infrastructure/asset-settings.assembler.js';
import {GatewayAssembler} from '@/asset-management/infrastructure/gateway.assembler.js';
import {IoTDeviceAssembler} from '@/asset-management/infrastructure/iot-device.assembler.js';
import {LocationAssembler} from '@/asset-management/infrastructure/location.assembler.js';
import {AssetStatus} from '@/asset-management/domain/model/asset-status.js';
import {ConnectivityStatus} from '@/asset-management/domain/model/connectivity-status.js';
import {GatewayStatus} from '@/asset-management/domain/model/gateway-status.js';
import {IoTDeviceStatus} from '@/asset-management/domain/model/iot-device-status.js';
import {Asset} from '@/asset-management/domain/model/asset-entity.js';
import {Gateway} from '@/asset-management/domain/model/gateway-entity.js';
import {IoTDevice} from '@/asset-management/domain/model/iot-device-entity.js';
import {Location} from '@/asset-management/domain/model/location-entity.js';

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
    const locations = ref([]);
    const assetSettings = ref([]);
    const errors = ref([]);
    const loading = ref(false);
    const assetsLoaded = ref(false);
    const iotDevicesLoaded = ref(false);
    const gatewaysLoaded = ref(false);
    const locationsLoaded = ref(false);
    const assetSettingsLoaded = ref(false);
    const assetCount = computed(() => assets.value.length);

    /**
     * Loads assets from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchAssets(organizationId) {
        if (!organizationId) {
            assets.value = [];
            assetsLoaded.value = false;
            return assets.value;
        }

        const response = await assetManagementApi.getAssets(organizationId);
        assets.value = AssetAssembler.toEntitiesFromResponse(response);
        enrichAssetsWithGatewayData();
        assetsLoaded.value = true;
        return assets.value;
    }

    /**
     * Loads iot devices from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchIoTDevices(organizationId) {
        if (!organizationId) {
            iotDevices.value = [];
            iotDevicesLoaded.value = false;
            return iotDevices.value;
        }

        const response = await assetManagementApi.getIoTDevices(organizationId);
        iotDevices.value = IoTDeviceAssembler.toEntitiesFromResponse(response);
        iotDevicesLoaded.value = true;
        return iotDevices.value;
    }

    /**
     * Loads gateways from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchGateways(organizationId, availableLocations = null) {
        if (!organizationId) {
            gateways.value = [];
            gatewaysLoaded.value = false;
            return gateways.value;
        }

        const response = await assetManagementApi.getGateways(organizationId, availableLocations);
        gateways.value = GatewayAssembler.toEntitiesFromResponse(response);
        enrichAssetsWithGatewayData();
        gatewaysLoaded.value = true;
        return gateways.value;
    }

    /**
     * Loads asset settings from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchAssetSettings(organizationId) {
        if (!organizationId) {
            assetSettings.value = [];
            assetSettingsLoaded.value = false;
            return assetSettings.value;
        }

        const response = await assetManagementApi.getAssetSettings(organizationId);
        assetSettings.value = AssetSettingsAssembler.toEntitiesFromResponse(response);
        assetSettingsLoaded.value = true;
        return assetSettings.value;
    }

    /**
     * Loads locations from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchLocations(organizationId) {
        if (!organizationId) {
            locations.value = [];
            locationsLoaded.value = false;
            return locations.value;
        }

        const response = await assetManagementApi.getLocations(organizationId);
        locations.value = LocationAssembler.toEntitiesFromResponse(response);
        locationsLoaded.value = true;
        return locations.value;
    }

    /**
     * Loads asset management data from the API and updates application state.
     *
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function fetchAssetManagementData({organizationId, includeSettings = true} = {}) {
        loading.value = true;
        errors.value = [];
        try {
            if (!organizationId) {
                assets.value = [];
                iotDevices.value = [];
                gateways.value = [];
                locations.value = [];
                if (includeSettings) assetSettings.value = [];
                return {assets: assets.value, iotDevices: iotDevices.value, gateways: gateways.value, locations: locations.value, assetSettings: assetSettings.value};
            }

            const loadedLocations = await fetchLocations(organizationId);
            const requests = [fetchGateways(organizationId, loadedLocations), fetchAssets(organizationId), fetchIoTDevices(organizationId)];
            if (includeSettings) requests.push(fetchAssetSettings(organizationId));
            await Promise.all(requests);
            enrichAssetsWithGatewayData();
            return {assets: assets.value, iotDevices: iotDevices.value, gateways: gateways.value, locations: locations.value, assetSettings: assetSettings.value};
        } catch (error) {
            errors.value.push(error);
            throw error;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Refreshes backend-owned operational state without changing the loading state of the active view.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    async function refreshOrganizationOperationalState(organizationId) {
        if (!organizationId) {
            return {
                assets: assets.value,
                iotDevices: iotDevices.value,
                gateways: gateways.value,
                locations: locations.value,
                assetSettings: assetSettings.value,
            };
        }

        const loadedLocations = await fetchLocations(organizationId);
        await Promise.all([
            fetchGateways(organizationId, loadedLocations),
            fetchAssets(organizationId),
            fetchIoTDevices(organizationId),
            fetchAssetSettings(organizationId),
        ]);
        enrichAssetsWithGatewayData();

        return {
            assets: assets.value,
            iotDevices: iotDevices.value,
            gateways: gateways.value,
            locations: locations.value,
            assetSettings: assetSettings.value,
        };
    }

    /**
     * Creates asset in the asset management context.
     *
     * @param {*} asset
     * @returns {Promise<*>}
     */
    async function createAsset(asset) {
        const response = await assetManagementApi.createAsset(asset.organizationId, AssetAssembler.toResourceFromEntity(asset));
        const createdAsset = enrichAssetWithGatewayData(AssetAssembler.toEntityFromResource(response.data));
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
        const response = await assetManagementApi.updateAsset(asset.organizationId, AssetAssembler.toResourceFromEntity(asset));
        const updatedAsset = enrichAssetWithGatewayData(AssetAssembler.toEntityFromResource(response.data));
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
        if (!assetSettingsLoaded.value) await fetchAssetSettings(asset.organizationId);

        const linkedDevices = iotDevices.value.filter(iotDevice => iotDevice.assetId === asset.id);
        const linkedSettings = assetSettings.value.filter(settings => settings.assetId === asset.id);

        await Promise.all(linkedDevices.map(iotDevice =>
            updateIoTDevice(new IoTDevice({...iotDevice, assetId: null, status: IoTDeviceStatus.Available})),
        ));
        await Promise.all(linkedSettings.map(settings => assetManagementApi.deleteAssetSettings(settings.organizationId, settings.id)));
        await assetManagementApi.deleteAsset(asset.organizationId, asset.id);

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
        const response = await assetManagementApi.createIoTDevice(iotDevice.organizationId, IoTDeviceAssembler.toResourceFromEntity(iotDevice));
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
        const response = await assetManagementApi.updateIoTDevice(iotDevice.organizationId, IoTDeviceAssembler.toResourceFromEntity(iotDevice));
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
        await assetManagementApi.deleteIoTDevice(iotDevice.organizationId, iotDevice.id);
        iotDevices.value = iotDevices.value.filter(current => current.id !== iotDevice.id);
    }

    /**
     * Creates gateway in the asset management context.
     *
     * @param {*} gateway
     * @returns {Promise<*>}
     */
    async function createGateway(gateway) {
        const response = await assetManagementApi.createGateway(gateway.organizationId, GatewayAssembler.toResourceFromEntity(gateway));
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
        const response = await assetManagementApi.updateGateway(gateway.organizationId, GatewayAssembler.toResourceFromEntity(gateway));
        const updatedGateway = GatewayAssembler.toEntityFromResource(response.data);
        gateways.value = gateways.value.map(current => current.id === updatedGateway.id ? updatedGateway : current);
        enrichAssetsWithGatewayData();
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
            updateAsset(new Asset({...asset, gatewayId: null, locationId: asset.locationId ?? gateway.locationId, location: asset.location || gateway.location})),
        ));
        await assetManagementApi.deleteGateway(gateway.organizationId, gateway.id);
        gateways.value = gateways.value.filter(current => current.id !== gateway.id);
    }

    /**
     * Creates location in the asset management context.
     *
     * @param {*} location
     * @returns {Promise<*>}
     */
    async function createLocation(location) {
        const response = await assetManagementApi.createLocation(location.organizationId, LocationAssembler.toResourceFromEntity(location));
        const createdLocation = LocationAssembler.toEntityFromResource(response.data);
        locations.value.push(createdLocation);
        return createdLocation;
    }

    /**
     * Updates location in the asset management context.
     *
     * @param {*} location
     * @returns {Promise<*>}
     */
    async function updateLocation(location) {
        const response = await assetManagementApi.updateLocation(location.organizationId, LocationAssembler.toResourceFromEntity(location));
        const updatedLocation = LocationAssembler.toEntityFromResource(response.data);
        locations.value = locations.value.map(current => current.id === updatedLocation.id ? updatedLocation : current);
        gateways.value = gateways.value.map(gateway => gateway.locationId === updatedLocation.id
            ? new Gateway({...gateway, location: updatedLocation.name})
            : gateway);
        enrichAssetsWithGatewayData();
        return updatedLocation;
    }

    /**
     * Creates asset settings in the asset management context.
     *
     * @param {*} settings
     * @returns {Promise<*>}
     */
    async function createAssetSettings(settings) {
        const response = await assetManagementApi.createAssetSettings(settings.organizationId, AssetSettingsAssembler.toResourceFromEntity(settings));
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
        const response = await assetManagementApi.updateAssetSettings(settings.organizationId, AssetSettingsAssembler.toResourceFromEntity(settings));
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
        return assets.value.filter(asset => asset.organizationId === Number(organizationId) && hasAssetIssue(asset)).length;
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
        return availableAssets.filter(asset => asset.organizationId === Number(organizationId));
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
        return availableDevices.filter(iotDevice => iotDevice.organizationId === Number(organizationId));
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
        return availableGateways.filter(gateway => gateway.organizationId === Number(organizationId));
    }

    /**
     * Handles locations for organization behavior in the asset management context.
     *
     * @param {number|string} organizationId
     * @param {*} availableLocations
     * @returns {*}
     */
    function locationsForOrganization(organizationId, availableLocations = locations.value) {
        if (!organizationId) return [];
        return availableLocations.filter(location => location.organizationId === Number(organizationId));
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
        return availableSettings.filter(settings => settings.organizationId === Number(organizationId));
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
    function locationForAsset(asset, availableGateways = gateways.value, availableLocations = locations.value) {
        const gateway = gatewayForAsset(asset, availableGateways);
        const location = availableLocations.find(current => current.id === Number(asset.locationId));
        return gateway?.location ?? location?.name ?? asset.location;
    }

    /**
     * Handles location name by id behavior in the asset management context.
     *
     * @param {number|string} locationId
     * @param {*} availableLocations
     * @returns {string}
     */
    function locationNameById(locationId, availableLocations = locations.value) {
        if (!locationId) return 'N/A';
        return availableLocations.find(location => location.id === Number(locationId))?.name ?? 'N/A';
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
     * Handles gateway for asset behavior in the asset management context.
     *
     * @param {*} asset
     * @param {*} availableGateways
     * @returns {*}
     */
    function gatewayForAsset(asset, availableGateways = gateways.value) {
        if (!asset) return null;
        return availableGateways.find(gateway => gateway.id === Number(asset.gatewayId)) ??
            availableGateways.find(gateway => asset.locationId !== null && gateway.locationId === Number(asset.locationId)) ??
            null;
    }

    /**
     * Enriches loaded assets with location and gateway display data preserved by the UI.
     *
     * @returns {void}
     */
    function enrichAssetsWithGatewayData() {
        assets.value = assets.value.map(asset => enrichAssetWithGatewayData(asset));
    }

    /**
     * Enriches one asset with matching gateway display data.
     *
     * @param {*} asset
     * @returns {*}
     */
    function enrichAssetWithGatewayData(asset) {
        const gateway = gatewayForAsset(asset);
        if (!gateway) return asset;
        return new Asset({
            ...asset,
            gatewayId: asset.gatewayId ?? gateway.id,
            locationId: asset.locationId ?? gateway.locationId,
            location: asset.location || gateway.location,
        });
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

    return {
        assets,
        iotDevices,
        gateways,
        locations,
        assetSettings,
        errors,
        loading,
        assetsLoaded,
        iotDevicesLoaded,
        gatewaysLoaded,
        locationsLoaded,
        assetSettingsLoaded,
        assetCount,
        fetchAssets,
        fetchIoTDevices,
        fetchGateways,
        fetchLocations,
        fetchAssetSettings,
        fetchAssetManagementData,
        refreshOrganizationOperationalState,
        createAsset,
        updateAsset,
        deleteAsset,
        createIoTDevice,
        updateIoTDevice,
        deleteIoTDevice,
        createGateway,
        updateGateway,
        deleteGateway,
        createLocation,
        updateLocation,
        createAssetSettings,
        updateAssetSettings,
        assetIssueCountFor,
        assetsForOrganization,
        iotDevicesForOrganization,
        gatewaysForOrganization,
        locationsForOrganization,
        assetSettingsForOrganization,
        defaultSettingsForOrganization,
        locationForAsset,
        locationNameById,
        locationForGateway,
        gatewayForAsset,
        monitoredAssetsForOrganization,
        iotDevicesForAsset,
        settingsForAsset,
        nextAssetSettingsId,
        operationalSummaryFor,
    };
});

export default useAssetManagementStore;
