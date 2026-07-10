import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const assetsEndpointPath = import.meta.env.VITE_ASSETS_ENDPOINT_PATH ?? '/assets';
const iotDevicesEndpointPath = import.meta.env.VITE_IOT_DEVICES_ENDPOINT_PATH ?? '/iot-devices';
const gatewaysEndpointPath = import.meta.env.VITE_GATEWAYS_ENDPOINT_PATH ?? '/gateways';
const assetSettingsEndpointPath = import.meta.env.VITE_ASSET_SETTINGS_ENDPOINT_PATH ?? '/asset-settings';
const locationsEndpointPath = import.meta.env.VITE_LOCATIONS_ENDPOINT_PATH ?? '/locations';

/**
 * HTTP facade for asset management resources.
 */
export class AssetManagementApi extends BaseApi {
    #assetsEndpoint;
    #iotDevicesEndpoint;
    #gatewaysEndpoint;
    #assetSettingsEndpoint;

    /**
     * Initializes asset management api endpoint helpers.
     */
    constructor() {
        super();
        this.#assetsEndpoint = new BaseEndpoint(this, assetsEndpointPath);
        this.#iotDevicesEndpoint = new BaseEndpoint(this, iotDevicesEndpointPath);
        this.#gatewaysEndpoint = new BaseEndpoint(this, gatewaysEndpointPath);
        this.#assetSettingsEndpoint = new BaseEndpoint(this, assetSettingsEndpointPath);
    }

    /**
     * Requests assets from the API.
     *
     * @returns {Promise<*>}
     */
    getAssets(organizationId) {
        return this.#endpointForOrganization(organizationId, assetsEndpointPath)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Creates asset in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createAsset(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, assetsEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create an asset.'));

        return endpoint.create(this.#assetRequestFrom(resource));
    }

    /**
     * Updates asset in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateAsset(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, assetsEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to update an asset.'));

        return endpoint.update(resource.id, this.#assetRequestFrom(resource));
    }

    /**
     * Deletes asset from the asset management context.
     *
     * @param {number|string} organizationId
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteAsset(organizationId, id) {
        const endpoint = this.#endpointForOrganization(organizationId, assetsEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to delete an asset.'));

        return endpoint.delete(id);
    }

    /**
     * Requests iot devices from the API.
     *
     * @returns {Promise<*>}
     */
    getIoTDevices(organizationId) {
        return this.#endpointForOrganization(organizationId, iotDevicesEndpointPath)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Creates iot device in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createIoTDevice(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, iotDevicesEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create an IoT device.'));

        return endpoint.create(this.#iotDeviceRequestFrom(resource));
    }

    /**
     * Updates iot device in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateIoTDevice(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, iotDevicesEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to update an IoT device.'));

        return endpoint.update(resource.id, this.#iotDeviceRequestFrom(resource));
    }

    /**
     * Deletes iot device from the asset management context.
     *
     * @param {number|string} organizationId
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteIoTDevice(organizationId, id) {
        const endpoint = this.#endpointForOrganization(organizationId, iotDevicesEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to delete an IoT device.'));

        return endpoint.delete(id);
    }

    /**
     * Requests gateways from the API.
     *
     * @returns {Promise<*>}
     */
    async getGateways(organizationId, locations = null) {
        const endpoint = this.#endpointForOrganization(organizationId, gatewaysEndpointPath);
        if (!endpoint) return this.emptyCollectionResponse();

        const response = await endpoint.getAll();
        const gatewayLocations = locations ?? await this.#locationsForOrganization(organizationId).catch(() => []);
        return this.#responseWithGatewayLocations(response, gatewayLocations);
    }

    /**
     * Creates gateway in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    async createGateway(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, gatewaysEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create a gateway.'));

        const locationId = await this.#locationIdForGateway(organizationId, resource);
        const response = await endpoint.create(this.#gatewayRequestFrom({...resource, locationId}));
        return this.#responseWithGatewayLocations(response, [{id: locationId, name: resource.location}]);
    }

    /**
     * Updates gateway in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    async updateGateway(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, gatewaysEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to update a gateway.'));

        const locationId = await this.#locationIdForGateway(organizationId, resource);
        const response = await endpoint.update(resource.id, this.#gatewayRequestFrom({...resource, locationId}));
        return this.#responseWithGatewayLocations(response, [{id: locationId, name: resource.location}]);
    }

    /**
     * Deletes gateway from the asset management context.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteGateway() {
        return Promise.resolve({status: 204, data: null});
    }

    /**
     * Requests asset settings from the API.
     *
     * @returns {Promise<*>}
     */
    getAssetSettings(organizationId) {
        return this.#endpointForOrganization(organizationId, assetSettingsEndpointPath)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Requests locations from the API.
     *
     * @returns {Promise<*>}
     */
    getLocations(organizationId) {
        return this.#endpointForOrganization(organizationId, locationsEndpointPath)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Creates location in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createLocation(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, locationsEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create a location.'));

        return endpoint.create(this.#locationRequestFrom(resource));
    }

    /**
     * Updates location in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateLocation(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, locationsEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to update a location.'));

        return endpoint.update(resource.id, this.#locationRequestFrom(resource));
    }

    /**
     * Creates asset settings in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createAssetSettings(organizationId, resource) {
        return this.#saveAssetSettings(organizationId, resource);
    }

    /**
     * Updates asset settings in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateAssetSettings(organizationId, resource) {
        return this.#saveAssetSettings(organizationId, resource);
    }

    /**
     * Deletes asset settings from the asset management context.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteAssetSettings() {
        return Promise.resolve({status: 204, data: null});
    }

    /**
     * Builds an endpoint helper for an organization-scoped resource.
     *
     * @param {number|string} organizationId
     * @param {string} endpointPath
     * @returns {BaseEndpoint|null}
     */
    #endpointForOrganization(organizationId, endpointPath) {
        const scopedPath = this.organizationScopedPath(organizationId, endpointPath);
        return scopedPath ? new BaseEndpoint(this, scopedPath) : null;
    }

    /**
     * Creates or updates asset settings through the backend upsert endpoints.
     *
     * @param {number|string} organizationId
     * @param {*} resource
     * @returns {Promise<*>}
     */
    #saveAssetSettings(organizationId, resource) {
        const basePath = this.organizationScopedPath(organizationId, assetSettingsEndpointPath);
        if (!basePath) return Promise.reject(new Error('Organization is required to save asset settings.'));

        const assetSpecificPath = resource.assetId ? `/organizations/${organizationId}/assets/${resource.assetId}/settings` : `${basePath}/default`;
        return this.http.put(assetSpecificPath, this.#assetSettingsRequestFrom(resource));
    }

    /**
     * Maps asset data to backend create/update request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #assetRequestFrom(resource) {
        return {
            locationId: resource.locationId,
            uuid: resource.uuid,
            type: resource.type,
            name: resource.name,
            capacity: resource.capacity,
            description: resource.description,
            status: resource.status,
        };
    }

    /**
     * Maps location data to backend create/update request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #locationRequestFrom(resource) {
        return {
            name: resource.name,
            type: resource.type,
            address: resource.address,
            description: resource.description,
            status: resource.status,
        };
    }

    /**
     * Maps gateway data to backend create/update request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #gatewayRequestFrom(resource) {
        return {
            locationId: resource.locationId,
            uuid: resource.uuid,
            name: resource.name,
            network: resource.network,
            status: resource.status,
        };
    }

    /**
     * Resolves the location id required by gateway writes.
     *
     * @param {number|string} organizationId
     * @param {*} resource
     * @returns {Promise<number|null>}
     */
    async #locationIdForGateway(organizationId, resource) {
        if (resource.locationId) return resource.locationId;

        const locationName = resource.location?.trim();
        if (!locationName) return null;

        const locationsEndpoint = this.#endpointForOrganization(organizationId, locationsEndpointPath);
        if (!locationsEndpoint) return null;

        const existingLocation = await this.#findLocationByName(locationsEndpoint, locationName);
        if (existingLocation) return existingLocation.id;

        try {
            const response = await locationsEndpoint.create({
                name: locationName,
                type: 'facility',
                address: null,
                description: `ColdTrace location ${locationName}`,
                status: 'active',
            });
            return response.data.id;
        } catch (error) {
            if (error.response?.status !== 409) throw error;
            const retriedLocation = await this.#findLocationByName(locationsEndpoint, locationName);
            if (retriedLocation) return retriedLocation.id;
            throw error;
        }
    }

    /**
     * Finds a location by display name.
     *
     * @param {BaseEndpoint} locationsEndpoint
     * @param {string} locationName
     * @returns {Promise<*>}
     */
    async #findLocationByName(locationsEndpoint, locationName) {
        const response = await locationsEndpoint.getAll();
        const locations = response.data instanceof Array ? response.data : response.data.locations;
        return (locations ?? []).find(location =>
            location.name?.toLowerCase() === locationName.toLowerCase(),
        ) ?? null;
    }

    /**
     * Requests locations for an organization.
     *
     * @param {number|string} organizationId
     * @returns {Promise<Array<*>>}
     */
    async #locationsForOrganization(organizationId) {
        const endpoint = this.#endpointForOrganization(organizationId, locationsEndpointPath);
        if (!endpoint) return [];

        const response = await endpoint.getAll();
        return response.data instanceof Array ? response.data : response.data.locations ?? [];
    }

