<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {Chart, registerables} from 'chart.js';
import {useI18n} from 'vue-i18n';

Chart.register(...registerables);

/**
 * @typedef {Object} TemperatureChartProps
 * @property {*} [title]
 * @property {*} [subtitle]
 * @property {*} [points]
 * @property {*} [hideHeader]
 */
const props = defineProps({
    title: {type: String, default: 'monitoring.operational.chart-temp-title'},
    subtitle: {type: String, default: 'monitoring.operational.chart-temp-subtitle'},
    points: {type: Array, default: () => []},
    hideHeader: {type: Boolean, default: false},
});

const {t} = useI18n();
const canvasElement = ref(null);
let chart;

const maxLimitLabel = computed(() => `${limitForPoints().max}°C`);
const minLimitLabel = computed(() => `${limitForPoints().min}°C`);

onMounted(() => {
    nextTick(buildChart);
});

onBeforeUnmount(() => {
    chart?.destroy();
});

watch(
    () => props.points,
    () => {
        if (chart) {
            refreshChart();
        } else {
            nextTick(buildChart);
        }
    },
    {deep: true},
);

/**
 * Handles refresh chart behavior in the monitoring context.
 *
 * @returns {*}
 */
function refreshChart() {
    if (!chart) return;
    if (!props.points.length) {
        chart.destroy();
        chart = undefined;
        return;
    }

    const labels = props.points.map(point => point.label);
    const temperatures = props.points.map(point => point.temperature);
    const {max: maxLimit, min: minLimit} = limitForPoints();
    const {min: yMin, max: yMax} = computeYRange(temperatures, maxLimit, minLimit);

    chart.data.labels = labels;
    chart.data.datasets[0].data = temperatures;
    chart.data.datasets[1].data = temperatures;
    chart.data.datasets[2].data = temperatures;
    chart.data.datasets[3].data = temperatures;
    chart.data.datasets[4].data = new Array(labels.length).fill(maxLimit);
    chart.data.datasets[5].data = new Array(labels.length).fill(minLimit);

    if (chart.options.scales?.y) {
        chart.options.scales.y.min = yMin;
        chart.options.scales.y.max = yMax;
    }

    chart.update();
}

/**
 * Handles compute y range behavior in the monitoring context.
 *
 * @param {*} temperatures
 * @param {*} maxLimit
 * @param {*} minLimit
 * @returns {*}
 */
function computeYRange(temperatures, maxLimit, minLimit) {
    const allValues = [...temperatures, maxLimit, minLimit];
    const dataMin = Math.min(...allValues);
    const dataMax = Math.max(...allValues);
    const range = dataMax - dataMin;
    const padding = Math.max(3, Math.ceil(range * 0.18));

    return {
        min: Math.floor((dataMin - padding) / 5) * 5,
        max: Math.ceil((dataMax + padding) / 5) * 5,
    };
}

/**
 * Builds chart for presentation or reporting.
 *
 * @returns {*}
 */
