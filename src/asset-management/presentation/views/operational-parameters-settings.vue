<script setup>
import {computed, onMounted, reactive, ref} from 'vue';
import {storeToRefs} from 'pinia';
import {useI18n} from 'vue-i18n';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';
import {AssetStatus} from '@/asset-management/domain/model/asset-status.js';
import {GatewayStatus} from '@/asset-management/domain/model/gateway-status.js';
import {IoTDevice} from '@/asset-management/domain/model/iot-device-entity.js';
import {IoTDeviceStatus} from '@/asset-management/domain/model/iot-device-status.js';
import {IOT_DEVICE_DEFINITIONS} from '@/asset-management/domain/model/iot-device-definitions.js';

const {t} = useI18n();
const identityAccessStore = useIdentityAccessStore();
const assetManagementStore = useAssetManagementStore();
const {assets, iotDevices, gateways} = storeToRefs(assetManagementStore);

const parameterKeys = ['temperature', 'humidity', 'motion', 'image', 'battery', 'signal'];
const identityLoading = ref(false);
const saving = ref(false);
const submitted = ref(false);
const feedback = ref('idle');
const selectedAssetId = ref(0);
const selectedIoTDeviceId = ref(0);
const pageSize = 10;
const currentPage = ref(1);
const users = ref([]);
const roles = ref([]);
const organizations = ref([]);
const selectedFrequencyMinutes = ref(60);
const operationalForm = reactive({
    readingFrequencyMinutes: 60,
    temperature: true,
    humidity: true,
    motion: false,
    image: false,
    battery: false,
    signal: false,
});

const loading = computed(() => identityLoading.value || saving.value);
const activeOrganizationId = computed(() => identityAccessStore.currentOrganizationIdFrom(users.value));
const activeOrganizationName = computed(() =>
    identityAccessStore.currentOrganizationNameFrom(users.value, organizations.value),
);
const canUpdateOperationalParameters = computed(() =>
    identityAccessStore.canManageAssets(users.value, roles.value),
);
const organizationAssets = computed(() =>
    assetManagementStore.assetsForOrganization(activeOrganizationId.value, assets.value),
);
const organizationIoTDevices = computed(() =>
    assetManagementStore.iotDevicesForOrganization(activeOrganizationId.value, iotDevices.value),
);
const monitoredAssets = computed(() =>
    assetManagementStore.monitoredAssetsForOrganization(activeOrganizationId.value, assets.value, iotDevices.value),
);
const selectedAsset = computed(() =>
    organizationAssets.value.find(asset => asset.id === selectedAssetId.value) ?? null,
);
const selectedAssetDevices = computed(() =>
    assetManagementStore.iotDevicesForAsset(selectedAssetId.value, organizationIoTDevices.value),
);
const selectedIoTDevice = computed(() =>
    organizationIoTDevices.value.find(iotDevice => iotDevice.id === selectedIoTDeviceId.value) ?? null,
);
const selectedGateway = computed(() => {
    const asset = selectedAsset.value;
    return asset ? gateways.value.find(gateway => gateway.id === asset.gatewayId) ?? null : null;
});
const configuredDevices = computed(() =>
    organizationIoTDevices.value
        .filter(iotDevice => iotDevice.assetId !== null)
        .sort((a, b) => assetNameFor(a).localeCompare(assetNameFor(b))),
);
const paginatedConfiguredDevices = computed(() => {
    const startIndex = (currentPage.value - 1) * pageSize;
    return configuredDevices.value.slice(startIndex, startIndex + pageSize);
});
const currentIntervalLabel = computed(() => {
    const seconds = selectedIoTDevice.value?.readingFrequencySeconds ?? 3600;
    return minutesLabel(Math.round(seconds / 60));
});
const selectedIntervalLabel = computed(() => minutesLabel(selectedFrequencyMinutes.value));
const selectedParameters = computed(() =>
    parameterKeys.filter(parameter => operationalForm[parameter]),
);
const compatibilityIssueKey = computed(() => currentCompatibilityIssueKey());

