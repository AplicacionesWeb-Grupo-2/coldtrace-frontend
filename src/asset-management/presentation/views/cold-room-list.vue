<script setup>
import {computed, onMounted, reactive, ref, watch} from 'vue';
import {storeToRefs} from 'pinia';
import {useI18n} from 'vue-i18n';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import useMonitoringStore from '@/monitoring/application/monitoring.store.js';
import {Asset} from '@/asset-management/domain/model/asset-entity.js';
import {AssetStatus} from '@/asset-management/domain/model/asset-status.js';
import {AssetType} from '@/asset-management/domain/model/asset-type.js';
import {CalibrationStatus} from '@/asset-management/domain/model/calibration-status.js';
import {ConnectivityStatus} from '@/asset-management/domain/model/connectivity-status.js';
import {Gateway} from '@/asset-management/domain/model/gateway-entity.js';
import {GatewayStatus} from '@/asset-management/domain/model/gateway-status.js';
import {IoTDevice} from '@/asset-management/domain/model/iot-device-entity.js';
import {IoTDeviceStatus} from '@/asset-management/domain/model/iot-device-status.js';
import {IOT_DEVICE_DEFINITIONS} from '@/asset-management/domain/model/iot-device-definitions.js';
import {Location} from '@/asset-management/domain/model/location-entity.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';

const {t, locale} = useI18n();
const assetManagementStore = useAssetManagementStore();
const identityAccessStore = useIdentityAccessStore();
const monitoringStore = useMonitoringStore();
const {assets, iotDevices, gateways, locations, loading, errors} = storeToRefs(assetManagementStore);

const assetTypeTabs = [AssetType.ColdRoom, AssetType.Transport, 'location', 'gateway', 'iot-device'];
const assetStatuses = [AssetStatus.Active, AssetStatus.Maintenance, AssetStatus.Inactive];
const iotDeviceDefinitions = IOT_DEVICE_DEFINITIONS;
const iotDeviceTypes = iotDeviceDefinitions.map(definition => definition.type);
const gatewayStatuses = [GatewayStatus.Active, GatewayStatus.Maintenance, GatewayStatus.Offline];
const iotDeviceStatuses = [IoTDeviceStatus.Linked, IoTDeviceStatus.Available, IoTDeviceStatus.Offline];
const calibrationStatuses = [
    CalibrationStatus.Compliant,
    CalibrationStatus.DueSoon,
    CalibrationStatus.Expired,
    CalibrationStatus.Unknown,
];
const locationTypes = ['WAREHOUSE', 'CLIENT_SITE', 'ROUTE', 'LABORATORY', 'DISTRIBUTION_CENTER'];
const locationStatuses = ['active', 'maintenance', 'inactive'];
const locationTypeFormAliases = {
    facility: 'WAREHOUSE',
    'transport-route': 'ROUTE',
};

const identityLoading = ref(false);
const creating = ref(false);
const updatingAssetId = ref(null);
const editingAssetId = ref(null);
const editingIoTDeviceId = ref(null);
const editingGatewayId = ref(null);
const editingLocationId = ref(null);
const deletingResourceKey = ref('');
const pendingAssetStatuses = ref({});
const submitted = ref(false);
const formVisible = ref(false);
const feedback = ref('idle');
const searchTerm = ref('');
const selectedTab = ref(AssetType.ColdRoom);
const pageSize = 10;
const assetPage = ref(1);
const iotDevicePage = ref(1);
const gatewayPage = ref(1);
const locationPage = ref(1);
const users = ref([]);
const roles = ref([]);
const organizations = ref([]);

const coldRoomForm = reactive({
    internalId: '',
    name: '',
    locationId: 0,
    capacity: 0,
    description: '',
    status: AssetStatus.Active,
});
const iotDeviceForm = reactive({
    internalId: '',
    gatewayId: 0,
    deviceType: '',
    model: '',
    measurementType: '',
    assetId: 0,
    status: IoTDeviceStatus.Available,
    calibrationStatus: CalibrationStatus.Unknown,
    lastCalibrationDate: '',
    nextCalibrationDate: '',
    readingFrequencyMinutes: 60,
});
const gatewayForm = reactive({
    internalId: '',
    name: '',
    locationId: 0,
    network: '',
    status: GatewayStatus.Active,
});
const locationForm = reactive({
    name: '',
    type: 'WAREHOUSE',
    address: '',
    description: '',
    status: 'active',
});

const pageLoading = computed(() => identityLoading.value || loading.value);
const activeOrganizationId = computed(() => identityAccessStore.currentOrganizationIdFrom(users.value));
const canManageAssets = computed(() => identityAccessStore.canManageAssets(users.value, roles.value));
const canDeleteAssetResources = computed(() => identityAccessStore.canDeleteAssetResources(users.value, roles.value));
const selectedAssetType = computed(() =>
    selectedTab.value === AssetType.Transport ? AssetType.Transport : AssetType.ColdRoom,
);
const isAssetTab = computed(() =>
    selectedTab.value === AssetType.ColdRoom || selectedTab.value === AssetType.Transport,
);
const canCreateSelectedResource = computed(() =>
    isAssetTab.value || selectedTab.value === 'location' || selectedTab.value === 'iot-device' || selectedTab.value === 'gateway',
);
const positiveFeedback = computed(() =>
    [
        'success',
        'updated',
        'asset-updated',
        'iot-device-created',
        'iot-device-updated',
        'gateway-created',
        'gateway-updated',
        'location-created',
        'location-updated',
        'asset-deleted',
        'iot-device-deleted',
        'gateway-deleted',
    ].includes(feedback.value),
);
const organizationAssets = computed(() => {
    const organizationId = activeOrganizationId.value;
    return organizationId ? assets.value.filter(asset => asset.organizationId === organizationId) : [];
});
const selectedAssets = computed(() =>
    organizationAssets.value.filter(asset => asset.type === selectedAssetType.value),
);
const organizationIoTDevices = computed(() => {
    const organizationId = activeOrganizationId.value;
    return organizationId ? iotDevices.value.filter(iotDevice => iotDevice.organizationId === organizationId) : [];
});
const organizationGateways = computed(() => {
    const organizationId = activeOrganizationId.value;
    return organizationId ? gateways.value.filter(gateway => gateway.organizationId === organizationId) : [];
});
const organizationLocations = computed(() =>
    assetManagementStore.locationsForOrganization(activeOrganizationId.value, locations.value),
);
const filteredLocations = computed(() => {
    const normalizedSearch = searchTerm.value.trim().toLowerCase();
    if (!normalizedSearch) return organizationLocations.value;

    return organizationLocations.value.filter(location =>
        [
            location.name,
            location.type,
            location.address,
            location.description,
            location.status,
        ].join(' ').toLowerCase().includes(normalizedSearch),
    );
});
const calibrationSummary = computed(() => [
    {status: CalibrationStatus.Compliant, count: calibrationCount(CalibrationStatus.Compliant)},
    {status: CalibrationStatus.DueSoon, count: calibrationCount(CalibrationStatus.DueSoon)},
    {status: CalibrationStatus.Expired, count: calibrationCount(CalibrationStatus.Expired)},
    {status: CalibrationStatus.Unknown, count: calibrationCount(CalibrationStatus.Unknown)},
]);
const filteredAssets = computed(() => {
    const normalizedSearch = searchTerm.value.trim().toLowerCase();
    if (!normalizedSearch) return selectedAssets.value;

    return selectedAssets.value.filter(asset =>
        [
            asset.uuid,
            asset.name,
            assetLocationFor(asset),
            asset.status,
            displayedConnectivity(asset),
            asset.lastIncident,
            gatewayNameForAsset(asset),
        ].join(' ').toLowerCase().includes(normalizedSearch),
    );
});
const paginatedAssets = computed(() => paginate(filteredAssets.value, assetPage.value));
const paginatedIoTDevices = computed(() => paginate(organizationIoTDevices.value, iotDevicePage.value));
const paginatedGateways = computed(() => paginate(organizationGateways.value, gatewayPage.value));
const paginatedLocations = computed(() => paginate(filteredLocations.value, locationPage.value));
const assetFormErrors = computed(() => ({
    internalId: coldRoomForm.internalId.trim().length < 3,
    name: coldRoomForm.name.trim().length < 3,
    locationId: Number(coldRoomForm.locationId) < 1,
    capacity: Number(coldRoomForm.capacity) < 1,
}));
const iotDeviceFormErrors = computed(() => ({
    internalId: iotDeviceForm.internalId.trim().length < 3,
    gatewayId: Number(iotDeviceForm.gatewayId) < 1,
    deviceType: !iotDeviceForm.deviceType,
    model: iotDeviceForm.model.trim().length < 3,
    measurementType: !iotDeviceForm.measurementType,
    status: !iotDeviceForm.status,
    calibrationStatus: !iotDeviceForm.calibrationStatus,
    readingFrequencyMinutes: Number(iotDeviceForm.readingFrequencyMinutes) < 5 ||
        Number(iotDeviceForm.readingFrequencyMinutes) > 1440,
}));
const gatewayFormErrors = computed(() => ({
    internalId: gatewayForm.internalId.trim().length < 3,
    name: gatewayForm.name.trim().length < 3,
    locationId: Number(gatewayForm.locationId) < 1,
    network: gatewayForm.network.trim().length < 2,
}));
const locationFormErrors = computed(() => ({
    name: locationForm.name.trim().length < 2,
    type: !locationForm.type,
}));

onMounted(() => {
    loadPageData();
});

watch([searchTerm, selectedTab], () => {
    assetPage.value = 1;
    iotDevicePage.value = 1;
    gatewayPage.value = 1;
    locationPage.value = 1;
});

/**
 * Loads page data data for the current view or use case.
 *
 * @returns {Promise<*>}
 */
async function loadPageData() {
    identityLoading.value = true;
    feedback.value = 'idle';
    try {
        const accessData = await identityAccessStore.fetchAccessData();
        const organizationId = identityAccessStore.currentOrganizationIdFrom(accessData.users);
        await Promise.all([
            assetManagementStore.fetchAssetManagementData({organizationId, includeSettings: false}),
            monitoringStore.fetchReadings(organizationId),
        ]);
        users.value = accessData.users;
        roles.value = accessData.roles;
        organizations.value = accessData.organizations;
        resetForms();
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        identityLoading.value = false;
    }
}

/**
 * Selects asset type in the current view state.
 *
 * @param {*} tab
 * @returns {void}
 */
function selectAssetType(tab) {
    if (selectedTab.value === tab) return;
    selectedTab.value = tab;
    searchTerm.value = '';
    assetPage.value = 1;
    iotDevicePage.value = 1;
    gatewayPage.value = 1;
    locationPage.value = 1;
    formVisible.value = false;
    feedback.value = 'idle';
    submitted.value = false;
    editingAssetId.value = null;
    editingIoTDeviceId.value = null;
    editingGatewayId.value = null;
    editingLocationId.value = null;
    resetForms();
}

