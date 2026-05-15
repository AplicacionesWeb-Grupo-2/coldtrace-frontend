import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const assetsEndpointPath = import.meta.env.VITE_ASSETS_ENDPOINT_PATH ?? '/assets';
const iotDevicesEndpointPath = import.meta.env.VITE_IOT_DEVICES_ENDPOINT_PATH ?? '/iot-devices';
const gatewaysEndpointPath = import.meta.env.VITE_GATEWAYS_ENDPOINT_PATH ?? '/gateways';
const assetSettingsEndpointPath = import.meta.env.VITE_ASSET_SETTINGS_ENDPOINT_PATH ?? '/asset-settings';

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
    getAssets() {
        return this.#assetsEndpoint.getAll();
    }

    /**
     * Creates asset in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createAsset(resource) {
        return this.#assetsEndpoint.create(resource);
    }

    /**
     * Updates asset in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateAsset(resource) {
        return this.#assetsEndpoint.update(resource.id, resource);
    }

    /**
     * Deletes asset from the asset management context.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteAsset(id) {
        return this.#assetsEndpoint.delete(id);
    }

    /**
     * Requests iot devices from the API.
     *
     * @returns {Promise<*>}
     */
    getIoTDevices() {
        return this.#iotDevicesEndpoint.getAll();
    }

    /**
     * Creates iot device in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createIoTDevice(resource) {
        return this.#iotDevicesEndpoint.create(resource);
    }

    /**
     * Updates iot device in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateIoTDevice(resource) {
        return this.#iotDevicesEndpoint.update(resource.id, resource);
    }

    /**
     * Deletes iot device from the asset management context.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteIoTDevice(id) {
        return this.#iotDevicesEndpoint.delete(id);
    }

    /**
     * Requests gateways from the API.
     *
     * @returns {Promise<*>}
     */
    getGateways() {
        return this.#gatewaysEndpoint.getAll();
    }

    /**
     * Creates gateway in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createGateway(resource) {
        return this.#gatewaysEndpoint.create(resource);
    }

    /**
     * Updates gateway in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateGateway(resource) {
        return this.#gatewaysEndpoint.update(resource.id, resource);
    }

    /**
     * Deletes gateway from the asset management context.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteGateway(id) {
        return this.#gatewaysEndpoint.delete(id);
    }

    /**
     * Requests asset settings from the API.
     *
     * @returns {Promise<*>}
     */
    getAssetSettings() {
        return this.#assetSettingsEndpoint.getAll();
    }

    /**
     * Creates asset settings in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createAssetSettings(resource) {
        return this.#assetSettingsEndpoint.create(resource);
    }

    /**
     * Updates asset settings in the asset management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateAssetSettings(resource) {
        return this.#assetSettingsEndpoint.update(resource.id, resource);
    }

    /**
     * Deletes asset settings from the asset management context.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteAssetSettings(id) {
        return this.#assetSettingsEndpoint.delete(id);
    }
}