function buildChart() {
    if (!canvasElement.value) return;
    chart?.destroy();
    chart = undefined;

    if (!props.points.length) return;

    const labels = props.points.map(point => point.label);
    const temperatures = props.points.map(point => point.temperature);
    const {max: maxLimit, min: minLimit} = limitForPoints();
    const {min: yMin, max: yMax} = computeYRange(temperatures, maxLimit, minLimit);

    const getStopForValue = (value, chartInstance) => {
        const {chartArea, scales: {y}} = chartInstance;
        if (!chartArea) return 0;
        const pixel = y.getPixelForValue(value);
        return Math.max(0, Math.min(1, (pixel - chartArea.top) / (chartArea.bottom - chartArea.top)));
    };

    chart = new Chart(canvasElement.value, {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Temperature Area',
                    data: temperatures,
                    borderColor: 'transparent',
                    backgroundColor: context => {
                        const chartInstance = context.chart;
                        const {ctx: canvasCtx, chartArea} = chartInstance;
                        if (!chartArea) return 'rgba(34, 197, 94, 0.28)';

                        const maxStop = getStopForValue(maxLimit, chartInstance);
                        const minStop = getStopForValue(minLimit, chartInstance);
                        const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

                        gradient.addColorStop(0, 'rgba(34, 197, 94, 0)');
                        gradient.addColorStop(maxStop, 'rgba(34, 197, 94, 0)');
                        gradient.addColorStop(maxStop, 'rgba(34, 197, 94, 0.48)');
                        gradient.addColorStop(minStop, 'rgba(34, 197, 94, 0.12)');
                        gradient.addColorStop(minStop, 'rgba(34, 197, 94, 0)');
                        gradient.addColorStop(1, 'rgba(34, 197, 94, 0)');
                        return gradient;
                    },
                    fill: {target: {value: minLimit}},
                    tension: 0.42,
                    pointRadius: 0,
                    borderWidth: 0,
                    order: 1,
                },
                {
                    label: 'Above Max',
                    data: temperatures,
                    borderColor: 'transparent',
                    backgroundColor: context => {
                        const chartInstance = context.chart;
                        const {ctx: canvasCtx, chartArea} = chartInstance;
                        if (!chartArea) return 'rgba(239, 68, 68, 0.22)';

                        const maxStop = getStopForValue(maxLimit, chartInstance);
                        const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

                        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.48)');
                        gradient.addColorStop(maxStop, 'rgba(239, 68, 68, 0.22)');
                        gradient.addColorStop(maxStop, 'rgba(239, 68, 68, 0)');
                        gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
                        return gradient;
                    },
                    fill: {target: {value: maxLimit}},
                    tension: 0.42,
                    pointRadius: 0,
                    borderWidth: 0,
                    order: 2,
                },
                {
                    label: 'Below Min',
                    data: temperatures,
                    borderColor: 'transparent',
                    backgroundColor: context => {
                        const chartInstance = context.chart;
                        const {ctx: canvasCtx, chartArea} = chartInstance;
                        if (!chartArea) return 'rgba(59, 130, 246, 0.2)';

                        const minStop = getStopForValue(minLimit, chartInstance);
                        const gradient = canvasCtx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);

                        gradient.addColorStop(0, 'rgba(59, 130, 246, 0)');
                        gradient.addColorStop(minStop, 'rgba(59, 130, 246, 0)');
                        gradient.addColorStop(minStop, 'rgba(59, 130, 246, 0.22)');
                        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.48)');
                        return gradient;
                    },
                    fill: {target: {value: minLimit}},
                    tension: 0.42,
                    pointRadius: 0,
                    borderWidth: 0,
                    order: 2,
                },
                {
                    label: 'Temperature Line',
                    data: temperatures,
                    borderColor: '#22c55e',
                    fill: false,
                    tension: 0.42,
                    pointRadius: 0,
                    borderWidth: 1.4,
                    order: 5,
                    segment: {
                        borderColor: context => {
                            const y0 = context.p0.parsed.y ?? 0;
                            const y1 = context.p1.parsed.y ?? 0;
                            if (y0 < minLimit || y1 < minLimit) return '#7aa7ff';
                            if (y0 > maxLimit || y1 > maxLimit) return '#ef8d8d';
                            return '#22c55e';
                        },
                    },
                },
                {
                    label: 'Max Limit',
                    data: new Array(labels.length).fill(maxLimit),
                    borderColor: 'rgba(239, 68, 68, 0.78)',
                    borderDash: [3, 4],
                    borderWidth: 1.2,
                    pointRadius: 0,
                    fill: false,
                    order: 6,
                },
                {
                    label: 'Min Limit',
                    data: new Array(labels.length).fill(minLimit),
                    borderColor: 'rgba(91, 125, 255, 0.68)',
                    borderDash: [3, 4],
                    borderWidth: 1.2,
                    pointRadius: 0,
                    fill: false,
                    order: 6,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {legend: {display: false}, tooltip: {enabled: false}},
            scales: {
                x: {
                    grid: {display: false},
                    border: {display: false},
                    ticks: {
                        color: '#9CA3AF',
                        font: {family: 'Inter', size: 11, weight: 600},
                        maxRotation: 0,
                        autoSkip: false,
                        callback: (_value, index) => index % 4 === 0 ? labels[index] : '',
                    },
                },
                y: {
                    min: yMin,
                    max: yMax,
                    grid: {color: 'rgba(15,23,42,0.045)', drawTicks: false},
                    border: {display: false},
                    ticks: {
                        color: '#9CA3AF',
                        font: {family: 'Inter', size: 10, weight: 500},
                        stepSize: 5,
                        padding: 8,
                    },
                },
            },
        },
    });
}

/**
 * Handles limit for points behavior in the monitoring context.
 *
 * @returns {*}
 */