onMounted(() => {
    loadPageData();
});

async function loadPageData() {
    identityLoading.value = true;
    feedback.value = 'idle';
    try {
        const [accessData] = await Promise.all([
            identityAccessStore.fetchAccessData(),
            assetManagementStore.fetchAssetManagementData({includeSettings: false}),
        ]);
        users.value = accessData.users;
        roles.value = accessData.roles;
        organizations.value = accessData.organizations;
        selectInitialScope();
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        identityLoading.value = false;
    }
}

function selectAsset(value) {
    selectedAssetId.value = Number(value);
    feedback.value = 'idle';
    submitted.value = false;
    selectFirstDeviceForAsset();
}

function selectIoTDevice(value) {
    selectedIoTDeviceId.value = Number(value);
    feedback.value = 'idle';
    submitted.value = false;
    resetOperationalForm();
}

function updateReadingFrequencyPreview(value) {
    const minutes = Number(value);
    selectedFrequencyMinutes.value = value.trim() && Number.isFinite(minutes) ? minutes : 0;
}

async function saveOperationalParameters() {
    submitted.value = true;
    feedback.value = 'idle';

    if (!canUpdateOperationalParameters.value) {
        feedback.value = 'access-denied';
        return;
    }

    if (hasInvalidOperationalForm()) {
        feedback.value = 'invalid';
        return;
    }

    if (compatibilityIssueKey.value) {
        feedback.value = 'incompatible';
        return;
    }

    const currentDevice = selectedIoTDevice.value;
    if (!currentDevice) {
        feedback.value = 'server-error';
        return;
    }

    const parameters = selectedParameters.value;
    const nextDevice = new IoTDevice({
        id: currentDevice.id,
        organizationId: currentDevice.organizationId,
        uuid: currentDevice.uuid,
        deviceType: currentDevice.deviceType,
        model: currentDevice.model,
        measurementType: measurementTypeLabel(parameters),
        assetId: currentDevice.assetId,
        status: currentDevice.status,
        calibrationStatus: currentDevice.calibrationStatus,
        lastCalibrationDate: currentDevice.lastCalibrationDate,
        nextCalibrationDate: currentDevice.nextCalibrationDate,
        measurementParameters: parameters,
        readingFrequencySeconds: Number(operationalForm.readingFrequencyMinutes) * 60,
    });

    saving.value = true;
    try {
        await assetManagementStore.updateIoTDevice(nextDevice);
        feedback.value = 'saved';
        submitted.value = false;
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        saving.value = false;
    }
}

function resetOperationalForm() {
    const iotDevice = selectedIoTDevice.value;
    const currentParameters = iotDevice?.measurementParameters ?? [];
    const readingFrequencyMinutes = Math.round((iotDevice?.readingFrequencySeconds ?? 3600) / 60);

    feedback.value = 'idle';
    submitted.value = false;
    operationalForm.readingFrequencyMinutes = readingFrequencyMinutes;
    for (const parameter of parameterKeys) {
        operationalForm[parameter] = currentParameters.includes(parameter);
    }
    selectedFrequencyMinutes.value = readingFrequencyMinutes;
    for (const parameter of parameterKeys) {
        if (!isParameterSupported(parameter)) operationalForm[parameter] = false;
    }
}

function hasFrequencyError() {
    const frequency = Number(operationalForm.readingFrequencyMinutes);
    return submitted.value && (!Number.isFinite(frequency) || frequency < 5 || frequency > 1440);
}

function hasCriteriaError() {
    return submitted.value && !hasSelectedCriteria();
}

function isParameterSupported(parameter) {
    return supportedParametersFor(selectedIoTDevice.value).includes(parameter);
}

function parameterLabelKey(parameter) {
    return `asset-management.iot-devices.measurement-parameters.${parameter}`;
}

function assetNameFor(iotDevice) {
    const asset = organizationAssets.value.find(currentAsset => currentAsset.id === iotDevice.assetId);
    return asset ? `${asset.uuid} - ${asset.name}` : 'N/A';
}

