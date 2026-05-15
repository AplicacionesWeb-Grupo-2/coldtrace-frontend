<script setup>
import {computed, onMounted, reactive, ref} from 'vue';
import {storeToRefs} from 'pinia';
import {useI18n} from 'vue-i18n';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';
import {
    buildDefaultAssetSettings,
    DEFAULT_ASSET_SETTING_VALUES,
} from '@/asset-management/domain/model/asset-settings-defaults.js';
import {AssetSettings} from '@/asset-management/domain/model/asset-settings-entity.js';

const {t} = useI18n();
const identityAccessStore = useIdentityAccessStore();
const assetManagementStore = useAssetManagementStore();
const {assets, iotDevices, gateways, assetSettings} = storeToRefs(assetManagementStore);

const identityLoading = ref(false);
const saving = ref(false);
const submitted = ref(false);
const feedback = ref('idle');
const selectedAssetId = ref(0);
const pageSize = 10;
const currentPage = ref(1);
const users = ref([]);
const roles = ref([]);
const organizations = ref([]);
const selectedMinimumTemperature = ref(DEFAULT_ASSET_SETTING_VALUES.minimumTemperature);
const selectedMaximumTemperature = ref(DEFAULT_ASSET_SETTING_VALUES.maximumTemperature);
const selectedMaximumHumidity = ref(DEFAULT_ASSET_SETTING_VALUES.maximumHumidity);
const rangeForm = reactive({
    minimumTemperature: DEFAULT_ASSET_SETTING_VALUES.minimumTemperature,
    maximumTemperature: DEFAULT_ASSET_SETTING_VALUES.maximumTemperature,
    maximumHumidity: DEFAULT_ASSET_SETTING_VALUES.maximumHumidity,
});

const loading = computed(() => identityLoading.value || saving.value);
const activeOrganizationId = computed(() => identityAccessStore.currentOrganizationIdFrom(users.value));
const activeOrganizationName = computed(() =>
    identityAccessStore.currentOrganizationNameFrom(users.value, organizations.value),
);
const canManageSafetyRanges = computed(() =>
    identityAccessStore.canManageAssets(users.value, roles.value),
);
const organizationAssets = computed(() =>
    assetManagementStore.assetsForOrganization(activeOrganizationId.value, assets.value),
);
const monitoredAssets = computed(() =>
    assetManagementStore.monitoredAssetsForOrganization(activeOrganizationId.value, assets.value, iotDevices.value),
);
const organizationSettings = computed(() =>
    assetManagementStore.assetSettingsForOrganization(activeOrganizationId.value, assetSettings.value),
);
const assetSpecificSettingsCount = computed(() =>
    organizationSettings.value.filter(settings => settings.assetId !== null).length,
);
const selectedSettings = computed(() => settingsForSelectedScope() ?? defaultSettingsForSelectedScope());
const currentRangeLabel = computed(() => {
    const settings = selectedSettings.value;
    return temperatureRangeLabel(settings.minimumTemperature, settings.maximumTemperature, settings.temperatureUnit);
});
const selectedRangeLabel = computed(() =>
    temperatureRangeLabel(
        selectedMinimumTemperature.value,
        selectedMaximumTemperature.value,
        selectedSettings.value.temperatureUnit,
    ),
);
const selectedHumidityLabel = computed(() =>
    humidityLabel(selectedMaximumHumidity.value, selectedSettings.value.humidityUnit),
);
const currentProfiles = computed(() =>
    [...organizationSettings.value].sort((a, b) => {
        if (a.assetId === null) return -1;
        if (b.assetId === null) return 1;
        return scopeNameFor(a).localeCompare(scopeNameFor(b));
    }),
);
const paginatedProfiles = computed(() => {
    const startIndex = (currentPage.value - 1) * pageSize;
    return currentProfiles.value.slice(startIndex, startIndex + pageSize);
});
const rangeErrors = computed(() => ({
    minimumTemperature: !Number.isFinite(Number(rangeForm.minimumTemperature)),
    maximumTemperature: !Number.isFinite(Number(rangeForm.maximumTemperature)),
    maximumHumidity:
        !Number.isFinite(Number(rangeForm.maximumHumidity)) ||
        Number(rangeForm.maximumHumidity) < 1 ||
        Number(rangeForm.maximumHumidity) > 100,
}));

