<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {Chart, registerables} from 'chart.js';
import {useI18n} from 'vue-i18n';

Chart.register(...registerables);

/**
 * @typedef {Object} IncidentsChartProps
 * @property {*} [days]
 * @property {*} [timeline]
 */
const props = defineProps({
    days: {type: Array, default: () => []},
    timeline: {type: Array, default: () => []},
});

const {t} = useI18n();
const canvasElement = ref(null);
let chart;

const resolvedTotal = computed(() => props.days.reduce((sum, day) => sum + day.normal, 0));
const warningTotal = computed(() => props.days.reduce((sum, day) => sum + day.warning, 0));
const criticalTotal = computed(() => props.days.reduce((sum, day) => sum + day.critical, 0));
const offlineTotal = computed(() => props.days.reduce((sum, day) => sum + day.offline, 0));
const chartMax = computed(() => {
    const maxStack = Math.max(...props.days.map(day => day.normal + day.warning + day.critical + day.offline), 1);
    return Math.max(10, Math.ceil(maxStack * 1.18));
});
const averageIncidents = computed(() => {
    const total = props.days.reduce((sum, day) => sum + day.normal + day.warning + day.critical + day.offline, 0);
    const average = total / Math.max(props.days.length, 1);
    return average.toFixed(1).replace('.0', '');
});

onMounted(() => {
    nextTick(buildChart);
});

onBeforeUnmount(() => {
    chart?.destroy();
});

watch(
    () => props.days,
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
    if (!props.days.length) {
        chart.destroy();
        chart = undefined;
        return;
    }

    chart.data.labels = props.days.map(day => day.label);
    chart.data.datasets[0].data = props.days.map(day => day.normal);
    chart.data.datasets[1].data = props.days.map(day => day.warning);
    chart.data.datasets[2].data = props.days.map(day => day.critical);
    chart.data.datasets[3].data = props.days.map(day => day.offline);
    if (chart.options.scales?.y) {
        chart.options.scales.y.max = chartMax.value;
    }
    chart.update();
}

/**
 * Handles micro height behavior in the monitoring context.
 *
 * @param {*} day
 * @returns {*}
 */
