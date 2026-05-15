<script setup>
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';

/**
 * @typedef {Object} TemperatureGaugeProps
 * @property {*} [temperature]
 * @property {*} [humidity]
 * @property {*} [sensorId]
 * @property {*} [location]
 * @property {*} [lastReadingTime]
 * @property {*} [assetName]
 * @property {*} [minTemp]
 * @property {*} [maxTemp]
 */
const props = defineProps({
    temperature: {type: Number, default: null},
    humidity: {type: Number, default: null},
    sensorId: {type: String, default: 'N/A'},
    location: {type: String, default: 'N/A'},
    lastReadingTime: {type: String, default: 'N/A'},
    assetName: {type: String, default: 'N/A'},
    minTemp: {type: Number, default: null},
    maxTemp: {type: Number, default: null},
});

const {t} = useI18n();
const hasTemperature = computed(() => props.temperature !== null && Number.isFinite(props.temperature));
const hasHumidity = computed(() => props.humidity !== null && Number.isFinite(props.humidity));
const hasTemperatureRange = computed(() =>
    props.minTemp !== null &&
    props.maxTemp !== null &&
    Number.isFinite(props.minTemp) &&
    Number.isFinite(props.maxTemp) &&
    props.minTemp < props.maxTemp,
);
const gaugeColor = computed(() => {
    if (!hasTemperature.value || !hasTemperatureRange.value) return '#CBD5E1';
    if (props.temperature > props.maxTemp) return '#EF4444';
    if (props.temperature < props.minTemp) return '#3B82F6';
    return '#22C55E';
});
const dashArray = computed(() => {
    const totalLength = 240;
    const minTemp = hasTemperatureRange.value ? props.minTemp : displayMinimumTemperature.value;
    const maxTemp = hasTemperatureRange.value ? props.maxTemp : displayMaximumTemperature.value;
    const range = Math.max(maxTemp - minTemp, 1);
    const gaugeTemperature = hasTemperature.value ? props.temperature : minTemp;
    const normalized = Math.min(Math.max(gaugeTemperature - minTemp, 0), range);
    const filled = (normalized / range) * totalLength;
    return `${filled} ${totalLength}`;
});
const temperatureText = computed(() => hasTemperature.value ? `${props.temperature.toFixed(1)}°C` : 'N/A');
const displayMinimumTemperature = computed(() => hasTemperature.value ? Math.floor(props.temperature - 1) : 0);
const displayMaximumTemperature = computed(() => hasTemperature.value ? Math.ceil(props.temperature + 1) : 1);
</script>

<template>
  <div class="gauge-content">
    <div class="gauge-container">
      <svg viewBox="0 0 120 120" class="gauge-svg">
        <path class="gauge-bg" d="M 25 95 A 50 50 0 1 1 95 95" fill="none" stroke="#F1F5F9" stroke-width="10" stroke-linecap="round"/>
        <path
          class="gauge-value"
          d="M 25 95 A 50 50 0 1 1 95 95"
          fill="none"
          :stroke="gaugeColor"
          stroke-width="10"
          stroke-linecap="round"
          :style="{strokeDasharray: dashArray}"
        />
      </svg>
      <div class="gauge-center">
        <span class="temperature-value">{{ temperatureText }}</span>
      </div>
    </div>

    <div class="asset-details">
      <div class="detail-item">
        <span class="material-icons">sensors</span>
        <span class="detail-label">{{ t('monitoring.asset-monitoring.sensor-id') }}</span>
        <span class="detail-value">{{ sensorId }}</span>
      </div>
      <div class="detail-item">
        <span class="material-icons">location_on</span>
        <span class="detail-label">{{ t('monitoring.asset-monitoring.location') }}</span>
        <span class="detail-value">{{ location }}</span>
      </div>
      <div class="detail-item">
        <span class="material-icons">schedule</span>
        <span class="detail-label">{{ t('monitoring.asset-monitoring.last-reading') }}</span>
        <span class="detail-value">{{ lastReadingTime }}</span>
      </div>
      <div class="detail-item">
        <span class="material-icons">water_drop</span>
        <span class="detail-label">{{ t('monitoring.asset-monitoring.humidity') }}</span>
        <span class="detail-value">{{ hasHumidity ? `${humidity}%` : t('monitoring.asset-monitoring.no-data') }}</span>
      </div>
      <div class="detail-item">
        <span class="material-icons">inventory_2</span>
        <span class="detail-label">{{ t('monitoring.asset-monitoring.asset-name') }}</span>
        <span class="detail-value">{{ assetName }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.gauge-content {
  align-items: center;
  display: flex;
  gap: 20px;
  height: 100%;
  padding: 16px 24px;
}

.gauge-container {
  flex-shrink: 0;
  height: 150px;
  position: relative;
  width: 150px;
}

.gauge-svg {
  height: 100%;
  width: 100%;
}

.gauge-value {
  transition: stroke-dasharray 0.8s ease-out;
}

.gauge-center {
  left: 50%;
  position: absolute;
  top: 48%;
  transform: translate(-50%, -50%);
}

.temperature-value {
  color: #0f172a;
  font-family: 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 800;
}

.asset-details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 220px;
}

.detail-item {
  align-items: center;
  display: flex;
  font-family: 'Inter', sans-serif;
  gap: 10px;
}

.detail-item .material-icons {
  color: #94a3b8;
  font-size: 16px;
  height: 16px;
  width: 16px;
}

.detail-label {
  color: #64748b;
  font-size: 12px;
  font-weight: 500;
  min-width: 80px;
}

.detail-value {
  color: #0f172a;
  font-size: 12px;
  font-weight: 700;
}
</style>