onMounted(() => {
    loadPageData();
});

async function loadPageData() {
    identityLoading.value = true;
    feedback.value = 'idle';
    try {
        const [accessData] = await Promise.all([
            identityAccessStore.fetchAccessData(),
            assetManagementStore.fetchAssetManagementData(),
        ]);
        users.value = accessData.users;
        roles.value = accessData.roles;
        organizations.value = accessData.organizations;
        resetRangeForm();
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        identityLoading.value = false;
    }
}

function selectScope(value) {
    selectedAssetId.value = Number(value);
    feedback.value = 'idle';
    submitted.value = false;
    resetRangeForm();
}

function updateMinimumTemperaturePreview(value) {
    selectedMinimumTemperature.value = numberFromInput(value);
}

function updateMaximumTemperaturePreview(value) {
    selectedMaximumTemperature.value = numberFromInput(value);
}

function updateMaximumHumidityPreview(value) {
    selectedMaximumHumidity.value = numberFromInput(value);
}

async function saveRangeSettings() {
    submitted.value = true;
    feedback.value = 'idle';

    if (!canManageSafetyRanges.value) {
        feedback.value = 'access-denied';
        return;
    }

    if (hasInvalidRangeForm()) {
        feedback.value = 'invalid';
        return;
    }

    const organizationId = activeOrganizationId.value;
    if (!organizationId) {
        feedback.value = 'server-error';
        return;
    }

    const assetId = selectedAssetId.value || null;
    const currentSettings = settingsForScope(assetId);
    const fallbackSettings = currentSettings ?? defaultSettingsForSelectedScope();
    const nextSettings = new AssetSettings({
        id: currentSettings?.id ?? nextSettingsId(),
        organizationId,
        uuid: currentSettings?.uuid ?? generatedSettingsUuid(organizationId, assetId),
        assetTypes: fallbackSettings.assetTypes,
        iotDeviceTypes: fallbackSettings.iotDeviceTypes,
        minimumTemperature: Number(rangeForm.minimumTemperature),
        maximumTemperature: Number(rangeForm.maximumTemperature),
        maximumHumidity: Number(rangeForm.maximumHumidity),
        calibrationFrequencyDays: fallbackSettings.calibrationFrequencyDays,
        temperatureUnit: fallbackSettings.temperatureUnit,
        humidityUnit: fallbackSettings.humidityUnit,
        weightUnit: fallbackSettings.weightUnit,
        assetId,
    });

    saving.value = true;
    try {
        if (currentSettings) await assetManagementStore.updateAssetSettings(nextSettings);
        else await assetManagementStore.createAssetSettings(nextSettings);
        feedback.value = 'saved';
        submitted.value = false;
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        saving.value = false;
    }
}

function resetRangeForm() {
    const settings = selectedSettings.value;
    feedback.value = 'idle';
    submitted.value = false;
    rangeForm.minimumTemperature = settings.minimumTemperature;
    rangeForm.maximumTemperature = settings.maximumTemperature;
    rangeForm.maximumHumidity = settings.maximumHumidity;
    selectedMinimumTemperature.value = settings.minimumTemperature;
    selectedMaximumTemperature.value = settings.maximumTemperature;
    selectedMaximumHumidity.value = settings.maximumHumidity;
}

function hasRangeControlError(controlName) {
    return rangeErrors.value[controlName] && submitted.value;
}

function hasTemperatureRangeError() {
    return submitted.value && !hasValidTemperatureRange();
}