/**
 * Toggles form.
 *
 * @returns {void}
 */
function toggleForm() {
    feedback.value = 'idle';
    submitted.value = false;
    const willOpen = !formVisible.value;
    formVisible.value = willOpen;
    editingAssetId.value = null;
    editingIoTDeviceId.value = null;
    editingGatewayId.value = null;
    editingLocationId.value = null;
    resetForms();
}

/**
 * Handles paginate behavior in the asset management context.
 *
 * @param {Array<*>} items
 * @param {number|string} page
 * @returns {*}
 */
function paginate(items, page) {
    const startIndex = (page - 1) * pageSize;
    return items.slice(startIndex, startIndex + pageSize);
}

/**
 * Handles last page for behavior in the asset management context.
 *
 * @param {Array<*>} items
 * @returns {*}
 */
function lastPageFor(items) {
    return Math.max(Math.ceil(items.length / pageSize), 1);
}

/**
 * Handles submit behavior in the asset management context.
 *
 * @returns {Promise<*>}
 */
async function submit() {
    submitted.value = true;
    feedback.value = 'idle';
    if (isFormInvalid(assetFormErrors.value) || !canManageAssets.value) return;

    const organizationId = activeOrganizationId.value;
    const editingId = editingAssetId.value;
    const locationId = Number(coldRoomForm.locationId);
    const location = organizationLocations.value.find(currentLocation => currentLocation.id === locationId);
    if (!organizationId || !location) {
        feedback.value = 'server-error';
        return;
    }

    const internalId = coldRoomForm.internalId.trim().toUpperCase();
    const duplicatedInternalId = organizationAssets.value.some(
        asset => asset.id !== editingId && asset.uuid.toLowerCase() === internalId.toLowerCase(),
    );
    if (duplicatedInternalId) {
        feedback.value = 'duplicate-id';
        return;
    }

    const currentAsset = editingId
        ? organizationAssets.value.find(asset => asset.id === editingId)
        : null;
    if (editingId && !currentAsset) {
        feedback.value = 'server-error';
        return;
    }

    const asset = new Asset({
        id: editingId ?? Math.max(...assets.value.map(currentAsset => currentAsset.id), 0) + 1,
        organizationId,
        uuid: internalId,
        type: selectedAssetType.value,
        locationId: location.id,
        gatewayId: currentAsset?.gatewayId ?? null,
        name: coldRoomForm.name.trim(),
        location: location.name,
        capacity: Number(coldRoomForm.capacity),
        description: coldRoomForm.description.trim(),
        status: coldRoomForm.status,
        lastIncident: currentAsset?.lastIncident ?? 'none',
        currentTemperature: currentAsset?.currentTemperature ?? '—',
        entryDate: currentAsset?.entryDate ?? entryDate(),
        connectivity: currentAsset?.connectivity ?? ConnectivityStatus.Online,
    });

    creating.value = true;
    try {
        if (editingId) await assetManagementStore.updateAsset(asset);
        else await assetManagementStore.createAsset(asset);
        feedback.value = editingId ? 'asset-updated' : 'success';
        submitted.value = false;
        formVisible.value = false;
        editingAssetId.value = null;
        resetForm();
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        creating.value = false;
    }
}

/**
 * Handles submit iot device behavior in the asset management context.
 *
 * @returns {Promise<*>}
 */
async function submitIoTDevice() {
    submitted.value = true;
    feedback.value = 'idle';
    if (isFormInvalid(iotDeviceFormErrors.value) || !canManageAssets.value) return;

    const organizationId = activeOrganizationId.value;
    if (!organizationId) {
        feedback.value = 'server-error';
        return;
    }

    const editingId = editingIoTDeviceId.value;
    const internalId = iotDeviceForm.internalId.trim().toUpperCase();
    const duplicatedInternalId = organizationIoTDevices.value.some(
        iotDevice => iotDevice.id !== editingId && iotDevice.uuid.toLowerCase() === internalId.toLowerCase(),
    );
    if (duplicatedInternalId) {
        feedback.value = 'duplicate-id';
        return;
    }

    const assetId = Number(iotDeviceForm.assetId) || null;
    const gatewayId = Number(iotDeviceForm.gatewayId);
    const gateway = organizationGateways.value.find(currentGateway => currentGateway.id === gatewayId);
    if (!gateway) {
        feedback.value = 'server-error';
        return;
    }

    const measurementParameters = measurementParametersForDeviceType(iotDeviceForm.deviceType);
    const status = assetId
        ? iotDeviceForm.status
        : iotDeviceForm.status === IoTDeviceStatus.Linked
            ? IoTDeviceStatus.Available
            : iotDeviceForm.status;
    const iotDevice = new IoTDevice({
        id: editingId ?? Math.max(...iotDevices.value.map(currentIoTDevice => currentIoTDevice.id), 0) + 1,
        organizationId,
        gatewayId: gateway.id,
        uuid: internalId,
        deviceType: iotDeviceForm.deviceType,
        model: iotDeviceForm.model.trim(),
        measurementType: measurementTypeLabel(measurementParameters),
        assetId,
        status,
        calibrationStatus: iotDeviceForm.calibrationStatus,
        lastCalibrationDate: iotDeviceForm.lastCalibrationDate.trim() || '—',
        nextCalibrationDate: iotDeviceForm.nextCalibrationDate.trim() || '—',
        measurementParameters,
        readingFrequencySeconds: Number(iotDeviceForm.readingFrequencyMinutes) * 60,
    });

    creating.value = true;
    try {
        if (editingId) await assetManagementStore.updateIoTDevice(iotDevice);
        else await assetManagementStore.createIoTDevice(iotDevice);
        feedback.value = editingId ? 'iot-device-updated' : 'iot-device-created';
        submitted.value = false;
        formVisible.value = false;
        editingIoTDeviceId.value = null;
        resetIoTDeviceForm();
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        creating.value = false;
    }
}

/**
 * Handles submit gateway behavior in the asset management context.
 *
 * @returns {Promise<*>}
 */
async function submitGateway() {
    submitted.value = true;
    feedback.value = 'idle';
    if (isFormInvalid(gatewayFormErrors.value) || !canManageAssets.value) return;

    const organizationId = activeOrganizationId.value;
    if (!organizationId) {
        feedback.value = 'server-error';
        return;
    }

    const editingId = editingGatewayId.value;
    const internalId = gatewayForm.internalId.trim().toUpperCase();
    const duplicatedInternalId = organizationGateways.value.some(
        gateway => gateway.id !== editingId && gateway.uuid.toLowerCase() === internalId.toLowerCase(),
    );
    if (duplicatedInternalId) {
        feedback.value = 'duplicate-id';
        return;
    }

    const locationId = Number(gatewayForm.locationId);
    const location = organizationLocations.value.find(currentLocation => currentLocation.id === locationId);
    if (!location) {
        feedback.value = 'server-error';
        return;
    }

    const gateway = new Gateway({
        id: editingId ?? Math.max(...gateways.value.map(currentGateway => currentGateway.id), 0) + 1,
        organizationId,
        locationId: location.id,
        uuid: internalId,
        name: gatewayForm.name.trim(),
        location: location.name,
        network: gatewayForm.network.trim(),
        status: gatewayForm.status,
    });

    creating.value = true;
    try {
        if (editingId) await assetManagementStore.updateGateway(gateway);
        else await assetManagementStore.createGateway(gateway);
        feedback.value = editingId ? 'gateway-updated' : 'gateway-created';
        submitted.value = false;
        formVisible.value = false;
        editingGatewayId.value = null;
        resetGatewayForm();
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        creating.value = false;
    }
}

/**
 * Handles submit location behavior in the asset management context.
 *
 * @returns {Promise<*>}
 */
async function submitLocation() {
    submitted.value = true;
    feedback.value = 'idle';
    if (isFormInvalid(locationFormErrors.value) || !canManageAssets.value) return;

    const organizationId = activeOrganizationId.value;
    if (!organizationId) {
        feedback.value = 'server-error';
        return;
    }

    const editingId = editingLocationId.value;
    const name = locationForm.name.trim();
    const duplicatedName = organizationLocations.value.some(location =>
        location.id !== editingId && location.name.toLowerCase() === name.toLowerCase(),
    );
    if (duplicatedName) {
        feedback.value = 'duplicate-id';
        return;
    }

    const location = new Location({
        id: editingId ?? nextLocationId(),
        organizationId,
        name,
        type: locationForm.type,
        address: locationForm.address.trim(),
        description: locationForm.description.trim(),
        status: locationForm.status,
    });

    creating.value = true;
    try {
        if (editingId) await assetManagementStore.updateLocation(location);
        else await assetManagementStore.createLocation(location);
        feedback.value = editingId ? 'location-updated' : 'location-created';
        submitted.value = false;
        formVisible.value = false;
        editingLocationId.value = null;
        resetLocationForm();
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        creating.value = false;
    }
}

/**
 * Opens the asset form for editing.
 *
 * @param {*} asset
 * @returns {void}
 */
function editAsset(asset) {
    if (!canManageAssets.value) return;

    selectedTab.value = asset.type;
    feedback.value = 'idle';
    submitted.value = false;
    editingAssetId.value = asset.id;
    editingIoTDeviceId.value = null;
    editingGatewayId.value = null;
    editingLocationId.value = null;
    coldRoomForm.internalId = asset.uuid;
    coldRoomForm.name = asset.name;
    coldRoomForm.locationId = asset.locationId ?? 0;
    coldRoomForm.capacity = asset.capacity;
    coldRoomForm.description = asset.description;
    coldRoomForm.status = asset.status;
    formVisible.value = true;
}

/**
 * Opens the IoT device form for editing.
 *
 * @param {*} iotDevice
 * @returns {void}
 */
function editIoTDevice(iotDevice) {
    if (!canManageAssets.value) return;

    selectedTab.value = 'iot-device';
    feedback.value = 'idle';
    submitted.value = false;
    editingAssetId.value = null;
    editingIoTDeviceId.value = iotDevice.id;
    editingGatewayId.value = null;
    editingLocationId.value = null;
    iotDeviceForm.internalId = iotDevice.uuid;
    iotDeviceForm.gatewayId = iotDevice.gatewayId ?? 0;
    iotDeviceForm.deviceType = iotDevice.deviceType;
    iotDeviceForm.model = iotDevice.model;
    iotDeviceForm.measurementType = measurementTypeLabel(measurementParametersFor(iotDevice));
    iotDeviceForm.assetId = iotDevice.assetId ?? 0;
    iotDeviceForm.status = iotDevice.status;
    iotDeviceForm.calibrationStatus = iotDevice.calibrationStatus;
    iotDeviceForm.lastCalibrationDate = blankIfPlaceholder(iotDevice.lastCalibrationDate);
    iotDeviceForm.nextCalibrationDate = blankIfPlaceholder(iotDevice.nextCalibrationDate);
    iotDeviceForm.readingFrequencyMinutes = Math.max(5, Math.round(iotDevice.readingFrequencySeconds / 60));
    formVisible.value = true;
}