function microHeight(day) {
    const total = day.normal + day.warning + day.critical + day.offline;
    return total > 0 ? Math.max(4, Math.min(36, total)) : 0;
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

    if (!props.days.length) return;

    chart = new Chart(canvasElement.value, {
        type: 'bar',
        data: {
            labels: props.days.map(day => day.label),
            datasets: [
                {
                    label: 'Resolved',
                    data: props.days.map(day => day.normal),
                    backgroundColor: '#5bbf7f',
                    borderRadius: 2,
                    barPercentage: 0.42,
                    categoryPercentage: 0.72,
                    minBarLength: 3,
                },
                {
                    label: 'Warning',
                    data: props.days.map(day => day.warning),
                    backgroundColor: '#f2b646',
                    borderRadius: 2,
                    barPercentage: 0.42,
                    categoryPercentage: 0.72,
                    minBarLength: 3,
                },
                {
                    label: 'Critical',
                    data: props.days.map(day => day.critical),
                    backgroundColor: '#ed5145',
                    borderRadius: 2,
                    barPercentage: 0.42,
                    categoryPercentage: 0.72,
                    minBarLength: 4,
                },
                {
                    label: 'Connectivity',
                    data: props.days.map(day => day.offline),
                    backgroundColor: '#e8ecf2',
                    borderRadius: 2,
                    barPercentage: 0.42,
                    categoryPercentage: 0.72,
                    minBarLength: 3,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {legend: {display: false}},
            scales: {
                x: {
                    stacked: true,
                    grid: {color: 'rgba(148,163,184,0.16)', drawTicks: false},
                    border: {color: 'rgba(148,163,184,0.18)'},
                    ticks: {color: '#AEB7C6', font: {family: 'Inter', size: 11, weight: '800'}},
                },
                y: {
                    stacked: true,
                    min: 0,
                    max: chartMax.value,
                    grid: {color: 'rgba(148,163,184,0.16)', drawTicks: false},
                    border: {color: 'rgba(148,163,184,0.18)'},
                    ticks: {display: false},
                },
            },
        },
    });
}
</script>

<template>
  <div class="premium-card incidents-card">
    <div class="card-header">
      <h3 class="card-title">{{ t('monitoring.operational.incidents-by-day') }}</h3>
      <div class="controls">
        <button class="nav-btn" type="button"><span class="material-icons">chevron_left</span></button>
        <button class="today-btn" type="button">{{ t('monitoring.operational.nav-today') }}</button>
        <button class="nav-btn" type="button"><span class="material-icons">chevron_right</span></button>
      </div>
    </div>

    <div class="metric-container">
      <h2 class="avg-metric">{{ t('monitoring.operational.label-avg') }}: {{ averageIncidents }} {{ t('monitoring.operational.unit-incidents') }}</h2>
    </div>

    <div class="chart-wrapper">
      <canvas ref="canvasElement"></canvas>
      <span class="axis-label top">{{ chartMax }} INC</span>
      <span class="axis-label average">{{ t('monitoring.operational.label-avg') }}</span>
      <span class="axis-label bottom">{{ t('monitoring.operational.axis-0-inc') }}</span>
    </div>

    <div class="mini-timeline">
      <span class="mini-axis top">{{ t('monitoring.operational.axis-10-inc') }}</span>
      <span class="mini-axis bottom">{{ t('monitoring.operational.axis-0-inc') }}</span>
      <div class="timeline-ticks">
        <span>00h</span><span>06h</span><span>12h</span><span>18h</span>
      </div>
      <div class="timeline-bars">
        <div v-for="day in timeline" :key="day.id" class="micro-stack" :style="{height: `${microHeight(day)}px`}">
          <span class="m-normal"></span>
          <span class="m-warning"></span>
          <span class="m-critical"></span>
          <span class="m-offline"></span>
        </div>
      </div>
    </div>

    <div class="card-footer">
      <div class="legend-row">
        <div class="legend-item"><span><i class="dot green"></i>{{ t('monitoring.operational.legend-resolved') }}</span><strong>{{ resolvedTotal }} {{ t('monitoring.operational.unit-incidents') }}</strong></div>
        <div class="legend-item"><span><i class="dot yellow"></i>{{ t('monitoring.operational.legend-warnings') }}</span><strong>{{ warningTotal }} {{ t('monitoring.operational.unit-incidents') }}</strong></div>
        <div class="legend-item"><span><i class="dot red"></i>{{ t('monitoring.operational.legend-critical') }}</span><strong>{{ criticalTotal }} {{ t('monitoring.operational.unit-incidents') }}</strong></div>
        <div class="legend-item"><span><i class="dot gray"></i>{{ t('monitoring.operational.legend-offline') }}</span><strong>{{ offlineTotal }} {{ t('monitoring.operational.unit-incidents') }}</strong></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.incidents-card {
  box-sizing: border-box;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 28px 28px 24px;
}

.card-header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-title {
  color: #667388;
  font-size: 16px;
  font-weight: 800;
  margin: 0;
}

.controls {
  align-items: center;
  display: flex;
  gap: 6px;
}

.nav-btn,
.today-btn {
  align-items: center;
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.05);
  color: #4b5563;
  cursor: pointer;
  display: flex;
  font-weight: 800;
  height: 34px;
  justify-content: center;
}

.nav-btn {
  width: 34px;
}

.today-btn {
  font-size: 11px;
  padding: 0 16px;
}

.nav-btn .material-icons {
  color: #9ca3af;
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.metric-container {
  margin-bottom: 12px;
}

.avg-metric {
  color: #2f3748;
  font-size: 27px;
  font-weight: 800;
  letter-spacing: 0;
  margin: 0;
}

.chart-wrapper {
  flex: 1;
  margin: 8px 42px 18px 0;
  min-height: 0;
  position: relative;
}

.chart-wrapper canvas {
  display: block;
  height: 100% !important;
  width: 100% !important;
}

.chart-wrapper::after {
  border-top: 1px dashed #58c87c;
  content: '';
  left: 0;
  position: absolute;
  right: 0;
  top: 47%;
}

.axis-label {
  color: #b8c0ce;
  font-size: 10px;
  font-weight: 800;
  position: absolute;
  right: -52px;
}

.axis-label.top {
  top: 8px;
}

.axis-label.average {
  color: #51bd7a;
  top: 47%;
}

.axis-label.bottom {
  bottom: 6px;
}

.mini-timeline {
  background:
    linear-gradient(rgba(148, 163, 184, 0.1) 1px, transparent 1px),
    linear-gradient(90deg, rgba(148, 163, 184, 0.08) 1px, transparent 1px),
    #fbfcfe;
  background-size: 100% 18px, 72px 100%, auto;
  border: 1px solid rgba(0, 0, 0, 0.025);
  border-radius: 10px;
  box-sizing: border-box;
  margin: 0 42px 22px 0;
  padding: 12px 16px;
  position: relative;
}

.mini-axis {
  color: #b8c0ce;
  font-size: 10px;
  font-weight: 800;
  position: absolute;
  right: -50px;
  white-space: nowrap;
}

.mini-axis.top {
  top: -2px;
}

.mini-axis.bottom {
  bottom: 11px;
}

.timeline-ticks {
  color: #9ca3af;
  display: flex;
  font-size: 9px;
  font-weight: 700;
  justify-content: space-between;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.timeline-bars {
  align-items: flex-end;
  display: flex;
  gap: 5px;
  height: 36px;
  justify-content: center;
}

.micro-stack {
  border-radius: 2px;
  display: flex;
  flex-direction: column-reverse;
  overflow: hidden;
  width: 5px;
}

.micro-stack span {
  display: block;
  min-height: 3px;
  width: 100%;
}

.m-normal {
  background: #5bbf7f;
  flex: 3;
}

.m-warning {
  background: #f2b646;
  flex: 2;
}

.m-critical {
  background: #ed5145;
  flex: 1;
}

.m-offline {
  background: #dfe4ec;
  flex: 2;
}

.card-footer {
  padding-top: 0;
}

.legend-row {
  display: grid;
  gap: 18px;
  grid-template-columns: repeat(4, 1fr);
}

.legend-item {
  color: #a4adbd;
  display: flex;
  flex-direction: column;
  font-size: 11px;
  font-weight: 800;
  gap: 9px;
}

.legend-item span {
  align-items: center;
  display: flex;
  gap: 9px;
}

.legend-item strong {
  color: #4b5563;
  font-size: 13px;
  font-weight: 800;
  padding-left: 20px;
  white-space: nowrap;
}

.dot {
  border-radius: 50%;
  display: inline-block;
  height: 10px;
  width: 10px;
}

.green {
  background: #10b981;
}

.yellow {
  background: #f59e0b;
}

.red {
  background: #ef4444;
}

.gray {
  background: #94a3b8;
}

@container (max-width: 430px) {
  .incidents-card {
    padding: 24px 22px;
  }

  .card-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .avg-metric {
    font-size: 22px;
    line-height: 1.15;
  }

  .chart-wrapper,
  .mini-timeline {
    margin-right: 28px;
  }

  .axis-label {
    right: -38px;
  }

  .mini-axis {
    right: -36px;
  }

  .legend-row {
    gap: 14px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