function scopeNameFor(settings) {
    if (settings.assetId === null) return 'asset-management.safety-ranges.scope-default';
    const asset = organizationAssets.value.find(currentAsset => currentAsset.id === settings.assetId);
    return asset ? `${asset.uuid} - ${asset.name}` : `#${settings.assetId}`;
}

function scopeLocationFor(settings) {
    if (settings.assetId === null) return 'asset-management.safety-ranges.scope-default-description';
    const asset = organizationAssets.value.find(currentAsset => currentAsset.id === settings.assetId);
    return asset ? assetManagementStore.locationForAsset(asset, gateways.value) : 'N/A';
}

function settingStatusKey(settings) {
    return settings.assetId === null
        ? 'asset-management.safety-ranges.table.default-status'
        : 'asset-management.safety-ranges.table.asset-status';
}

function settingStatusClass(settings) {
    return settings.assetId === null ? 'status-compliant' : 'status-observation';
}

function hasInvalidRangeForm() {
    return Object.values(rangeErrors.value).some(Boolean) || !hasValidTemperatureRange();
}

function hasValidTemperatureRange() {
    return Number(rangeForm.minimumTemperature) < Number(rangeForm.maximumTemperature);
}

function settingsForSelectedScope() {
    return settingsForScope(selectedAssetId.value || null);
}

function settingsForScope(assetId) {
    const organizationId = activeOrganizationId.value;
    if (!organizationId) return undefined;
    return organizationSettings.value.find(settings => settings.assetId === assetId);
}

function defaultSettingsForSelectedScope() {
    const organizationId = activeOrganizationId.value ?? 0;
    const assetId = selectedAssetId.value || null;
    const organizationDefault = settingsForScope(null) ?? organizationSettings.value[0] ?? null;
    return buildDefaultAssetSettings(
        organizationDefault?.id ?? nextSettingsId(),
        organizationId,
        organizationDefault?.uuid ?? generatedSettingsUuid(organizationId, assetId),
        assetId,
        organizationDefault,
    );
}

function nextSettingsId() {
    const localMax = Math.max(...assetSettings.value.map(settings => settings.id), 0);
    const storeMax = assetManagementStore.nextAssetSettingsId() - 1;
    return Math.max(localMax, storeMax) + 1;
}

function generatedSettingsUuid(organizationId, assetId) {
    const organizationPart = organizationId.toString().padStart(3, '0');
    if (!assetId) return `CFG-${organizationPart}`;
    return `CFG-${organizationPart}-A${assetId.toString().padStart(3, '0')}`;
}

function temperatureRangeLabel(minimumTemperature, maximumTemperature, temperatureUnit) {
    if (!Number.isFinite(Number(minimumTemperature)) || !Number.isFinite(Number(maximumTemperature))) return 'N/A';
    return `${minimumTemperature}${temperatureUnit} - ${maximumTemperature}${temperatureUnit}`;
}

function humidityLabel(maximumHumidity, humidityUnit) {
    return Number.isFinite(Number(maximumHumidity)) ? `${maximumHumidity}${humidityUnit}` : 'N/A';
}

function numberFromInput(value) {
    const numericValue = Number(value);
    return value.trim() && Number.isFinite(numericValue) ? numericValue : Number.NaN;
}

function translateOrText(value) {
    return typeof value === 'string' && value.startsWith('asset-management.') ? t(value) : value;
}
</script>