/**
 * Opens the gateway form for editing.
 *
 * @param {*} gateway
 * @returns {void}
 */
function editGateway(gateway) {
    if (!canManageAssets.value) return;

    selectedTab.value = 'gateway';
    feedback.value = 'idle';
    submitted.value = false;
    editingAssetId.value = null;
    editingIoTDeviceId.value = null;
    editingGatewayId.value = gateway.id;
    editingLocationId.value = null;
    gatewayForm.internalId = gateway.uuid;
    gatewayForm.name = gateway.name;
    gatewayForm.locationId = gateway.locationId ?? 0;
    gatewayForm.network = gateway.network;
    gatewayForm.status = gateway.status;
    formVisible.value = true;
}

/**
 * Opens the location form for editing.
 *
 * @param {*} location
 * @returns {void}
 */
function editLocation(location) {
    if (!canManageAssets.value) return;

    feedback.value = 'idle';
    submitted.value = false;
    editingAssetId.value = null;
    editingIoTDeviceId.value = null;
    editingGatewayId.value = null;
    editingLocationId.value = location.id;
    locationForm.name = location.name;
    locationForm.type = locationTypeFormValue(location.type);
    locationForm.address = location.address;
    locationForm.description = location.description;
    locationForm.status = location.status;
    formVisible.value = true;
}

/**
 * Updates asset status in the asset management context.
 *
 * @param {*} asset
 * @param {string} value
 * @returns {Promise<*>}
 */
async function updateAssetStatus(asset, value) {
    feedback.value = 'idle';
    const nextStatus = assetStatuses.find(status => status === value);
    if (!nextStatus || nextStatus === asset.status || !canManageAssets.value) {
        clearPendingAssetStatus(asset.id);
        return;
    }

    pendingAssetStatuses.value = {...pendingAssetStatuses.value, [asset.id]: nextStatus};
    updatingAssetId.value = asset.id;
    try {
        await assetManagementStore.updateAsset(new Asset({...asset, status: nextStatus}));
        feedback.value = 'updated';
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        updatingAssetId.value = null;
        clearPendingAssetStatus(asset.id);
    }
}

/**
 * Deletes asset from the asset management context.
 *
 * @param {*} asset
 * @returns {Promise<*>}
 */
async function deleteAsset(asset) {
    if (!canDeleteAssetResources.value) return;
    if (!window.confirm(t('asset-management.delete-confirm', {name: asset.name}))) return;

    deletingResourceKey.value = resourceKey('asset', asset.id);
    feedback.value = 'idle';
    try {
        await assetManagementStore.deleteAsset(asset);
        feedback.value = 'asset-deleted';
        assetPage.value = Math.min(assetPage.value, lastPageFor(filteredAssets.value));
    } catch {
        feedback.value = 'server-error';
    } finally {
        deletingResourceKey.value = '';
    }
}

/**
 * Deletes iot device from the asset management context.
 *
 * @param {*} iotDevice
 * @returns {Promise<*>}
 */
async function deleteIoTDevice(iotDevice) {
    if (!canDeleteAssetResources.value) return;
    if (!window.confirm(t('asset-management.delete-confirm', {name: iotDevice.uuid}))) return;

    deletingResourceKey.value = resourceKey('iot-device', iotDevice.id);
    feedback.value = 'idle';
    try {
        await assetManagementStore.deleteIoTDevice(iotDevice);
        feedback.value = 'iot-device-deleted';
        iotDevicePage.value = Math.min(iotDevicePage.value, lastPageFor(organizationIoTDevices.value));
    } catch {
        feedback.value = 'server-error';
    } finally {
        deletingResourceKey.value = '';
    }
}

/**
 * Deletes gateway from the asset management context.
 *
 * @param {*} gateway
 * @returns {Promise<*>}
 */
async function deleteGateway(gateway) {
    if (!canDeleteAssetResources.value) return;
    if (!window.confirm(t('asset-management.delete-confirm', {name: gateway.name}))) return;

    deletingResourceKey.value = resourceKey('gateway', gateway.id);
    feedback.value = 'idle';
    try {
        await assetManagementStore.deleteGateway(gateway);
        feedback.value = 'gateway-deleted';
        gatewayPage.value = Math.min(gatewayPage.value, lastPageFor(organizationGateways.value));
    } catch {
        feedback.value = 'server-error';
    } finally {
        deletingResourceKey.value = '';
    }
}

/**
 * Selects iot device type in the current view state.
 *
 * @param {string} deviceType
 * @returns {void}
 */
function selectIoTDeviceType(deviceType) {
    const parameters = measurementParametersForDeviceType(deviceType);
    iotDeviceForm.measurementType = measurementTypeLabel(parameters);
    if (!iotDeviceForm.model.trim()) {
        iotDeviceForm.model = iotDeviceDefinitions.find(definition => definition.type === deviceType)?.modelPlaceholder ?? '';
    }
}

/**
 * Determines whether control error exists.
 *
 * @param {*} controlName
 * @returns {boolean}
 */
function hasControlError(controlName) {
    return assetFormErrors.value[controlName] && submitted.value;
}

/**
 * Determines whether iot device control error exists.
 *
 * @param {*} controlName
 * @returns {boolean}
 */
function hasIoTDeviceControlError(controlName) {
    return iotDeviceFormErrors.value[controlName] && submitted.value;
}

/**
 * Determines whether gateway control error exists.
 *
 * @param {*} controlName
 * @returns {boolean}
 */
function hasGatewayControlError(controlName) {
    return gatewayFormErrors.value[controlName] && submitted.value;
}

/**
 * Determines whether location control error exists.
 *
 * @param {*} controlName
 * @returns {boolean}
 */
function hasLocationControlError(controlName) {
    return locationFormErrors.value[controlName] && submitted.value;
}

/**
 * Determines whether form invalid is true.
 *
 * @param {*} errorsByField
 * @returns {boolean}
 */
function isFormInvalid(errorsByField) {
    return Object.values(errorsByField).some(Boolean);
}

/**
 * Handles asset name for iot device behavior in the asset management context.
 *
 * @param {*} iotDevice
 * @returns {string}
 */
function assetNameForIoTDevice(iotDevice) {
    const asset = assets.value.find(currentAsset => currentAsset.id === iotDevice.assetId);
    return asset ? `${asset.uuid} - ${asset.name}` : 'asset-management.iot-devices.unassigned';
}

/**
 * Handles displayed asset status behavior in the asset management context.
 *
 * @param {*} asset
 * @returns {string}
 */
function displayedAssetStatus(asset) {
    return pendingAssetStatuses.value[asset.id] ?? asset.status;
}

/**
 * Handles gateway name for asset behavior in the asset management context.
 *
 * @param {*} asset
 * @returns {string}
 */
function gatewayNameForAsset(asset) {
    const gateway = assetManagementStore.gatewayForAsset(asset, organizationGateways.value);
    return gateway ? gatewayDisplayName(gateway) : 'asset-management.gateways.unassigned';
}

/**
 * Handles gateway name for iot device behavior in the asset management context.
 *
 * @param {*} iotDevice
 * @returns {string}
 */
function gatewayNameForIoTDevice(iotDevice) {
    return gatewayNameById(iotDevice.gatewayId);
}

/**
 * Handles gateway asset count behavior in the asset management context.
 *
 * @param {*} gateway
 * @returns {number}
 */
function gatewayAssetCount(gateway) {
    const assetIds = new Set(
        organizationIoTDevices.value
            .filter(iotDevice => iotDevice.gatewayId === gateway.id && iotDevice.assetId !== null)
            .map(iotDevice => iotDevice.assetId),
    );
    return organizationAssets.value.filter(asset => assetIds.has(asset.id)).length;
}

/**
 * Handles gateway device count behavior in the asset management context.
 *
 * @param {*} gateway
 * @returns {number}
 */
function gatewayDeviceCount(gateway) {
    return organizationIoTDevices.value.filter(iotDevice => iotDevice.gatewayId === gateway.id).length;
}

/**
 * Returns the i18n label key for asset type.
 *
 * @param {string} assetType
 * @returns {string}
 */
function assetTypeLabelKey(assetType) {
    return `asset-management.tabs.${assetType}`;
}

/**
 * Handles page title key behavior in the asset management context.
 *
 * @returns {string}
 */
function pageTitleKey() {
    return `asset-management.sections.${selectedAssetType.value}.title`;
}

/**
 * Handles page subtitle key behavior in the asset management context.
 *
 * @returns {string}
 */
function pageSubtitleKey() {
    return `asset-management.sections.${selectedAssetType.value}.subtitle`;
}

/**
 * Handles form title key behavior in the asset management context.
 *
 * @returns {string}
 */
function formTitleKey() {
    return `asset-management.sections.${selectedAssetType.value}.form-title`;
}

/**
 * Handles form subtitle key behavior in the asset management context.
 *
 * @returns {string}
 */
function formSubtitleKey() {
    return `asset-management.sections.${selectedAssetType.value}.form-subtitle`;
}

/**
 * Handles form open key behavior in the asset management context.
 *
 * @returns {string}
 */
function formOpenKey() {
    return `asset-management.sections.${selectedAssetType.value}.form-open`;
}

/**
 * Handles form create key behavior in the asset management context.
 *
 * @returns {string}
 */
function formCreateKey() {
    return `asset-management.sections.${selectedAssetType.value}.form-create`;
}

/**
 * Creates button key in the asset management context.
 *
 * @returns {string}
 */
function createButtonKey() {
    if (formVisible.value) return 'asset-management.form.close';
    if (selectedTab.value === 'iot-device') return 'asset-management.iot-devices.form-open';
    if (selectedTab.value === 'location') return 'asset-management.locations.form-open';
    if (selectedTab.value === 'gateway') return 'asset-management.gateways.form-open';
    return formOpenKey();
}

/**
 * Handles form created key behavior in the asset management context.
 *
 * @returns {string}
 */
function formCreatedKey() {
    if (feedback.value === 'updated') return 'asset-management.update.feedback-updated';
    if (feedback.value === 'asset-updated') return `asset-management.sections.${selectedAssetType.value}.feedback-updated`;
    if (feedback.value === 'asset-deleted') return 'asset-management.feedback-deleted';
    if (feedback.value === 'iot-device-created') return 'asset-management.iot-devices.feedback-created';
    if (feedback.value === 'iot-device-updated') return 'asset-management.iot-devices.feedback-updated';
    if (feedback.value === 'iot-device-deleted') return 'asset-management.iot-devices.feedback-deleted';
    if (feedback.value === 'gateway-created') return 'asset-management.gateways.feedback-created';
    if (feedback.value === 'gateway-updated') return 'asset-management.gateways.feedback-updated';
    if (feedback.value === 'gateway-deleted') return 'asset-management.gateways.feedback-deleted';
    if (feedback.value === 'location-created') return 'asset-management.locations.feedback-created';
    if (feedback.value === 'location-updated') return 'asset-management.locations.feedback-updated';
    return `asset-management.sections.${selectedAssetType.value}.feedback-created`;
}