function assetLocationFor(iotDevice) {
    const asset = organizationAssets.value.find(currentAsset => currentAsset.id === iotDevice.assetId);
    return asset ? assetManagementStore.locationForAsset(asset, gateways.value) : 'N/A';
}

function frequencyLabelFor(iotDevice) {
    return `${Math.round(iotDevice.readingFrequencySeconds / 60)} min`;
}

function criteriaLabelFor(iotDevice) {
    return iotDevice.measurementParameters.map(parameter => parameter.replace('-', ' ')).join(' / ');
}

function operationalStatusKey(iotDevice) {
    const asset = organizationAssets.value.find(currentAsset => currentAsset.id === iotDevice.assetId);
    const gateway = asset ? gateways.value.find(currentGateway => currentGateway.id === asset.gatewayId) : null;

    if (!asset || asset.status !== AssetStatus.Active) {
        return 'asset-management.operational-parameters.table.status-asset-inactive';
    }
    if (iotDevice.status !== IoTDeviceStatus.Linked) {
        return 'asset-management.operational-parameters.table.status-device-unlinked';
    }
    if (!gateway || gateway.status === GatewayStatus.Offline) {
        return 'asset-management.operational-parameters.table.status-gateway-offline';
    }

    const supportedParameters = supportedParametersFor(iotDevice);
    if (iotDevice.measurementParameters.some(parameter => !supportedParameters.includes(parameter))) {
        return 'asset-management.operational-parameters.table.status-criteria-incompatible';
    }
    return 'asset-management.operational-parameters.table.status-active';
}

function operationalStatusClass(iotDevice) {
    const statusKey = operationalStatusKey(iotDevice);
    if (statusKey.endsWith('status-active')) return 'status-compliant';
    return statusKey.endsWith('status-gateway-offline') ? 'status-danger' : 'status-observation';
}

function selectInitialScope() {
    const firstAsset = preferredInitialAsset();
    selectedAssetId.value = firstAsset?.id ?? 0;
    selectFirstDeviceForAsset();
}

function selectFirstDeviceForAsset() {
    const firstDevice = selectedAssetDevices.value[0];
    selectedIoTDeviceId.value = firstDevice?.id ?? 0;
    resetOperationalForm();
}

function hasSelectedCriteria() {
    return selectedParameters.value.length > 0;
}

function hasInvalidOperationalForm() {
    const frequency = Number(operationalForm.readingFrequencyMinutes);
    return !Number.isFinite(frequency) || frequency < 5 || frequency > 1440 || !selectedIoTDevice.value || !hasSelectedCriteria();
}

function preferredInitialAsset() {
    return monitoredAssets.value.find(asset => {
        const gateway = gateways.value.find(currentGateway => currentGateway.id === asset.gatewayId);
        return (
            asset.status === AssetStatus.Active &&
            gateway?.status === GatewayStatus.Active &&
            organizationIoTDevices.value.some(iotDevice => iotDevice.assetId === asset.id && iotDevice.status === IoTDeviceStatus.Linked)
        );
    }) ?? monitoredAssets.value[0];
}

function currentCompatibilityIssueKey() {
    const asset = selectedAsset.value;
    const iotDevice = selectedIoTDevice.value;
    const gateway = selectedGateway.value;

    if (!asset || !iotDevice) return null;
    if (asset.status !== AssetStatus.Active) return 'asset-management.operational-parameters.compatibility.asset-inactive';
    if (iotDevice.assetId !== asset.id || iotDevice.status !== IoTDeviceStatus.Linked) {
        return 'asset-management.operational-parameters.compatibility.device-unlinked';
    }
    if (!gateway || gateway.status === GatewayStatus.Offline) {
        return 'asset-management.operational-parameters.compatibility.gateway-offline';
    }
    if (selectedParameters.value.some(parameter => !isParameterSupported(parameter))) {
        return 'asset-management.operational-parameters.compatibility.criteria-incompatible';
    }
    return null;
}