<template>
  <section class="page asset-settings-page safety-ranges-view" aria-labelledby="safety-ranges-title">
    <div v-if="loading" class="loading-overlay">
      <span class="inline-spinner" aria-hidden="true"></span>
    </div>

    <div class="page-heading">
      <div>
        <span class="section-kicker">{{ activeOrganizationName }}</span>
        <h1 id="safety-ranges-title">{{ t('asset-management.safety-ranges.title') }}</h1>
        <p>{{ t('asset-management.safety-ranges.subtitle') }}</p>
      </div>

      <div class="heading-actions">
        <button type="button" class="secondary-action" @click="loadPageData">
          <span class="material-icons" aria-hidden="true">refresh</span>
          {{ t('asset-management.safety-ranges.reload') }}
        </button>
      </div>
    </div>

    <p v-if="feedback === 'saved'" class="feedback success">{{ t('asset-management.safety-ranges.feedback-saved') }}</p>
    <p v-if="feedback === 'invalid'" class="feedback warning">{{ t('asset-management.safety-ranges.feedback-invalid') }}</p>
    <p v-if="feedback === 'access-denied'" class="feedback warning">{{ t('asset-management.safety-ranges.feedback-access-denied') }}</p>
    <p v-if="feedback === 'server-error'" class="feedback error">{{ t('asset-management.safety-ranges.feedback-error') }}</p>

    <section v-if="!canManageSafetyRanges && !identityLoading" class="access-banner" aria-live="polite">
      <span class="material-icons" aria-hidden="true">lock</span>
      <div>
        <h2>{{ t('asset-management.safety-ranges.access-title') }}</h2>
        <p>{{ t('asset-management.safety-ranges.access-description') }}</p>
      </div>
    </section>

    <section class="filter-card safety-filter" aria-label="Safety range scope">
      <label class="filter-field scope-field">
        <span>{{ t('asset-management.safety-ranges.form.scope') }}</span>
        <select :value="selectedAssetId" @change="selectScope($event.target.value)">
          <option :value="0">{{ t('asset-management.safety-ranges.form.default-scope') }}</option>
          <option v-for="asset in monitoredAssets" :key="asset.id" :value="asset.id">
            {{ asset.uuid }} - {{ asset.name }}
          </option>
        </select>
      </label>

      <div class="filter-meta">
        <span>{{ t('asset-management.safety-ranges.form.selected-range') }}</span>
        <strong>{{ currentRangeLabel }}</strong>
      </div>
    </section>

    <section class="summary-grid" aria-label="Safety range summary">
      <article class="summary-card accent-blue">
        <span>{{ t('asset-management.safety-ranges.summary-assets') }}</span>
        <strong>{{ monitoredAssets.length }}</strong>
      </article>
      <article class="summary-card accent-green">
        <span>{{ t('asset-management.safety-ranges.summary-profiles') }}</span>
        <strong>{{ assetSpecificSettingsCount }}</strong>
      </article>
      <article class="summary-card accent-amber">
        <span>{{ t('asset-management.safety-ranges.summary-temperature') }}</span>
        <strong>{{ selectedRangeLabel }}</strong>
      </article>
      <article class="summary-card accent-red">
        <span>{{ t('asset-management.safety-ranges.summary-humidity') }}</span>
        <strong>{{ selectedHumidityLabel }}</strong>
      </article>
    </section>

    <section class="table-card settings-card" aria-labelledby="safety-range-form-title">
      <div class="section-heading">
        <div>
          <h2 id="safety-range-form-title">{{ t('asset-management.safety-ranges.form-title') }}</h2>
          <p>{{ t('asset-management.safety-ranges.form-subtitle') }}</p>
        </div>

        <button type="button" class="secondary-action" :disabled="saving" @click="resetRangeForm">
          <span class="material-icons" aria-hidden="true">restart_alt</span>
          {{ t('asset-management.safety-ranges.reset') }}
        </button>
      </div>

      <form class="settings-form" @submit.prevent="saveRangeSettings">
        <div class="settings-grid">
          <label class="filter-field">
            <span>{{ t('asset-management.safety-ranges.form.minimum-temperature') }}</span>
            <input v-model.number="rangeForm.minimumTemperature" type="number" step="0.1" @input="updateMinimumTemperaturePreview($event.target.value)"/>
            <small v-if="hasRangeControlError('minimumTemperature')">{{ t('asset-management.safety-ranges.form.number-error') }}</small>
          </label>

          <label class="filter-field">
            <span>{{ t('asset-management.safety-ranges.form.maximum-temperature') }}</span>
            <input v-model.number="rangeForm.maximumTemperature" type="number" step="0.1" @input="updateMaximumTemperaturePreview($event.target.value)"/>
            <small v-if="hasRangeControlError('maximumTemperature') || hasTemperatureRangeError()">
              {{ t(hasTemperatureRangeError() ? 'asset-management.safety-ranges.form.temperature-range-error' : 'asset-management.safety-ranges.form.number-error') }}
            </small>
          </label>

          <label class="filter-field">
            <span>{{ t('asset-management.safety-ranges.form.maximum-humidity') }}</span>
            <input v-model.number="rangeForm.maximumHumidity" type="number" step="1" @input="updateMaximumHumidityPreview($event.target.value)"/>
            <small v-if="hasRangeControlError('maximumHumidity')">{{ t('asset-management.safety-ranges.form.humidity-error') }}</small>
          </label>

          <div class="save-actions">
            <button type="submit" class="primary-action" :disabled="saving || !canManageSafetyRanges">
              <span class="material-icons" aria-hidden="true">save</span>
              {{ t(saving ? 'asset-management.safety-ranges.saving' : 'asset-management.safety-ranges.save') }}
            </button>
          </div>
        </div>
      </form>
    </section>

    <section class="table-card" aria-labelledby="range-profiles-title">
      <div class="section-heading">
        <div>
          <h2 id="range-profiles-title">{{ t('asset-management.safety-ranges.table-title') }}</h2>
          <p>{{ t('asset-management.safety-ranges.table-subtitle') }}</p>
        </div>
      </div>

      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>{{ t('asset-management.safety-ranges.table.scope') }}</th>
              <th>{{ t('asset-management.safety-ranges.table.location') }}</th>
              <th>{{ t('asset-management.safety-ranges.table.temperature') }}</th>
              <th>{{ t('asset-management.safety-ranges.table.humidity') }}</th>
              <th>{{ t('asset-management.safety-ranges.table.status') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="settings in paginatedProfiles" :key="settings.id">
              <td>
                <strong>{{ translateOrText(scopeNameFor(settings)) }}</strong>
                <span>{{ settings.uuid }}</span>
              </td>
              <td>{{ translateOrText(scopeLocationFor(settings)) }}</td>
              <td>{{ settings.minimumTemperature }}{{ settings.temperatureUnit }} - {{ settings.maximumTemperature }}{{ settings.temperatureUnit }}</td>
              <td>{{ settings.maximumHumidity }}{{ settings.humidityUnit }}</td>
              <td>
                <span class="status-pill" :class="settingStatusClass(settings)">
                  {{ t(settingStatusKey(settings)) }}
                </span>
              </td>
            </tr>
            <tr v-if="!currentProfiles.length">
              <td class="empty-state" colspan="5">{{ t('asset-management.safety-ranges.empty') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <list-pagination v-model="currentPage" :total="currentProfiles.length" :page-size="pageSize"/>
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

.safety-filter {
  grid-template-columns: minmax(260px, 420px) minmax(180px, 1fr);
}

.scope-field {
  max-width: 420px;
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

.filter-field small {
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

.settings-card,
.settings-form {
  display: grid;
  gap: 18px;
}

.settings-grid {
  align-items: start;
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(3, minmax(170px, 1fr)) minmax(140px, auto);
}

.save-actions {
  align-items: end;
  display: flex;
  min-height: 62px;
}

.save-actions .primary-action {
  min-width: 138px;
}

.table-wrapper {
  margin-top: 18px;
  overflow-x: auto;
}

.data-table {
  border-collapse: collapse;
  min-width: 880px;
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

.data-table td strong {
  color: #323c4d;
  display: block;
  font-weight: 800;
}

.data-table td span,
.data-table small {
  display: block;
  font-size: 10px;
  font-weight: 800;
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

@media (max-width: 980px) {
  .page-heading,
  .filter-card,
  .safety-filter,
  .settings-grid {
    display: grid;
    grid-template-columns: 1fr;
  }

  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .save-actions {
    min-height: auto;
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