function limitForPoints() {
    const configuredLimits = props.points[0];

    if (
        configuredLimits &&
        Number.isFinite(configuredLimits.minLimit) &&
        Number.isFinite(configuredLimits.maxLimit) &&
        configuredLimits.minLimit < configuredLimits.maxLimit
    ) {
        return {
            min: configuredLimits.minLimit,
            max: configuredLimits.maxLimit,
        };
    }

    const finiteValues = props.points
        .map(point => point.temperature)
        .filter(value => Number.isFinite(value));

    if (!finiteValues.length) return {min: 0, max: 1};

    const min = Math.min(...finiteValues);
    const max = Math.max(...finiteValues);

    if (min === max) {
        return {
            min: Math.floor(min - 1),
            max: Math.ceil(max + 1),
        };
    }

    return {
        min: Math.floor(min),
        max: Math.ceil(max),
    };
}
</script>

<template>
  <div class="premium-card chart-card" :class="{'no-header': hideHeader}">
    <template v-if="!hideHeader">
      <div class="chart-header">
        <div class="header-left">
          <h3 class="chart-title">{{ t(title) }}</h3>
          <span class="chart-subtitle">{{ t(subtitle) }}</span>
        </div>
        <div class="header-right">
          <button class="filter-dropdown" type="button">
            <span>{{ t('monitoring.operational.filter-last-24-hours') }}</span>
            <span class="material-icons">expand_more</span>
          </button>
        </div>
      </div>

      <div class="legend-bar">
        <div class="legend-item"><span class="indicator green"></span>{{ t('monitoring.operational.legend-temperature') }}</div>
        <div class="legend-item"><span class="indicator dashed-red"></span>{{ t('monitoring.operational.legend-max-limit', {value: maxLimitLabel}) }}</div>
        <div class="legend-item"><span class="indicator dashed-blue"></span>{{ t('monitoring.operational.legend-min-limit', {value: minLimitLabel}) }}</div>
      </div>
      <p class="chart-helper">{{ t('monitoring.operational.chart-temp-helper') }}</p>
    </template>

    <div class="chart-container">
      <canvas ref="canvasElement" :aria-label="t('monitoring.operational.temperature-aria')"></canvas>
      <div v-if="!points.length" class="chart-empty">{{ t('monitoring.operational.no-readings') }}</div>
    </div>
  </div>
</template>

<style scoped>
.chart-card {
  box-sizing: border-box;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px 30px 26px;
}

.chart-card.no-header {
  background: transparent;
  border: 0;
  box-shadow: none;
  padding: 0;
}

.chart-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.header-left {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  min-width: 0;
}

.chart-title {
  color: #111827;
  font-size: 19px;
  font-weight: 800;
  margin: 0;
}

.chart-subtitle {
  color: #9ca3af;
  font-size: 13px;
  font-weight: 500;
}

.filter-dropdown {
  align-items: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  color: #4b5563;
  cursor: pointer;
  display: flex;
  font-size: 12px;
  font-weight: 600;
  height: 34px;
  justify-content: space-between;
  padding: 0 12px;
  transition: background 0.2s;
  width: 135px;
}

.filter-dropdown:hover {
  background: #f9fafb;
}

.filter-dropdown .material-icons {
  color: #9ca3af;
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.legend-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 24px;
  margin-bottom: 6px;
}

.legend-item {
  align-items: center;
  color: #6b7280;
  display: flex;
  font-size: 12px;
  font-weight: 500;
  gap: 6px;
  min-width: 0;
}

.indicator {
  height: 2px;
  width: 14px;
}

.green {
  background: #22c55e;
}

.dashed-red {
  border-top: 1.5px dashed rgba(239, 68, 68, 0.4);
}

.dashed-blue {
  border-top: 1.5px dashed rgba(59, 130, 246, 0.4);
}

.chart-helper {
  color: #8b95a6;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.35;
  margin: 0 0 10px;
}

.chart-container {
  flex: 1;
  min-height: 0;
  padding-top: 2px;
  position: relative;
}

.chart-container canvas {
  display: block;
  height: 100% !important;
  width: 100% !important;
}

.chart-empty {
  align-items: center;
  color: #8b95a6;
  display: flex;
  font-size: 13px;
  font-weight: 700;
  inset: 0;
  justify-content: center;
  position: absolute;
  text-align: center;
}

@container (max-width: 560px) {
  .chart-card {
    padding: 20px 18px 22px;
  }

  .chart-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .filter-dropdown {
    width: 100%;
  }

  .legend-bar {
    gap: 8px 14px;
  }
}
</style>
