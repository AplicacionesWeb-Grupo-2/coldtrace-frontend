import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const assetsEndpointPath = import.meta.env.VITE_ASSETS_ENDPOINT_PATH ?? '/assets';
const iotDevicesEndpointPath = import.meta.env.VITE_IOT_DEVICES_ENDPOINT_PATH ?? '/iot-devices';
const gatewaysEndpointPath = import.meta.env.VITE_GATEWAYS_ENDPOINT_PATH ?? '/gateways';
const assetSettingsEndpointPath = import.meta.env.VITE_ASSET_SETTINGS_ENDPOINT_PATH ?? '/asset-settings';

export class AssetManagementApi extends BaseApi {
    #assetsEndpoint;
    #iotDevicesEndpoint;
    #gatewaysEndpoint;
    #assetSettingsEndpoint;

    constructor() {
        super();
        this.#assetsEndpoint = new BaseEndpoint(this, assetsEndpointPath);
        this.#iotDevicesEndpoint = new BaseEndpoint(this, iotDevicesEndpointPath);
        this.#gatewaysEndpoint = new BaseEndpoint(this, gatewaysEndpointPath);
        this.#assetSettingsEndpoint = new BaseEndpoint(this, assetSettingsEndpointPath);
    }

    getAssets() {
        return this.#assetsEndpoint.getAll();
    }

    createAsset(resource) {
        return this.#assetsEndpoint.create(resource);
    }

    updateAsset(resource) {
        return this.#assetsEndpoint.update(resource.id, resource);
    }

    deleteAsset(id) {
        return this.#assetsEndpoint.delete(id);
    }

    getIoTDevices() {
        return this.#iotDevicesEndpoint.getAll();
    }

    createIoTDevice(resource) {
        return this.#iotDevicesEndpoint.create(resource);
    }

    updateIoTDevice(resource) {
        return this.#iotDevicesEndpoint.update(resource.id, resource);
    }

    deleteIoTDevice(id) {
        return this.#iotDevicesEndpoint.delete(id);
    }

    getGateways() {
        return this.#gatewaysEndpoint.getAll();
    }

    createGateway(resource) {
        return this.#gatewaysEndpoint.create(resource);
    }

    updateGateway(resource) {
        return this.#gatewaysEndpoint.update(resource.id, resource);
    }

    deleteGateway(id) {
        return this.#gatewaysEndpoint.delete(id);
    }

    getAssetSettings() {
        return this.#assetSettingsEndpoint.getAll();
    }

    createAssetSettings(resource) {
        return this.#assetSettingsEndpoint.create(resource);
    }

    updateAssetSettings(resource) {
        return this.#assetSettingsEndpoint.update(resource.id, resource);
    }

    deleteAssetSettings(id) {
        return this.#assetSettingsEndpoint.delete(id);
    }
}
