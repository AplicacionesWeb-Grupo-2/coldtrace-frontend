<script setup>
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';
import TemperatureGauge from '@/monitoring/presentation/components/temperature-gauge.vue';
import TemperatureChart from '@/monitoring/presentation/components/temperature-chart.vue';

const props = defineProps({
    asset: {type: Object, required: true},
    device: {type: Object, default: null},
    location: {type: String, default: 'N/A'},
    latestReading: {type: Object, default: null},
    settings: {type: Object, default: null},
    chartPoints: {type: Array, default: () => []},
});

const {t} = useI18n();
const temperature = computed(() => props.latestReading?.temperature ?? parseAssetTemperature());
const humidity = computed(() => props.latestReading?.humidity ?? null);
const sensorId = computed(() => props.device?.uuid ?? 'N/A');
const lastReadingTime = computed(() => {
    if (!props.latestReading) return 'N/A';
    return new Date(props.latestReading.recordedAt).toLocaleString([], {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: '2-digit',
    });
});
const minimumTemperature = computed(() => props.settings?.minimumTemperature ?? null);
const maximumTemperature = computed(() => props.settings?.maximumTemperature ?? null);
const hasIncident = computed(() => props.latestReading?.isOutOfRange === true);
const readingIncident = computed(() => incidentFromReading());
const statusKey = computed(() => {
    if (!props.latestReading) return 'monitoring.asset-monitoring.status.no-data';
    return hasIncident.value ? 'monitoring.operational.status-out-of-range' : 'monitoring.operational.status-in-range';
});
const incidentTypeKey = computed(() => {
    if (readingIncident.value) return readingIncident.value.typeKey;
    return 'monitoring.asset-monitoring.incident.out-of-range';
});
const incidentValue = computed(() => {
    if (readingIncident.value) return readingIncident.value.value;
    return props.asset.currentTemperature || 'N/A';
});

function incidentFromReading() {
    const reading = props.latestReading;
    if (!reading?.isOutOfRange) return null;

    const temperature = reading.temperature;
    const humidityValue = reading.humidity;
    const batteryLevel = reading.batteryLevel;
    const signalStrength = reading.signalStrength;
    const temperatureUnit = props.settings?.temperatureUnit ?? '°C';
    const humidityUnit = props.settings?.humidityUnit ?? '%';

    if (props.settings && temperature !== null && temperature !== undefined) {
        if (temperature > props.settings.maximumTemperature) {
            return {
                typeKey: 'monitoring.asset-monitoring.incident.high-temperature',
                value: `${temperature.toFixed(1)} ${temperatureUnit}`,
            };
        }

        if (temperature < props.settings.minimumTemperature) {
            return {
                typeKey: 'monitoring.asset-monitoring.incident.low-temperature',
                value: `${temperature.toFixed(1)} ${temperatureUnit}`,
            };
        }
    }

    if (props.settings && humidityValue !== null && humidityValue !== undefined && humidityValue > props.settings.maximumHumidity) {
        return {
            typeKey: 'monitoring.operational.type-high-humidity',
            value: `${humidityValue}${humidityUnit}`,
        };
    }

    if (batteryLevel !== null && batteryLevel !== undefined && batteryLevel < 15) {
        return {
            typeKey: 'monitoring.operational.type-low-battery',
            value: `${batteryLevel}%`,
        };
    }

    if (signalStrength !== null && signalStrength !== undefined && signalStrength < 35) {
        return {
            typeKey: 'monitoring.operational.type-low-signal',
            value: `${signalStrength}%`,
        };
    }

    if (temperature !== null && temperature !== undefined) {
        return {
            typeKey: 'monitoring.asset-monitoring.incident.out-of-range',
            value: `${temperature.toFixed(1)} ${temperatureUnit}`,
        };
    }

    if (humidityValue !== null && humidityValue !== undefined) {
        return {
            typeKey: 'monitoring.asset-monitoring.incident.out-of-range',
            value: `${humidityValue}${humidityUnit}`,
        };
    }

    return {
        typeKey: 'monitoring.asset-monitoring.incident.out-of-range',
        value: props.asset.currentTemperature || 'N/A',
    };
}

function parseAssetTemperature() {
    const value = Number.parseFloat(props.asset.currentTemperature?.replace('°C', '') ?? '');
    return Number.isFinite(value) ? value : null;
}
</script>