/**
 * Handles form duplicate key behavior in the asset management context.
 *
 * @returns {string}
 */
function formDuplicateKey() {
    if (selectedTab.value === 'iot-device') return 'asset-management.iot-devices.feedback-duplicate';
    if (selectedTab.value === 'gateway') return 'asset-management.gateways.feedback-duplicate';
    if (selectedTab.value === 'location') return 'asset-management.locations.feedback-duplicate';
    return `asset-management.sections.${selectedAssetType.value}.feedback-duplicate`;
}

/**
 * Handles internal id placeholder behavior in the asset management context.
 *
 * @returns {*}
 */
function internalIdPlaceholder() {
    return selectedAssetType.value === AssetType.Transport ? 'TR-10001' : 'CR-42312';
}

/**
 * Handles name placeholder key behavior in the asset management context.
 *
 * @returns {string}
 */
function namePlaceholderKey() {
    return `asset-management.sections.${selectedAssetType.value}.name-placeholder`;
}

/**
 * Returns the i18n label key for status.
 *
 * @param {string} status
 * @returns {string}
 */
function statusLabelKey(status) {
    return `asset-management.status.${status}`;
}

/**
 * Handles asset status label behavior in the asset management context.
 *
 * @param {string} status
 * @returns {string}
 */
function assetStatusLabel(status) {
    return t(statusLabelKey(status));
}

/**
 * Returns the i18n label key for connectivity.
 *
 * @param {*} connectivity
 * @returns {string}
 */
function connectivityLabelKey(connectivity) {
    return `asset-management.connectivity.${connectivity}`;
}

/**
 * Returns the i18n label key for calibration.
 *
 * @param {string} status
 * @returns {string}
 */
function calibrationLabelKey(status) {
    return `asset-management.iot-devices.calibration-status.${status}`;
}

/**
 * Returns the i18n label key for device type.
 *
 * @param {string} deviceType
 * @returns {string}
 */
function deviceTypeLabelKey(deviceType) {
    return `asset-management.iot-devices.device-types.${deviceType}`;
}

/**
 * Returns the i18n label key for measurement parameter.
 *
 * @param {*} parameter
 * @returns {string}
 */
function measurementParameterLabelKey(parameter) {
    return `asset-management.iot-devices.measurement-parameters.${parameter}`;
}

/**
 * Handles measurement parameters for behavior in the asset management context.
 *
 * @param {*} iotDevice
 * @returns {*}
 */
function measurementParametersFor(iotDevice) {
    return iotDevice.measurementParameters.length
        ? iotDevice.measurementParameters
        : measurementParametersForDeviceType(iotDevice.deviceType);
}

/**
 * Selects ed iot device parameters in the current view state.
 *
 * @returns {void}
 */
function selectedIoTDeviceParameters() {
    return measurementParametersForDeviceType(iotDeviceForm.deviceType);
}

/**
 * Returns the i18n label key for gateway status.
 *
 * @param {string} status
 * @returns {string}
 */
function gatewayStatusLabelKey(status) {
    return `asset-management.gateways.status.${status}`;
}

/**
 * Returns the i18n label key for location type.
 *
 * @param {string} type
 * @returns {string}
 */
function locationTypeLabelKey(type) {
    return `asset-management.locations.types.${type}`;
}

/**
 * Returns the i18n label key for location status.
 *
 * @param {string} status
 * @returns {string}
 */
function locationStatusLabelKey(status) {
    return `asset-management.locations.status.${status}`;
}

/**
 * Returns the CSS class for asset status tone.
 *
 * @param {string} status
 * @returns {string}
 */
function assetStatusToneClass(status) {
    return {
        [AssetStatus.Active]: 'tone-success',
        [AssetStatus.Maintenance]: 'tone-warning',
        [AssetStatus.Inactive]: 'tone-danger',
    }[status];
}

/**
 * Returns the CSS class for iot device status tone.
 *
 * @param {string} status
 * @returns {string}
 */
function iotDeviceStatusToneClass(status) {
    return {
        [IoTDeviceStatus.Linked]: 'tone-success',
        [IoTDeviceStatus.Available]: 'tone-neutral',
        [IoTDeviceStatus.Offline]: 'tone-danger',
    }[status];
}

/**
 * Returns the CSS class for calibration tone.
 *
 * @param {string} status
 * @returns {string}
 */
function calibrationToneClass(status) {
    return {
        [CalibrationStatus.Compliant]: 'tone-success',
        [CalibrationStatus.DueSoon]: 'tone-warning',
        [CalibrationStatus.Expired]: 'tone-danger',
        [CalibrationStatus.Unknown]: 'tone-neutral',
    }[status];
}

/**
 * Returns the CSS class for gateway status tone.
 *
 * @param {string} status
 * @returns {string}
 */
function gatewayStatusToneClass(status) {
    return {
        [GatewayStatus.Active]: 'tone-success',
        [GatewayStatus.Maintenance]: 'tone-warning',
        [GatewayStatus.Offline]: 'tone-danger',
    }[status];
}

/**
 * Returns the CSS class for location status tone.
 *
 * @param {string} status
 * @returns {string}
 */
function locationStatusToneClass(status) {
    return {
        active: 'tone-success',
        maintenance: 'tone-warning',
        inactive: 'tone-danger',
    }[status] ?? 'tone-neutral';
}

/**
 * Selects ed location for form in the current view state.
 *
 * @returns {void}
 */
function selectedLocationForForm() {
    const locationId = Number(coldRoomForm.locationId);
    return locationNameById(locationId) || 'N/A';
}

/**
 * Handles asset location for behavior in the asset management context.
 *
 * @param {*} asset
 * @returns {string}
 */
function assetLocationFor(asset) {
    return assetManagementStore.locationForAsset(asset, organizationGateways.value, organizationLocations.value);
}

/**
 * Handles gateway location for behavior in the asset management context.
 *
 * @param {*} gateway
 * @returns {string}
 */
function gatewayLocationFor(gateway) {
    return locationNameById(gateway.locationId) || gateway.location || 'N/A';
}

/**
 * Handles displayed connectivity behavior in the asset management context.
 *
 * @param {*} asset
 * @returns {string}
 */
function displayedConnectivity(asset) {
    return asset.connectivity;
}

/**
 * Returns the i18n label key for incident.
 *
 * @param {*} lastIncident
 * @returns {string}
 */
function incidentLabelKey(lastIncident) {
    return `asset-management.incidents.${normalizeIncident(lastIncident)}`;
}

/**
 * Handles incident icon name behavior in the asset management context.
 *
 * @param {*} lastIncident
 * @returns {string}
 */
function incidentIconName(lastIncident) {
    return {
        'high-temperature': 'warning',
        'connection-lost': 'report',
        'high-humidity': 'warning_amber',
        'low-temperature': 'change_history',
        none: 'check_circle',
    }[normalizeIncident(lastIncident)] ?? 'info';
}

/**
 * Returns the CSS class for incident severity.
 *
 * @param {*} lastIncident
 * @returns {string}
 */
function incidentSeverityClass(lastIncident) {
    return {
        'high-temperature': 'danger',
        'connection-lost': 'danger',
        'high-humidity': 'warning',
        'low-temperature': 'cold',
        none: 'stable',
    }[normalizeIncident(lastIncident)] ?? 'stable';
}

/**
 * Handles normalize incident behavior in the asset management context.
 *
 * @param {*} lastIncident
 * @returns {*}
 */
function normalizeIncident(lastIncident) {
    const prefix = 'asset-management.incidents.';
    return lastIncident.startsWith(prefix) ? lastIncident.slice(prefix.length) : lastIncident;
}

/**
 * Handles entry date behavior in the asset management context.
 *
 * @returns {string}
 */
function entryDate() {
    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    }).format(new Date());
}

/**
 * Formats the latest temperature recorded for an asset.
 *
 * @param {*} asset
 * @returns {string}
 */
function currentTemperatureFor(asset) {
    const temperature = monitoringStore.getLatestTemperatureByAsset(asset.id);
    if (temperature === null) return '—';
    return `${new Intl.NumberFormat(locale.value, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    }).format(temperature)}°C`;
}

/**
 * Formats the date when an asset was registered.
 *
 * @param {*} asset
 * @returns {string}
 */
function entryDateFor(asset) {
    if (asset.createdAt) {
        return new Intl.DateTimeFormat(locale.value?.startsWith('es') ? 'es-PE' : 'en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
        }).format(new Date(asset.createdAt));
    }
    return asset.entryDate || '—';
}

/**
 * Handles calibration count behavior in the asset management context.
 *
 * @param {string} status
 * @returns {number}
 */
function calibrationCount(status) {
    return organizationIoTDevices.value.filter(iotDevice => iotDevice.calibrationStatus === status).length;
}

/**
 * Resets forms to its default state.
 *
 * @returns {void}
 */
function resetForms() {
    resetForm();
    resetIoTDeviceForm();
    resetGatewayForm();
    resetLocationForm();
}

/**
 * Resets form to its default state.
 *
 * @returns {void}
 */
function resetForm() {
    coldRoomForm.internalId = generatedAssetUuid(selectedAssetType.value);
    coldRoomForm.name = '';
    coldRoomForm.locationId = 0;
    coldRoomForm.capacity = 0;
    coldRoomForm.description = '';
    coldRoomForm.status = AssetStatus.Active;
}

/**
 * Resets iot device form to its default state.
 *
 * @returns {void}
 */
function resetIoTDeviceForm() {
    iotDeviceForm.internalId = generatedIoTDeviceUuid();
    iotDeviceForm.gatewayId = 0;
    iotDeviceForm.deviceType = '';
    iotDeviceForm.model = '';
    iotDeviceForm.measurementType = '';
    iotDeviceForm.assetId = 0;
    iotDeviceForm.status = IoTDeviceStatus.Available;
    iotDeviceForm.calibrationStatus = CalibrationStatus.Unknown;
    iotDeviceForm.lastCalibrationDate = '';
    iotDeviceForm.nextCalibrationDate = '';
    iotDeviceForm.readingFrequencyMinutes = 60;
}

/**
 * Resets gateway form to its default state.
 *
 * @returns {void}
 */