function supportedParametersFor(iotDevice) {
    if (!iotDevice) return [];
    return IOT_DEVICE_DEFINITIONS.find(definition => definition.type === iotDevice.deviceType)?.parameters ??
        toKnownParameters(iotDevice.measurementParameters);
}

function toKnownParameters(parameters) {
    return parameters.filter(parameter => parameterKeys.includes(parameter));
}

function measurementTypeLabel(parameters) {
    const labelByParameter = {
        temperature: 'Temperature',
        humidity: 'Humidity',
        motion: 'Motion',
        image: 'Image',
        battery: 'Battery',
        signal: 'Signal',
    };
    return parameters.map(parameter => labelByParameter[parameter]).join(' / ');
}

function minutesLabel(minutes) {
    return Number.isFinite(minutes) && minutes > 0 ? `${minutes} min` : 'N/A';
}
</script>

<template>
  <section class="page asset-settings-page operational-parameters-view" aria-labelledby="operational-parameters-title">
    <div v-if="loading" class="loading-overlay">
      <span class="inline-spinner" aria-hidden="true"></span>
    </div>

    <div class="page-heading">
      <div>
        <span class="section-kicker">{{ activeOrganizationName }}</span>
        <h1 id="operational-parameters-title">{{ t('asset-management.operational-parameters.title') }}</h1>
        <p>{{ t('asset-management.operational-parameters.subtitle') }}</p>
      </div>

      <div class="heading-actions">
        <button type="button" class="secondary-action" @click="loadPageData">
          <span class="material-icons" aria-hidden="true">refresh</span>
          {{ t('asset-management.operational-parameters.reload') }}
        </button>
      </div>
    </div>

    <p v-if="feedback === 'saved'" class="feedback success">{{ t('asset-management.operational-parameters.feedback-saved') }}</p>
    <p v-if="feedback === 'invalid'" class="feedback warning">{{ t('asset-management.operational-parameters.feedback-invalid') }}</p>
    <p v-if="feedback === 'incompatible'" class="feedback warning">{{ t('asset-management.operational-parameters.feedback-incompatible') }}</p>
    <p v-if="feedback === 'access-denied'" class="feedback warning">{{ t('asset-management.operational-parameters.feedback-access-denied') }}</p>
    <p v-if="feedback === 'server-error'" class="feedback error">{{ t('asset-management.operational-parameters.feedback-error') }}</p>

    <section v-if="!canUpdateOperationalParameters && !identityLoading" class="access-banner" aria-live="polite">
      <span class="material-icons" aria-hidden="true">lock</span>
      <div>
        <h2>{{ t('asset-management.operational-parameters.access-title') }}</h2>
        <p>{{ t('asset-management.operational-parameters.access-description') }}</p>
      </div>
    </section>

    <section class="filter-card operational-filter" aria-label="Operational parameter scope">
      <label class="filter-field">
        <span>{{ t('asset-management.operational-parameters.form.asset') }}</span>
        <select :value="selectedAssetId" @change="selectAsset($event.target.value)">
          <option :value="0">{{ t('asset-management.operational-parameters.form.select-asset') }}</option>
          <option v-for="asset in monitoredAssets" :key="asset.id" :value="asset.id">
            {{ asset.uuid }} - {{ asset.name }}
          </option>
        </select>
      </label>

      <label class="filter-field">
        <span>{{ t('asset-management.operational-parameters.form.device') }}</span>
        <select :value="selectedIoTDeviceId" @change="selectIoTDevice($event.target.value)">
          <option :value="0">{{ t('asset-management.operational-parameters.form.select-device') }}</option>
          <option v-for="iotDevice in selectedAssetDevices" :key="iotDevice.id" :value="iotDevice.id">
            {{ iotDevice.uuid }} - {{ iotDevice.model }}
          </option>
        </select>
      </label>

      <div class="filter-meta">
        <span>{{ t('asset-management.operational-parameters.form.current-interval') }}</span>
        <strong>{{ currentIntervalLabel }}</strong>
      </div>
    </section>

    <section class="summary-grid" aria-label="Operational parameter summary">
      <article class="summary-card accent-blue">
        <span>{{ t('asset-management.operational-parameters.summary-assets') }}</span>
        <strong>{{ monitoredAssets.length }}</strong>
      </article>
      <article class="summary-card accent-green">
        <span>{{ t('asset-management.operational-parameters.summary-devices') }}</span>
        <strong>{{ configuredDevices.length }}</strong>
      </article>
      <article class="summary-card accent-amber">
        <span>{{ t('asset-management.operational-parameters.summary-interval') }}</span>
        <strong>{{ selectedIntervalLabel }}</strong>
      </article>
      <article class="summary-card accent-red">
        <span>{{ t('asset-management.operational-parameters.summary-criteria') }}</span>
        <strong>{{ selectedParameters.length }}</strong>
      </article>
    </section>

    <section class="table-card parameters-card" aria-labelledby="operational-parameters-form-title">
      <div class="section-heading">
        <div>
          <h2 id="operational-parameters-form-title">{{ t('asset-management.operational-parameters.form-title') }}</h2>
          <p>{{ t('asset-management.operational-parameters.form-subtitle') }}</p>
        </div>

        <button type="button" class="secondary-action" :disabled="saving" @click="resetOperationalForm">
          <span class="material-icons" aria-hidden="true">restart_alt</span>
          {{ t('asset-management.operational-parameters.reset') }}
        </button>
      </div>

      <div v-if="compatibilityIssueKey" class="compatibility-banner" aria-live="polite">
        <span class="material-icons" aria-hidden="true">report</span>
        <span>{{ t(compatibilityIssueKey) }}</span>
      </div>

      <form class="parameters-form" @submit.prevent="saveOperationalParameters">
        <div class="settings-grid">
          <label class="filter-field">
            <span>{{ t('asset-management.operational-parameters.form.reading-frequency') }}</span>
            <input
              v-model.number="operationalForm.readingFrequencyMinutes"
              type="number"
              min="5"
              max="1440"
              step="5"
              @input="updateReadingFrequencyPreview($event.target.value)"
            />
            <small v-if="hasFrequencyError()">{{ t('asset-management.operational-parameters.form.frequency-error') }}</small>
          </label>

          <div class="criteria-panel">
            <span class="field-label">{{ t('asset-management.operational-parameters.form.criteria') }}</span>
            <div class="criteria-grid">
              <label
                v-for="parameter in parameterKeys"
                :key="parameter"
                class="parameter-option"
                :class="{disabled: !isParameterSupported(parameter)}"
              >
                <input v-model="operationalForm[parameter]" type="checkbox" :disabled="!isParameterSupported(parameter)"/>
                <span>{{ t(parameterLabelKey(parameter)) }}</span>
              </label>
            </div>
            <small v-if="hasCriteriaError()">{{ t('asset-management.operational-parameters.form.criteria-error') }}</small>
          </div>

          <div class="save-actions">
            <button type="submit" class="primary-action" :disabled="saving || !canUpdateOperationalParameters">
              <span class="material-icons" aria-hidden="true">save</span>
              {{ t(saving ? 'asset-management.operational-parameters.saving' : 'asset-management.operational-parameters.save') }}
            </button>
          </div>
        </div>
      </form>
    </section>

    <section class="table-card" aria-labelledby="operational-profiles-title">
      <div class="section-heading">
        <div>
          <h2 id="operational-profiles-title">{{ t('asset-management.operational-parameters.table-title') }}</h2>
          <p>{{ t('asset-management.operational-parameters.table-subtitle') }}</p>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('asset-management.operational-parameters.table.asset') }}</th>
              <th>{{ t('asset-management.operational-parameters.table.location') }}</th>
              <th>{{ t('asset-management.operational-parameters.table.device') }}</th>
              <th>{{ t('asset-management.operational-parameters.table.frequency') }}</th>
              <th>{{ t('asset-management.operational-parameters.table.criteria') }}</th>
              <th>{{ t('asset-management.operational-parameters.table.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="iotDevice in paginatedConfiguredDevices" :key="iotDevice.id">
              <td>{{ assetNameFor(iotDevice) }}</td>
              <td>{{ assetLocationFor(iotDevice) }}</td>
              <td>{{ iotDevice.uuid }} - {{ iotDevice.model }}</td>
              <td>{{ frequencyLabelFor(iotDevice) }}</td>
              <td>{{ criteriaLabelFor(iotDevice) }}</td>
              <td>
                <span class="status-pill" :class="operationalStatusClass(iotDevice)">
                  {{ t(operationalStatusKey(iotDevice)) }}
                </span>
              </td>
            </tr>
            <tr v-if="!configuredDevices.length">
              <td colspan="6" class="empty-state">{{ t('asset-management.operational-parameters.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <list-pagination v-model="currentPage" :total="configuredDevices.length" :page-size="pageSize"/>
    </section>
  </section>
</template>

<style scoped>
.page {
  background: #f5f6f8;
  min-height: 100%;
  padding: 18px 22px 44px;
}

.loading-overlay {
  align-items: center;
  background: rgba(245, 246, 248, 0.74);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 20;
}

.inline-spinner {
  animation: settings-spin 0.9s linear infinite;
  border: 3px solid #dadee6;
  border-top-color: #2563eb;
  border-radius: 50%;
  height: 40px;
  width: 40px;
}

.page-heading,
.section-heading,
.feedback,
.filter-card,
.summary-grid,
.table-card,
.access-banner {
  max-width: 1180px;
}

.page-heading,
.section-heading {
  align-items: flex-start;
  display: flex;
  gap: 20px;
  justify-content: space-between;
}

.page-heading h1 {
  color: #263348;
  font-size: 22px;
  margin: 0;
}

.section-heading h2,
.access-banner h2 {
  color: #323c4d;
  font-size: 14px;
  font-weight: 800;
  margin: 0;
}

.page-heading p,
.section-heading p {
  color: #98a2b3;
  font-size: 12px;
  font-weight: 800;
  margin: 6px 0 0;
}

.section-kicker {
  color: #2563eb;
  display: block;
  font-size: 11px;
  font-weight: 800;
  margin-bottom: 4px;
}

.heading-actions {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: flex-end;
}

.primary-action,
.secondary-action {
  align-items: center;
  border-radius: 8px;
  box-shadow: none;
  cursor: pointer;
  display: inline-flex;
  font-size: 12px;
  font-weight: 800;
  gap: 8px;
  min-height: 36px;
  padding: 7px 12px;
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

.primary-action:disabled,
.secondary-action:disabled {
  cursor: not-allowed;
  opacity: 0.7;
}

.feedback,
.filter-card,
.table-card,
.access-banner {
  border-radius: 8px;
  margin-top: 20px;
}

.feedback {
  font-size: 12px;
  font-weight: 800;
  padding: 10px 14px;
}

.success {
  background: #eaf8f0;
  color: #176900;
}

.warning {
  background: #fff8e8;
  color: #8a5607;
}

.error {
  background: #feeceb;
  color: #b51313;
}

.filter-card,
.table-card,
.summary-card {
  background: #ffffff;
  box-shadow: 0 2px 6px rgba(96, 108, 128, 0.16);
}

.filter-card {
  align-items: end;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(180px, 240px)) minmax(140px, 1fr);
  padding: 20px 24px;
}

.operational-filter {
  grid-template-columns: minmax(220px, 360px) minmax(220px, 360px) minmax(160px, 1fr);
}

.filter-field {
  display: grid;
  gap: 6px;
}

.filter-field span,
.filter-meta span,
.summary-card span,
.data-table th,
.data-table small {
  font-size: 12px;
  font-weight: 800;
}

.filter-field span,
.filter-meta span {
  color: #404040;
}

.filter-field input,
.filter-field select {
  background: #f4f4f4;
  border: 1px solid transparent;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.14);
  box-sizing: border-box;
  color: #404040;
  font-size: 13px;
  min-height: 38px;
  outline: none;
  padding: 9px 12px;
  width: 100%;
}

.filter-field small,
.criteria-panel small {
  color: #b51313;
  font-size: 11px;
  font-weight: 800;
}

.filter-meta {
  align-items: center;
  display: flex;
  justify-content: flex-end;
}

.filter-meta strong,
.summary-card strong {
  color: var(--accent-text, #2563eb);
  font-size: 24px;
  font-weight: 800;
}

.summary-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 20px;
}

.summary-card {
  border-radius: 8px;
  display: grid;
  gap: 6px;
  padding: 16px 18px;
}

.summary-card span,
.data-table th,
.data-table td span,
.data-table small {
  color: #98a2b3;
}

.accent-blue {
  --accent-text: #2563eb;
}

.accent-green {
  --accent-text: #176900;
}

.accent-amber {
  --accent-text: #b16f0b;
}

.accent-red {
  --accent-text: #b51313;
}

.access-banner {
  align-items: flex-start;
  background: #feeceb;
  border: 1px solid rgba(181, 19, 19, 0.2);
  color: #b51313;
  display: flex;
  gap: 12px;
  padding: 14px 16px;
}

.access-banner .material-icons,
.access-banner h2,
.access-banner p {
  color: #b51313;
}

.access-banner p {
  font-weight: 700;
  margin-top: 3px;
}

.table-card {
  padding: 20px 24px;
}

.parameters-card,
.parameters-form {
  display: grid;
  gap: 18px;
}

.settings-grid {
  align-items: start;
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(180px, 240px) minmax(360px, 1fr) minmax(140px, auto);
}

.field-label {
  color: #344054;
  display: block;
  font-size: 12px;
  font-weight: 900;
  margin-bottom: 8px;
}

.criteria-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(3, minmax(130px, 1fr));
}

.parameter-option {
  align-items: center;
  background: #f8fafc;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  color: #344054;
  display: flex;
  font-size: 13px;
  font-weight: 800;
  gap: 8px;
  min-height: 44px;
  padding: 8px 10px;
}

.parameter-option.disabled {
  color: #98a2b3;
}

.parameter-option input {
  accent-color: #2563eb;
}

.compatibility-banner {
  align-items: center;
  background: #fff7e8;
  border: 1px solid #f6d69a;
  border-radius: 8px;
  color: #9a5b11;
  display: flex;
  font-weight: 900;
  gap: 10px;
  padding: 12px 14px;
}

.save-actions {
  align-items: end;
  display: flex;
  min-height: 66px;
}

.save-actions .primary-action {
  min-width: 172px;
}

.table-wrapper {
  margin-top: 18px;
  overflow-x: auto;
}

.data-table {
  border-collapse: collapse;
  min-width: 1020px;
  width: 100%;
}

.data-table th {
  padding: 0 10px 12px;
  text-align: left;
}

.data-table td {
  border-top: 1px solid #ebeef2;
  font-size: 12px;
  font-weight: 700;
  padding: 12px 10px;
}

.status-pill {
  border-radius: 16px;
  display: inline-flex !important;
  padding: 3px 8px;
}

.status-compliant {
  background: #eaf8f0;
  color: #176900 !important;
}

.status-observation {
  background: #fff8e8;
  color: #b16f0b !important;
}

.status-danger {
  background: #fff1f0;
  color: #b42318;
}

.empty-state {
  color: #98a2b3;
  font-weight: 800;
  text-align: center;
}

@keyframes settings-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 1080px) {
  .page-heading,
  .filter-card,
  .operational-filter,
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .criteria-grid {
    grid-template-columns: repeat(2, minmax(130px, 1fr));
  }

  .save-actions {
    min-height: auto;
  }
}

@media (max-width: 640px) {
  .summary-grid,
  .criteria-grid {
    grid-template-columns: 1fr;
  }
}
</style>