<template>
  <div class="monitoring-asset-card premium-card">
    <div class="section-gauge">
      <temperature-gauge
        :temperature="temperature"
        :humidity="humidity"
        :sensor-id="sensorId"
        :location="location"
        :last-reading-time="lastReadingTime"
        :asset-name="asset.name"
        :min-temp="minimumTemperature"
        :max-temp="maximumTemperature"
      />
    </div>

    <div class="section-chart">
      <temperature-chart
        title="monitoring.asset-monitoring.trend-title"
        subtitle=""
        :points="chartPoints"
        hide-header
      />
    </div>

    <div class="section-status">
      <div class="status-header">
        <span class="status-label">{{ t('monitoring.operational.col-status') }}</span>
        <div class="status-badge" :class="{unack: hasIncident, 'no-data': !latestReading}">
          {{ t(statusKey) }}
        </div>
      </div>

      <div v-if="hasIncident" class="incident-list">
        <div class="incident-item">
          <span class="material-icons incident-icon">warning</span>
          <div class="incident-info">
            <span class="incident-type">{{ t(incidentTypeKey) }}</span>
            <span class="incident-value">{{ incidentValue }}</span>
            <span class="incident-date">{{ lastReadingTime }}</span>
          </div>
        </div>
      </div>
      <div v-else class="no-incidents">
        <span class="material-icons">{{ latestReading ? 'check_circle' : 'sensors_off' }}</span>
        <span>{{ t(latestReading ? 'monitoring.asset-monitoring.status.normal' : 'monitoring.asset-monitoring.status.no-readings') }}</span>
      </div>

      <div v-if="device" class="device-footer">
        <span>{{ t('monitoring.asset-monitoring.device-model') }}</span>
        <strong>{{ device.model }}</strong>
      </div>
      <div v-else class="device-footer muted">
        <span>{{ t('monitoring.asset-monitoring.no-device') }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.monitoring-asset-card {
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.06);
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  display: grid;
  gap: 0;
  grid-template-columns: minmax(320px, 0.95fr) minmax(280px, 1.1fr) minmax(220px, 0.7fr);
  margin-bottom: 24px;
  min-height: 240px;
  overflow: hidden;
  padding: 0 !important;
}

.section-gauge {
  align-items: center;
  border-right: 1px solid #f1f5f9;
  display: flex;
  overflow: hidden;
}

.section-chart {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 0;
  padding: 8px 24px 16px;
}

.section-status {
  background: #fafbfc;
  border-left: 1px solid #f1f5f9;
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 24px;
}

.status-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 4px;
}

.status-label {
  color: #94a3b8;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.status-badge {
  background: #dcfce7;
  border-radius: 20px;
  color: #16a34a;
  font-size: 10px;
  font-weight: 800;
  padding: 4px 10px;
}

.status-badge.unack {
  background: #fee2e2;
  color: #ef4444;
}

.status-badge.no-data {
  background: #eef2f7;
  color: #64748b;
}

.incident-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.incident-item {
  background: #ffffff;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.02);
  display: flex;
  gap: 12px;
  padding: 14px;
}

.incident-icon {
  color: #f87171;
  font-size: 20px;
  height: 20px;
  width: 20px;
}

.incident-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.incident-type {
  color: #ef4444;
  font-size: 12px;
  font-weight: 700;
}

.incident-value {
  color: #1e293b;
  font-size: 13px;
  font-weight: 800;
}

.incident-date {
  color: #94a3b8;
  font-size: 11px;
}

.no-incidents {
  align-items: center;
  color: #94a3b8;
  display: flex;
  flex: 1;
  flex-direction: column;
  font-size: 12px;
  font-weight: 600;
  gap: 10px;
  justify-content: center;
}

.no-incidents .material-icons {
  color: #22c55e;
  font-size: 28px;
  height: 28px;
  width: 28px;
}

.device-footer {
  border-top: 1px solid #eef2f7;
  color: #64748b;
  display: flex;
  flex-direction: column;
  font-size: 11px;
  font-weight: 700;
  gap: 4px;
  margin-top: auto;
  padding-top: 12px;
}

.device-footer strong {
  color: #1e293b;
  font-size: 12px;
}

.device-footer.muted {
  color: #94a3b8;
}

@media (max-width: 1180px) {
  .monitoring-asset-card {
    grid-template-columns: 1fr;
  }

  .section-gauge,
  .section-chart,
  .section-status {
    border: 0;
  }
}
</style>