function resetGatewayForm() {
    gatewayForm.internalId = generatedGatewayUuid();
    gatewayForm.name = '';
    gatewayForm.locationId = 0;
    gatewayForm.network = '';
    gatewayForm.status = GatewayStatus.Active;
}

/**
 * Resets location form to its default state.
 *
 * @returns {void}
 */
function resetLocationForm() {
    locationForm.name = '';
    locationForm.type = 'WAREHOUSE';
    locationForm.address = '';
    locationForm.description = '';
    locationForm.status = 'active';
}

/**
 * Maps legacy location type values to the current form catalog.
 *
 * @param {string} type
 * @returns {string}
 */
function locationTypeFormValue(type) {
    return locationTypes.includes(type) ? type : (locationTypeFormAliases[type] ?? 'WAREHOUSE');
}

/**
 * Handles measurement parameters for device type behavior in the asset management context.
 *
 * @param {string} deviceType
 * @returns {string}
 */
function measurementParametersForDeviceType(deviceType) {
    return iotDeviceDefinitions.find(definition => definition.type === deviceType)?.parameters ?? [];
}

/**
 * Handles measurement type label behavior in the asset management context.
 *
 * @param {*} parameters
 * @returns {string}
 */
function measurementTypeLabel(parameters) {
    return parameters.map(parameter => t(measurementParameterLabelKey(parameter))).join(' / ');
}

/**
 * Returns a blank value when an API placeholder is displayed.
 *
 * @param {string} value
 * @returns {string}
 */
function blankIfPlaceholder(value) {
    return value === '—' ? '' : value;
}

/**
 * Handles clear pending asset status behavior in the asset management context.
 *
 * @param {number|string} assetId
 * @returns {string}
 */
function clearPendingAssetStatus(assetId) {
    const nextStatuses = {...pendingAssetStatuses.value};
    delete nextStatuses[assetId];
    pendingAssetStatuses.value = nextStatuses;
}

/**
 * Handles gateway name by id behavior in the asset management context.
 *
 * @param {number|string} gatewayId
 * @returns {string}
 */
function gatewayNameById(gatewayId) {
    const gateway = gateways.value.find(currentGateway => currentGateway.id === gatewayId);
    return gateway ? gatewayDisplayName(gateway) : 'asset-management.gateways.unassigned';
}

/**
 * Handles gateway display name behavior in the asset management context.
 *
 * @param {*} gateway
 * @returns {string}
 */
function gatewayDisplayName(gateway) {
    return `${gateway.uuid} - ${gatewayLocationFor(gateway)}`;
}

/**
 * Handles location name by id behavior in the asset management context.
 *
 * @param {number|string} locationId
 * @returns {string}
 */
function locationNameById(locationId) {
    return organizationLocations.value.find(location => location.id === Number(locationId))?.name ?? '';
}

/**
 * Handles resource key behavior in the asset management context.
 *
 * @param {string} resourceType
 * @param {number|string} resourceId
 * @returns {string}
 */
function resourceKey(resourceType, resourceId) {
    return `${resourceType}-${resourceId}`;
}

/**
 * Generates d asset uuid for the current workflow.
 *
 * @param {string} assetType
 * @returns {number}
 */
function generatedAssetUuid(assetType) {
    const organizationId = activeOrganizationId.value;
    const currentUuids = assets.value
        .filter(asset => (!organizationId || asset.organizationId === organizationId) && asset.type === assetType)
        .map(asset => asset.uuid);
    if (assetType === AssetType.Transport) {
        return generatedUuid('TR', currentUuids, 10000 + currentUuids.length + 1, 5);
    }
    return generatedUuid('CR', currentUuids, currentUuids.length + 1, 5);
}

/**
 * Generates d iot device uuid for the current workflow.
 *
 * @returns {number}
 */
function generatedIoTDeviceUuid() {
    const organizationId = activeOrganizationId.value;
    const currentUuids = iotDevices.value
        .filter(iotDevice => !organizationId || iotDevice.organizationId === organizationId)
        .map(iotDevice => iotDevice.uuid);
    return generatedUuid('SN', currentUuids, currentUuids.length + 1, 3);
}

/**
 * Generates d gateway uuid for the current workflow.
 *
 * @returns {number}
 */
function generatedGatewayUuid() {
    const organizationId = activeOrganizationId.value;
    const currentUuids = gateways.value
        .filter(gateway => !organizationId || gateway.organizationId === organizationId)
        .map(gateway => gateway.uuid);
    return generatedUuid('GW', currentUuids, currentUuids.length + 1, 3);
}

/**
 * Handles next location id behavior in the asset management context.
 *
 * @returns {number}
 */
function nextLocationId() {
    return Math.max(...locations.value.map(location => location.id), 0) + 1;
}

/**
 * Generates d uuid for the current workflow.
 *
 * @param {*} prefix
 * @param {string} currentUuids
 * @param {number|string} firstNumber
 * @param {*} width
 * @returns {number}
 */
function generatedUuid(prefix, currentUuids, firstNumber, width) {
    const normalizedUuids = new Set(currentUuids.map(uuid => uuid.toLowerCase()));
    let nextNumber = firstNumber;
    let candidate = '';
    do {
        candidate = `${prefix}-${nextNumber.toString().padStart(width, '0')}`;
        nextNumber += 1;
    } while (normalizedUuids.has(candidate.toLowerCase()));
    return candidate;
}

/**
 * Handles translate or text behavior in the asset management context.
 *
 * @param {string} value
 * @returns {*}
 */
function translateOrText(value) {
    return typeof value === 'string' && value.startsWith('asset-management.') ? t(value) : value;
}
</script>