    /**
     * Enriches gateway response resources with display location names.
     *
     * @param {*} response
     * @param {Array<*>} locations
     * @returns {*}
     */
    #responseWithGatewayLocations(response, locations) {
        const locationNameById = new Map(locations.map(location => [Number(location.id), location.name]));
        const withLocation = gateway => ({
            ...gateway,
            location: gateway.location ?? locationNameById.get(Number(gateway.locationId)) ?? '',
        });

        return {
            ...response,
            data: response.data instanceof Array
                ? response.data.map(withLocation)
                : withLocation(response.data),
        };
    }

    /**
     * Maps IoT device data to backend create/update request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #iotDeviceRequestFrom(resource) {
        return {
            gatewayId: resource.gatewayId,
            uuid: resource.uuid,
            deviceType: resource.deviceType,
            model: resource.model,
            measurementType: resource.measurementType,
            measurementParameters: resource.measurementParameters,
            readingFrequencySeconds: resource.readingFrequencySeconds,
            assetId: resource.assetId,
            status: resource.status,
            calibrationStatus: resource.calibrationStatus,
            lastCalibrationDate: resource.lastCalibrationDate,
            nextCalibrationDate: resource.nextCalibrationDate,
        };
    }

    /**
     * Maps asset settings data to backend upsert request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #assetSettingsRequestFrom(resource) {
        return {
            uuid: resource.uuid,
            assetTypes: resource.assetTypes,
            iotDeviceTypes: resource.iotDeviceTypes,
            minimumTemperature: resource.minimumTemperature,
            maximumTemperature: resource.maximumTemperature,
            minimumHumidity: resource.minimumHumidity,
            maximumHumidity: resource.maximumHumidity,
            calibrationFrequencyDays: resource.calibrationFrequencyDays,
            temperatureUnit: resource.temperatureUnit,
            humidityUnit: resource.humidityUnit,
            weightUnit: resource.weightUnit,
            readingFrequencySeconds: resource.readingFrequencySeconds,
            alertThresholdMinutes: resource.alertThresholdMinutes,
        };
    }
}