<template>
  <section class="asset-management-context">
    <nav class="asset-tabs" aria-label="Asset sections">
      <button
        v-for="assetType in assetTypeTabs"
        :key="assetType"
        type="button"
        :class="{active: selectedTab === assetType}"
        @click="selectAssetType(assetType)"
      >
        {{ t(assetTypeLabelKey(assetType)) }}
      </button>
    </nav>

    <div class="assets-toolbar">
      <label class="search-box">
        <span class="material-icons search-icon" aria-hidden="true">search</span>
        <input
          v-model="searchTerm"
          type="search"
          :placeholder="t('asset-management.search')"
        />
      </label>

      <button
        v-if="canManageAssets && canCreateSelectedResource"
        type="button"
        class="primary-action"
        @click="toggleForm"
      >
        {{ t(createButtonKey()) }}
      </button>
    </div>

    <p v-if="positiveFeedback" class="feedback success">{{ t(formCreatedKey()) }}</p>
    <p v-if="feedback === 'duplicate-id'" class="feedback error">{{ t(formDuplicateKey()) }}</p>
    <p v-if="feedback === 'server-error' || errors.length" class="feedback error">
      {{ t('asset-management.feedback.server-error') }}
    </p>

    <section v-if="formVisible && canManageAssets && isAssetTab" class="form-card" aria-labelledby="cold-room-form-title">
      <div class="section-heading">
        <div>
          <h2 id="cold-room-form-title">{{ t(editingAssetId ? 'asset-management.form.edit-title' : formTitleKey()) }}</h2>
          <p>{{ t(editingAssetId ? 'asset-management.form.edit-subtitle' : formSubtitleKey()) }}</p>
        </div>
      </div>

      <form class="cold-room-form" @submit.prevent="submit">
        <label class="form-field">
          <span>{{ t('asset-management.form.internal-id') }}</span>
          <input v-model="coldRoomForm.internalId" type="text" :placeholder="internalIdPlaceholder()" readonly/>
          <small v-if="hasControlError('internalId')">{{ t('asset-management.form.internal-id-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.form.name') }}</span>
          <input v-model="coldRoomForm.name" type="text" :placeholder="t(namePlaceholderKey())"/>
          <small v-if="hasControlError('name')">{{ t('asset-management.form.name-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.form.location') }}</span>
          <select v-model.number="coldRoomForm.locationId">
            <option :value="0">{{ t('asset-management.form.select-location') }}</option>
            <option v-for="location in organizationLocations" :key="location.id" :value="location.id">
              {{ location.name }}
            </option>
          </select>
          <small v-if="hasControlError('locationId')">{{ t('asset-management.form.location-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.form.capacity') }}</span>
          <input v-model.number="coldRoomForm.capacity" type="number" min="1" placeholder="1200"/>
          <small v-if="hasControlError('capacity')">{{ t('asset-management.form.capacity-error') }}</small>
        </label>

        <div class="form-field">
          <span>{{ t('asset-management.form.location') }}</span>
          <div class="derived-field" :class="{empty: selectedLocationForForm() === 'N/A'}">
            {{ selectedLocationForForm() !== 'N/A' ? selectedLocationForForm() : t('asset-management.form.location-derived-empty') }}
          </div>
        </div>

        <label class="form-field">
          <span>{{ t('asset-management.form.status') }}</span>
          <select v-model="coldRoomForm.status">
            <option v-for="status in assetStatuses" :key="status" :value="status">
              {{ assetStatusLabel(status) }}
            </option>
          </select>
        </label>

        <label class="form-field full">
          <span>{{ t('asset-management.form.description') }}</span>
          <textarea v-model="coldRoomForm.description" rows="3" :placeholder="t('asset-management.form.description-placeholder')"></textarea>
        </label>

        <div class="form-actions">
          <button type="button" class="secondary-action" @click="toggleForm">
            {{ t('asset-management.form.cancel') }}
          </button>
          <button type="submit" class="primary-action" :disabled="creating">
            {{ t(creating ? 'asset-management.form.creating' : editingAssetId ? 'asset-management.form.update' : formCreateKey()) }}
          </button>
        </div>
      </form>
    </section>

    <section v-if="formVisible && canManageAssets && selectedTab === 'iot-device'" class="form-card" aria-labelledby="iot-device-form-title">
      <div class="section-heading">
        <div>
          <h2 id="iot-device-form-title">
            {{ t(editingIoTDeviceId ? 'asset-management.iot-devices.form-edit-title' : 'asset-management.iot-devices.form-title') }}
          </h2>
          <p>
            {{ t(editingIoTDeviceId ? 'asset-management.iot-devices.form-edit-subtitle' : 'asset-management.iot-devices.form-subtitle') }}
          </p>
        </div>
      </div>

      <form class="cold-room-form" @submit.prevent="submitIoTDevice">
        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.internal-id') }}</span>
          <input v-model="iotDeviceForm.internalId" type="text" :placeholder="t('asset-management.iot-devices.form.internal-id-placeholder')" readonly/>
          <small v-if="hasIoTDeviceControlError('internalId')">{{ t('asset-management.iot-devices.form.internal-id-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.type') }}</span>
          <select v-model="iotDeviceForm.deviceType" @change="selectIoTDeviceType(iotDeviceForm.deviceType)">
            <option value="">{{ t('asset-management.iot-devices.form.select-type') }}</option>
            <option v-for="deviceType in iotDeviceTypes" :key="deviceType" :value="deviceType">
              {{ t(deviceTypeLabelKey(deviceType)) }}
            </option>
          </select>
          <small v-if="hasIoTDeviceControlError('deviceType')">{{ t('asset-management.iot-devices.form.type-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.model') }}</span>
          <input v-model="iotDeviceForm.model" type="text" :placeholder="t('asset-management.iot-devices.form.model-placeholder')"/>
          <small v-if="hasIoTDeviceControlError('model')">{{ t('asset-management.iot-devices.form.model-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.measurement') }}</span>
          <div class="parameter-list">
            <span v-for="parameter in selectedIoTDeviceParameters()" :key="parameter">
              {{ t(measurementParameterLabelKey(parameter)) }}
            </span>
            <span v-if="!selectedIoTDeviceParameters().length">{{ t('asset-management.iot-devices.form.select-type') }}</span>
          </div>
          <input v-model="iotDeviceForm.measurementType" type="hidden"/>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.table.gateway') }}</span>
          <select v-model.number="iotDeviceForm.gatewayId">
            <option :value="0">{{ t('asset-management.form.select-gateway') }}</option>
            <option v-for="gateway in organizationGateways" :key="gateway.id" :value="gateway.id">
              {{ gatewayNameById(gateway.id) }}
            </option>
          </select>
          <small v-if="hasIoTDeviceControlError('gatewayId')">{{ t('asset-management.form.gateway-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.asset') }}</span>
          <select v-model.number="iotDeviceForm.assetId">
            <option :value="0">{{ t('asset-management.iot-devices.form.unassigned') }}</option>
            <option v-for="asset in organizationAssets" :key="asset.id" :value="asset.id">
              {{ asset.uuid }} - {{ asset.name }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.status') }}</span>
          <select v-model="iotDeviceForm.status">
            <option v-for="status in iotDeviceStatuses" :key="status" :value="status">
              {{ t(`asset-management.iot-devices.status.${status}`) }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.calibration-status') }}</span>
          <select v-model="iotDeviceForm.calibrationStatus">
            <option v-for="status in calibrationStatuses" :key="status" :value="status">
              {{ t(calibrationLabelKey(status)) }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.last-calibration') }}</span>
          <input v-model="iotDeviceForm.lastCalibrationDate" type="text" :placeholder="t('asset-management.iot-devices.form.last-calibration-placeholder')"/>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.next-calibration') }}</span>
          <input v-model="iotDeviceForm.nextCalibrationDate" type="text" :placeholder="t('asset-management.iot-devices.form.next-calibration-placeholder')"/>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.iot-devices.form.reading-frequency') }}</span>
          <input v-model.number="iotDeviceForm.readingFrequencyMinutes" type="number" min="5" max="1440"/>
          <small v-if="hasIoTDeviceControlError('readingFrequencyMinutes')">{{ t('asset-management.iot-devices.form.reading-frequency-error') }}</small>
        </label>

        <div class="form-actions">
          <button type="button" class="secondary-action" @click="toggleForm">
            {{ t('asset-management.form.cancel') }}
          </button>
          <button type="submit" class="primary-action" :disabled="creating">
            {{ t(creating ? 'asset-management.form.creating' : editingIoTDeviceId ? 'asset-management.iot-devices.form-update' : 'asset-management.iot-devices.form-create') }}
          </button>
        </div>
      </form>
    </section>

    <section v-if="formVisible && canManageAssets && selectedTab === 'gateway'" class="form-card" aria-labelledby="gateway-form-title">
      <div class="section-heading">
        <div>
          <h2 id="gateway-form-title">
            {{ t(editingGatewayId ? 'asset-management.gateways.form-edit-title' : 'asset-management.gateways.form-title') }}
          </h2>
          <p>
            {{ t(editingGatewayId ? 'asset-management.gateways.form-edit-subtitle' : 'asset-management.gateways.form-subtitle') }}
          </p>
        </div>
      </div>

      <form class="cold-room-form" @submit.prevent="submitGateway">
        <label class="form-field">
          <span>{{ t('asset-management.gateways.form.internal-id') }}</span>
          <input v-model="gatewayForm.internalId" type="text" :placeholder="t('asset-management.gateways.form.internal-id-placeholder')" readonly/>
          <small v-if="hasGatewayControlError('internalId')">{{ t('asset-management.gateways.form.internal-id-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.gateways.form.name') }}</span>
          <input v-model="gatewayForm.name" type="text" :placeholder="t('asset-management.gateways.form.name-placeholder')"/>
          <small v-if="hasGatewayControlError('name')">{{ t('asset-management.gateways.form.name-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.gateways.form.location') }}</span>
          <select v-model.number="gatewayForm.locationId">
            <option :value="0">{{ t('asset-management.form.select-location') }}</option>
            <option v-for="location in organizationLocations" :key="location.id" :value="location.id">
              {{ location.name }}
            </option>
          </select>
          <small v-if="hasGatewayControlError('locationId')">{{ t('asset-management.gateways.form.location-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.gateways.form.network') }}</span>
          <input v-model="gatewayForm.network" type="text" :placeholder="t('asset-management.gateways.form.network-placeholder')"/>
          <small v-if="hasGatewayControlError('network')">{{ t('asset-management.gateways.form.network-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.gateways.form.status') }}</span>
          <select v-model="gatewayForm.status">
            <option v-for="status in gatewayStatuses" :key="status" :value="status">
              {{ t(gatewayStatusLabelKey(status)) }}
            </option>
          </select>
        </label>

        <div class="form-actions">
          <button type="button" class="secondary-action" @click="toggleForm">
            {{ t('asset-management.form.cancel') }}
          </button>
          <button type="submit" class="primary-action" :disabled="creating">
            {{ t(creating ? 'asset-management.form.creating' : editingGatewayId ? 'asset-management.gateways.form-update' : 'asset-management.gateways.form-create') }}
          </button>
        </div>
      </form>
    </section>

    <section v-if="formVisible && canManageAssets && selectedTab === 'location'" class="form-card" aria-labelledby="location-form-title">
      <div class="section-heading">
        <div>
          <h2 id="location-form-title">
            {{ t(editingLocationId ? 'asset-management.locations.form-edit-title' : 'asset-management.locations.form-title') }}
          </h2>
          <p>
            {{ t(editingLocationId ? 'asset-management.locations.form-edit-subtitle' : 'asset-management.locations.form-subtitle') }}
          </p>
        </div>
      </div>

      <form class="cold-room-form" @submit.prevent="submitLocation">
        <label class="form-field">
          <span>{{ t('asset-management.locations.form.name') }}</span>
          <input v-model="locationForm.name" type="text" :placeholder="t('asset-management.locations.form.name-placeholder')"/>
          <small v-if="hasLocationControlError('name')">{{ t('asset-management.locations.form.name-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.locations.form.type') }}</span>
          <select v-model="locationForm.type">
            <option v-for="type in locationTypes" :key="type" :value="type">
              {{ t(locationTypeLabelKey(type)) }}
            </option>
          </select>
          <small v-if="hasLocationControlError('type')">{{ t('asset-management.locations.form.type-error') }}</small>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.locations.form.status') }}</span>
          <select v-model="locationForm.status">
            <option v-for="status in locationStatuses" :key="status" :value="status">
              {{ t(locationStatusLabelKey(status)) }}
            </option>
          </select>
        </label>

        <label class="form-field">
          <span>{{ t('asset-management.locations.form.address') }}</span>
          <input v-model="locationForm.address" type="text" :placeholder="t('asset-management.locations.form.address-placeholder')"/>
        </label>

        <label class="form-field full">
          <span>{{ t('asset-management.locations.form.description') }}</span>
          <textarea v-model="locationForm.description" rows="3" :placeholder="t('asset-management.locations.form.description-placeholder')"></textarea>
        </label>

        <div class="form-actions">
          <button type="button" class="secondary-action" @click="toggleForm">
            {{ t('asset-management.form.cancel') }}
          </button>
          <button type="submit" class="primary-action" :disabled="creating">
            {{ t(creating ? 'asset-management.form.creating' : editingLocationId ? 'asset-management.locations.form-update' : 'asset-management.locations.form-create') }}
          </button>
        </div>
      </form>
    </section>

    <section v-if="selectedTab === 'location'" class="table-card" aria-labelledby="location-table-title">
      <div class="section-heading">
        <div>
          <h2 id="location-table-title">{{ t('asset-management.locations.title') }}</h2>
          <p>{{ t('asset-management.locations.subtitle') }}</p>
        </div>
        <button type="button" class="secondary-action" @click="loadPageData">{{ t('asset-management.reload') }}</button>
      </div>

      <div class="assets-table-wrapper">
        <table class="assets-table location-table">
          <thead>
            <tr>
              <th>{{ t('asset-management.locations.table.name') }}</th>
              <th>{{ t('asset-management.locations.table.type') }}</th>
              <th>{{ t('asset-management.locations.table.address') }}</th>
              <th>{{ t('asset-management.locations.table.description') }}</th>
              <th>{{ t('asset-management.locations.table.status') }}</th>
              <th v-if="canManageAssets">{{ t('asset-management.table.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="location in paginatedLocations" :key="location.id">
              <td :data-label="t('asset-management.locations.table.name')">{{ location.name }}</td>
              <td :data-label="t('asset-management.locations.table.type')">{{ t(locationTypeLabelKey(location.type)) }}</td>
              <td :data-label="t('asset-management.locations.table.address')">{{ location.address || 'N/A' }}</td>
              <td :data-label="t('asset-management.locations.table.description')">{{ location.description || 'N/A' }}</td>
              <td :data-label="t('asset-management.locations.table.status')">
                <span class="status-pill" :class="locationStatusToneClass(location.status)">
                  {{ t(locationStatusLabelKey(location.status)) }}
                </span>
              </td>
              <td v-if="canManageAssets" :data-label="t('asset-management.table.actions')">
                <button class="secondary-action" type="button" @click="editLocation(location)">
                  {{ t('asset-management.locations.edit') }}
                </button>
              </td>
            </tr>
            <tr v-if="!filteredLocations.length">
              <td class="empty-state" :colspan="canManageAssets ? 6 : 5">{{ t('asset-management.locations.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <list-pagination v-model="locationPage" :total="filteredLocations.length" :page-size="pageSize"/>
    </section>

    <section v-if="selectedTab === 'iot-device'" class="table-card" aria-labelledby="iot-device-table-title">
      <div class="section-heading">
        <div>
          <h2 id="iot-device-table-title">{{ t('asset-management.iot-devices.title') }}</h2>
          <p>{{ t('asset-management.iot-devices.subtitle') }}</p>
        </div>
        <button type="button" class="secondary-action" @click="loadPageData">{{ t('asset-management.reload') }}</button>
      </div>

      <div class="calibration-summary" aria-label="IoT device calibration summary">
        <article v-for="summary in calibrationSummary" :key="summary.status" class="calibration-card" :class="calibrationToneClass(summary.status)">
          <span>{{ t(calibrationLabelKey(summary.status)) }}</span>
          <strong>{{ summary.count }}</strong>
        </article>
      </div>

      <div class="assets-table-wrapper">
        <table class="assets-table iot-device-table">
          <thead>
            <tr>
              <th>{{ t('asset-management.iot-devices.table.id') }}</th>
              <th>{{ t('asset-management.iot-devices.table.type') }}</th>
              <th>{{ t('asset-management.iot-devices.table.model') }}</th>
              <th>{{ t('asset-management.iot-devices.table.measurement') }}</th>
              <th>{{ t('asset-management.iot-devices.table.asset') }}</th>
              <th>{{ t('asset-management.iot-devices.table.gateway') }}</th>
              <th>{{ t('asset-management.iot-devices.table.status') }}</th>
              <th>{{ t('asset-management.iot-devices.table.calibration') }}</th>
              <th>{{ t('asset-management.iot-devices.table.next-calibration') }}</th>
              <th v-if="canManageAssets">{{ t('asset-management.table.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="iotDevice in paginatedIoTDevices" :key="iotDevice.id">
              <td :data-label="t('asset-management.iot-devices.table.id')">{{ iotDevice.uuid }}</td>
              <td :data-label="t('asset-management.iot-devices.table.type')">{{ t(deviceTypeLabelKey(iotDevice.deviceType)) }}</td>
              <td :data-label="t('asset-management.iot-devices.table.model')">{{ iotDevice.model }}</td>
              <td :data-label="t('asset-management.iot-devices.table.measurement')">
                <div class="parameter-list compact">
                  <span v-for="parameter in measurementParametersFor(iotDevice)" :key="parameter">
                    {{ t(measurementParameterLabelKey(parameter)) }}
                  </span>
                </div>
              </td>
              <td :data-label="t('asset-management.iot-devices.table.asset')">{{ translateOrText(assetNameForIoTDevice(iotDevice)) }}</td>
              <td :data-label="t('asset-management.iot-devices.table.gateway')">{{ translateOrText(gatewayNameForIoTDevice(iotDevice)) }}</td>
              <td :data-label="t('asset-management.iot-devices.table.status')">
                <span class="status-pill" :class="iotDeviceStatusToneClass(iotDevice.status)">
                  {{ t(`asset-management.iot-devices.status.${iotDevice.status}`) }}
                </span>
              </td>
              <td :data-label="t('asset-management.iot-devices.table.calibration')">
                <span class="status-pill" :class="calibrationToneClass(iotDevice.calibrationStatus)">
                  {{ t(calibrationLabelKey(iotDevice.calibrationStatus)) }}
                </span>
              </td>
              <td :data-label="t('asset-management.iot-devices.table.next-calibration')">{{ iotDevice.nextCalibrationDate }}</td>
              <td v-if="canManageAssets" :data-label="t('asset-management.table.actions')">
                <button
                  class="secondary-action"
                  type="button"
                  @click="editIoTDevice(iotDevice)"
                >
                  {{ t('asset-management.edit') }}
                </button>
              </td>
            </tr>
            <tr v-if="!organizationIoTDevices.length">
              <td class="empty-state" :colspan="canManageAssets ? 10 : 9">{{ t('asset-management.iot-devices.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <list-pagination v-model="iotDevicePage" :total="organizationIoTDevices.length" :page-size="pageSize"/>
    </section>

    <section v-if="selectedTab === 'gateway'" class="table-card" aria-labelledby="gateway-table-title">
      <div class="section-heading">
        <div>
          <h2 id="gateway-table-title">{{ t('asset-management.gateways.title') }}</h2>
          <p>{{ t('asset-management.gateways.subtitle') }}</p>
        </div>
        <button type="button" class="secondary-action" @click="loadPageData">{{ t('asset-management.reload') }}</button>
      </div>

      <div class="assets-table-wrapper">
        <table class="assets-table gateway-table">
          <thead>
            <tr>
              <th>{{ t('asset-management.gateways.table.id') }}</th>
              <th>{{ t('asset-management.gateways.table.name') }}</th>
              <th>{{ t('asset-management.gateways.table.location') }}</th>
              <th>{{ t('asset-management.gateways.table.network') }}</th>
              <th>{{ t('asset-management.gateways.table.assets') }}</th>
              <th>{{ t('asset-management.gateways.table.devices') }}</th>
              <th>{{ t('asset-management.gateways.table.status') }}</th>
              <th v-if="canManageAssets">{{ t('asset-management.table.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="gateway in paginatedGateways" :key="gateway.id">
              <td :data-label="t('asset-management.gateways.table.id')">{{ gateway.uuid }}</td>
              <td :data-label="t('asset-management.gateways.table.name')">{{ gateway.name }}</td>
              <td :data-label="t('asset-management.gateways.table.location')">{{ gatewayLocationFor(gateway) }}</td>
              <td :data-label="t('asset-management.gateways.table.network')">{{ gateway.network }}</td>
              <td :data-label="t('asset-management.gateways.table.assets')">{{ gatewayAssetCount(gateway) }}</td>
              <td :data-label="t('asset-management.gateways.table.devices')">{{ gatewayDeviceCount(gateway) }}</td>
              <td :data-label="t('asset-management.gateways.table.status')">
                <span class="status-pill" :class="gatewayStatusToneClass(gateway.status)">
                  {{ t(gatewayStatusLabelKey(gateway.status)) }}
                </span>
              </td>
              <td v-if="canManageAssets" :data-label="t('asset-management.table.actions')">
                <button
                  class="secondary-action"
                  type="button"
                  @click="editGateway(gateway)"
                >
                  {{ t('asset-management.edit') }}
                </button>
              </td>
            </tr>
            <tr v-if="!organizationGateways.length">
              <td class="empty-state" :colspan="canManageAssets ? 8 : 7">{{ t('asset-management.gateways.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <list-pagination v-model="gatewayPage" :total="organizationGateways.length" :page-size="pageSize"/>
    </section>

    <section v-if="isAssetTab" class="table-card" aria-labelledby="cold-room-table-title">
      <div class="section-heading">
        <div>
          <h2 id="cold-room-table-title">{{ t(pageTitleKey()) }}</h2>
          <p>{{ t(pageSubtitleKey()) }}</p>
        </div>
        <button type="button" class="secondary-action" @click="loadPageData">{{ t('asset-management.reload') }}</button>
      </div>

      <div v-if="pageLoading" class="loading-state">
        <span class="inline-spinner"></span>
        <span>{{ t('asset-management.feedback.loading') }}</span>
      </div>
      <template v-else>
        <div class="assets-table-wrapper">
          <table class="assets-table">
            <thead>
              <tr>
                <th>{{ t('asset-management.table.id') }}</th>
                <th>{{ t('asset-management.table.name') }}</th>
                <th>{{ t('asset-management.table.gateway') }}</th>
                <th>{{ t('asset-management.table.location') }}</th>
                <th>{{ t('asset-management.table.last-incident') }}</th>
                <th>{{ t('asset-management.table.temperature') }}</th>
                <th>{{ t('asset-management.table.entry-date') }}</th>
                <th>{{ t('asset-management.table.status') }}</th>
                <th>{{ t('asset-management.table.connectivity') }}</th>
                <th v-if="canManageAssets">{{ t('asset-management.table.actions') }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="asset in paginatedAssets" :key="asset.id">
                <td :data-label="t('asset-management.table.id')">{{ asset.uuid }}</td>
                <td :data-label="t('asset-management.table.name')">{{ asset.name }}</td>
                <td :data-label="t('asset-management.table.gateway')">{{ translateOrText(gatewayNameForAsset(asset)) }}</td>
                <td :data-label="t('asset-management.table.location')">{{ assetLocationFor(asset) }}</td>
                <td :data-label="t('asset-management.table.last-incident')">
                  <span class="incident" :class="incidentSeverityClass(asset.lastIncident)">
                    <span class="material-icons" aria-hidden="true">{{ incidentIconName(asset.lastIncident) }}</span>
                    {{ t(incidentLabelKey(asset.lastIncident)) }}
                  </span>
                </td>
                <td :data-label="t('asset-management.table.temperature')">{{ currentTemperatureFor(asset) }}</td>
                <td :data-label="t('asset-management.table.entry-date')">{{ entryDateFor(asset) }}</td>
                <td :data-label="t('asset-management.table.status')">
                  <label
                    v-if="canManageAssets"
                    class="status-select-field"
                    :class="[assetStatusToneClass(displayedAssetStatus(asset)), {disabled: updatingAssetId === asset.id}]"
                  >
                    <span>{{ assetStatusLabel(displayedAssetStatus(asset)) }}</span>
                    <span class="material-icons" aria-hidden="true">expand_more</span>
                    <select
                      :aria-label="t('asset-management.table.status')"
                      :value="displayedAssetStatus(asset)"
                      :disabled="updatingAssetId === asset.id"
                      @change="updateAssetStatus(asset, $event.target.value)"
                    >
                      <option v-for="status in assetStatuses" :key="status" :value="status">
                        {{ assetStatusLabel(status) }}
                      </option>
                    </select>
                  </label>
                  <span v-else class="status-pill" :class="assetStatusToneClass(displayedAssetStatus(asset))">
                    {{ assetStatusLabel(displayedAssetStatus(asset)) }}
                  </span>
                </td>
                <td :data-label="t('asset-management.table.connectivity')">
                  <span
                    class="connectivity"
                    :class="{
                      online: displayedConnectivity(asset) === ConnectivityStatus.Online,
                      unstable: displayedConnectivity(asset) === ConnectivityStatus.Unstable,
                      offline: displayedConnectivity(asset) === ConnectivityStatus.Offline,
                    }"
                  >
                    {{ t(connectivityLabelKey(displayedConnectivity(asset))) }}
                  </span>
                </td>
                <td v-if="canManageAssets" :data-label="t('asset-management.table.actions')">
                  <button
                    class="secondary-action"
                    type="button"
                    @click="editAsset(asset)"
                  >
                    {{ t('asset-management.edit') }}
                  </button>
                </td>
              </tr>
              <tr v-if="!filteredAssets.length">
                <td class="empty-state" :colspan="canManageAssets ? 10 : 9">{{ t('asset-management.empty') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <list-pagination v-model="assetPage" :total="filteredAssets.length" :page-size="pageSize"/>
      </template>
    </section>
  </section>
</template>

<style scoped>
.asset-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 26px;
  margin: 0 0 10px;
}

.asset-tabs button {
  background: transparent;
  border: 0;
  color: #98a2b3;
  cursor: pointer;
  font:
    800 13px/24px 'Inter',
    Arial,
    sans-serif;
  padding: 0 0 8px;
  text-decoration: none;
}

.asset-tabs button.active,
.asset-tabs button:hover {
  border-bottom: 2px solid #2563eb;
  color: #2563eb;
}

.assets-toolbar {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  justify-content: space-between;
  margin: 0 0 24px;
}

.search-box {
  align-items: center;
  background: #ffffff;
  border: 1px solid #ebeef2;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(96, 108, 128, 0.14);
  color: #98a2b3;
  display: flex;
  flex: 1 1 420px;
  gap: 10px;
  margin: 0;
  min-height: 42px;
  min-width: min(420px, 100%);
  padding: 0 14px;
}

.search-icon {
  color: #b8c0cc;
  font-size: 24px;
  height: 24px;
  opacity: 1;
  width: 24px;
}

.search-box input {
  background: transparent;
  border: 0;
  color: #404040;
  flex: 1;
  font:
    800 13px/20px 'Inter',
    Arial,
    sans-serif;
  min-width: 0;
  outline: 0;
}

.search-box input::placeholder {
  color: #98a2b3;
}

.primary-action,
.secondary-action {
  align-items: center;
  border-radius: 8px;
  box-shadow: none;
  cursor: pointer;
  display: inline-flex;
  font:
    800 13px/20px 'Inter',
    Arial,
    sans-serif;
  gap: 8px;
  justify-content: center;
  min-height: 38px;
  min-width: 0;
  padding: 0 14px;
  width: auto;
}

.primary-action {
  background: #2563eb;
  border: 1px solid #2563eb;
  color: #ffffff;
}

.secondary-action {
  background: #ffffff;
  border: 1px solid #ebeef2;
  color: #606c80;
}

.danger-action {
  align-items: center;
  background: #ffffff;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #dc2626;
  cursor: pointer;
  display: inline-flex;
  font:
    800 12px/20px 'Inter',
    Arial,
    sans-serif;
  justify-content: center;
  min-height: 30px;
  padding: 4px 10px;
  white-space: nowrap;
}

.danger-action:disabled {
  border-color: #ebeef2;
  color: #98a2b3;
  cursor: not-allowed;
}

.feedback {
  border-radius: 8px;
  font:
    800 12px/20px 'Inter',
    Arial,
    sans-serif;
  margin: 18px 0 0;
  padding: 10px 14px;
}

.feedback.success {
  background: #eaf8f0;
  color: #176900;
}

.feedback.error {
  background: #feeceb;
  color: #b51313;
}

.form-card,
.table-card {
  background: #ffffff;
  border: 1px solid #ebeef2;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(96, 108, 128, 0.14);
  box-sizing: border-box;
  margin-bottom: 24px;
  margin-top: 0;
  max-width: 100%;
  padding: 22px 26px;
}

.section-heading {
  align-items: flex-start;
  display: flex;
  gap: 20px;
  justify-content: space-between;
}

.section-heading h2 {
  color: #323c4d;
  font:
    800 18px/24px 'Inter',
    Arial,
    sans-serif;
  margin: 0;
}

.section-heading p {
  color: #98a2b3;
  font:
    800 12px/20px 'Inter',
    Arial,
    sans-serif;
  margin: 6px 0 0;
}

.cold-room-form {
  display: grid;
  gap: 14px 18px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  margin-top: 18px;
}

.parameter-list {
  align-items: center;
  background: #f4f4f4;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 38px;
  padding: 7px 10px;
}

.parameter-list span {
  background: #f7f8fa;
  border: 1px solid #ebeef2;
  border-radius: 16px;
  color: #606c80;
  display: inline-flex;
  font:
    800 10px/16px 'Inter',
    Arial,
    sans-serif;
  padding: 3px 8px;
}

.parameter-list.compact {
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.form-field {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.form-field::after {
  content: '';
  min-height: 16px;
}

.form-field:has(small)::after {
  display: none;
}

.form-field.full {
  grid-column: 1 / -1;
}

.form-field span {
  color: #404040;
  font:
    800 12px/20px 'Inter',
    Arial,
    sans-serif;
}

.form-field input,
.form-field textarea,
.form-field select {
  background: #f4f4f4;
  border: 1px solid transparent;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
  color: #404040;
  font:
    400 13px/18px 'Inter',
    Arial,
    sans-serif;
  max-width: 100%;
  min-height: 38px;
  min-width: 0;
  outline: 0;
  padding: 9px 12px;
  resize: vertical;
  width: 100%;
}

.form-field textarea {
  min-height: 88px;
}

.form-field input:focus,
.form-field textarea:focus,
.form-field select:focus {
  border-color: #9aaeeb;
}

.form-field input[readonly],
.form-field textarea[readonly],
.form-field select:disabled {
  color: #606c80;
}

.derived-field {
  align-items: center;
  background: #f4f4f4;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.18);
  box-sizing: border-box;
  color: #404040;
  display: flex;
  font:
    400 13px/18px 'Inter',
    Arial,
    sans-serif;
  min-height: 38px;
  padding: 9px 12px;
}

.derived-field.empty,
.derived-field:empty {
  color: #98a2b3;
}

.form-field small {
  color: #b51313;
  font:
    800 11px/16px 'Inter',
    Arial,
    sans-serif;
}

.form-actions {
  align-items: center;
  display: flex;
  gap: 10px;
  grid-column: 1 / -1;
  justify-content: flex-end;
}

.calibration-summary {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 130px), 1fr));
  margin-top: 18px;
}

.calibration-card {
  background: #ffffff;
  border: 1px solid var(--tone-border, #ebeef2);
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(96, 108, 128, 0.05);
  display: grid;
  gap: 4px;
  padding: 10px 12px;
}

.calibration-card span {
  color: #98a2b3;
  font:
    800 12px/20px 'Inter',
    Arial,
    sans-serif;
}

.calibration-card strong {
  color: var(--tone-text, #323c4d);
  font:
    800 18px/24px 'Inter',
    Arial,
    sans-serif;
}

.tone-success {
  --tone-bg: #eaf8f0;
  --tone-border: rgba(23, 105, 0, 0.35);
  --tone-text: #176900;
}

.tone-warning {
  --tone-bg: #fef6e5;
  --tone-border: rgba(177, 111, 11, 0.35);
  --tone-text: #b16f0b;
}

.tone-danger {
  --tone-bg: #feeceb;
  --tone-border: rgba(181, 19, 19, 0.35);
  --tone-text: #b51313;
}

.tone-neutral {
  --tone-bg: #f0f2f5;
  --tone-border: #dadee6;
  --tone-text: #606c80;
}

.iot-device-table {
  min-width: 1460px;
}

.gateway-table {
  min-width: 1020px;
}

.loading-state {
  align-items: center;
  color: #98a2b3;
  display: flex;
  font:
    800 12px/20px 'Inter',
    Arial,
    sans-serif;
  gap: 12px;
  padding: 34px 0;
}

.inline-spinner {
  animation: asset-spin 0.9s linear infinite;
  border: 3px solid #dadee6;
  border-top-color: #2563eb;
  border-radius: 50%;
  height: 34px;
  width: 34px;
}

.assets-table-wrapper {
  margin-top: 20px;
  overflow-x: auto;
}

.assets-table {
  border-collapse: collapse;
  min-width: 1060px;
  width: 100%;
}

.assets-table th {
  color: #aeaeae;
  font:
    400 12px/14px 'Varela Round',
    Arial,
    sans-serif;
  padding: 13px 12px;
  text-align: left;
}

.assets-table td {
  border-top: 0.5px solid #ececec;
  color: #404040;
  font:
    400 12px/14px 'Varela Round',
    Arial,
    sans-serif;
  padding: 13px 12px;
}

.incident,
.connectivity {
  align-items: center;
  display: inline-flex;
  gap: 7px;
}

.incident .material-icons {
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.incident.danger .material-icons {
  color: #dc2626;
}

.incident.warning .material-icons {
  color: #facc15;
}

.incident.cold .material-icons {
  color: #3361ff;
}

.incident.stable .material-icons {
  color: #22c55e;
}

.status-pill {
  border-radius: 8px;
  font-size: 12px;
  font-weight: 800;
  padding: 6px 10px;
}

.status-pill {
  background: var(--tone-bg, #ffffff);
  color: var(--tone-text, #404040);
  display: inline-flex;
  justify-content: center;
  min-width: 96px;
}

.connectivity.online {
  color: #176900;
}

.connectivity.unstable {
  color: #b16f0b;
}

.connectivity.offline {
  color: #b51313;
}

.empty-state {
  color: #98a2b3;
  padding: 28px 0;
  text-align: center;
}

.status-select-field {
  align-items: center;
  background: var(--tone-bg, #ffffff);
  border: 1px solid currentColor;
  border-radius: 8px;
  box-sizing: border-box;
  color: var(--tone-text, #404040);
  cursor: pointer;
  display: inline-flex;
  font:
    800 12px/14px 'Varela Round',
    Arial,
    sans-serif;
  gap: 6px;
  padding: 6px 10px;
}

.status-select-field span,
.status-select-field .material-icons {
  pointer-events: none;
}

.status-select-field .material-icons {
  color: var(--tone-text, #404040);
  font-size: 18px;
  height: 18px;
  line-height: 18px;
  width: 18px;
}

.status-select-field select {
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  font-weight: 800;
  outline: 0;
}

.status-select-field:focus-within {
  box-shadow: 0 0 0 2px rgba(154, 174, 235, 0.28);
}

.status-select-field.disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

@keyframes asset-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 900px) {
  .asset-tabs {
    flex-wrap: nowrap;
    gap: 24px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .asset-tabs::-webkit-scrollbar {
    display: none;
  }

  .asset-tabs button {
    flex: 0 0 auto;
    white-space: nowrap;
  }

  .assets-toolbar,
  .section-heading {
    align-items: stretch;
    flex-direction: column;
  }

  .search-box {
    box-sizing: border-box;
    flex: 0 0 auto;
    min-width: 0;
    width: 100%;
  }

  .primary-action {
    width: 100%;
  }

  .cold-room-form {
    grid-template-columns: 1fr;
  }

  .form-card,
  .table-card {
    padding: 20px;
  }
}

@media (max-width: 720px) {
  .asset-tabs {
    gap: 20px;
  }

  .assets-table {
    min-width: 0;
  }

  .assets-table thead {
    display: none;
  }

  .assets-table,
  .assets-table tbody,
  .assets-table tr,
  .assets-table td {
    display: block;
    width: 100%;
  }

  .assets-table tr {
    border-top: 0.5px solid #ececec;
    padding: 12px 0;
  }

  .assets-table td {
    border: 0;
    display: grid;
    gap: 14px;
    grid-template-columns: 120px 1fr;
    padding: 8px 0;
  }

  .assets-table td::before {
    color: #aeaeae;
    content: attr(data-label);
    font-weight: 800;
  }
}
</style>
