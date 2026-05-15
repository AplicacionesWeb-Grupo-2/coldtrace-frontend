<script setup>
import {nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {Chart, registerables} from 'chart.js';
import {useI18n} from 'vue-i18n';

Chart.register(...registerables);

/**
 * @typedef {Object} StorageDistributionProps
 * @property {*} [items]
 */
const props = defineProps({
    items: {type: Array, default: () => []},
});

const {locale, t} = useI18n();
const canvasElement = ref(null);
let chart;

onMounted(() => {
    nextTick(buildChart);
});

onBeforeUnmount(() => {
    chart?.destroy();
});

watch(
    [() => props.items, locale],
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
    if (!props.items.length) {
        chart.destroy();
        chart = undefined;
        return;
    }

    chart.data.labels = props.items.map(item => t(item.label));
    chart.data.datasets[0].data = props.items.map(item => item.percentage);
    chart.data.datasets[0].backgroundColor = props.items.map(item => item.color);
    chart.update();
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

    if (!props.items.length) return;

    chart = new Chart(canvasElement.value, {
        type: 'doughnut',
        data: {
            labels: props.items.map(item => t(item.label)),
            datasets: [{
                data: props.items.map(item => item.percentage),
                backgroundColor: props.items.map(item => item.color),
                borderColor: '#ffffff',
                borderWidth: 7,
                borderRadius: 8,
                spacing: 0,
            }],
        },
        options: {
            cutout: '50%',
            rotation: -84,
            responsive: true,
            maintainAspectRatio: false,
            plugins: {legend: {display: false}},
        },
    });
}
</script>

<template>
  <div class="premium-card distribution-card">
    <div class="card-header">
      <h3 class="card-title">{{ t('monitoring.operational.chart-storage-title') }}</h3>
      <button class="more-btn" type="button"><span class="material-icons">more_horiz</span></button>
    </div>

    <div class="card-body">
      <div class="chart-container">
        <canvas ref="canvasElement"></canvas>
      </div>

      <div class="legend-container">
        <div v-for="item in items" :key="item.id" class="legend-row">
          <div class="category">
            <span class="dot" :style="{background: item.color}"></span>
            <div class="text-group">
              <span class="cat-name">{{ t(item.label) }}</span>
              <span class="cat-assets">{{ item.assetCount }} {{ t('monitoring.operational.unit-assets') }}</span>
            </div>
          </div>
          <span class="percentage">{{ item.percentage }}%</span>
        </div>

        <div v-if="!items.length" class="empty-distribution">{{ t('monitoring.operational.no-assets') }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.distribution-card {
  box-sizing: border-box;
  container-type: inline-size;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px 28px;
}

.card-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 14px;
}

.card-title {
  color: #111827;
  font-size: 16px;
  font-weight: 700;
  margin: 0;
}

.more-btn {
  background: none;
  border: none;
  color: #9ca3af;
  cursor: pointer;
}

.more-btn .material-icons {
  font-size: 20px;
}

.card-body {
  align-items: center;
  display: grid;
  flex: 1;
  gap: clamp(16px, 5cqw, 32px);
  grid-template-columns: minmax(136px, 0.88fr) minmax(0, 1fr);
  justify-content: start;
  min-width: 0;
}

.chart-container {
  aspect-ratio: 1;
  height: 184px;
  max-width: 184px;
  min-width: 0;
  position: relative;
  width: min(184px, 100%);
}

.chart-container canvas {
  display: block;
  height: 100% !important;
  width: 100% !important;
}

.legend-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-width: 0;
  padding-top: 2px;
  width: 100%;
}

.legend-row {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  min-width: 0;
}

.category {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  min-width: 0;
}

.dot {
  border-radius: 50%;
  flex-shrink: 0;
  height: 8px;
  margin-top: 5px;
  width: 8px;
}

.text-group {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.cat-name {
  color: #111827;
  font-size: 13px;
  font-weight: 700;
  line-height: 15px;
  overflow-wrap: anywhere;
}

.cat-assets {
  color: #9ca3af;
  font-size: 11px;
  font-weight: 500;
}

.percentage {
  color: #111827;
  flex: 0 0 auto;
  font-size: 13px;
  font-weight: 700;
}

.empty-distribution {
  color: #8b95a6;
  font-size: 12px;
  font-weight: 700;
  grid-column: 1 / -1;
  text-align: center;
}

@media (max-width: 760px) {
  .card-body {
    grid-template-columns: 1fr;
  }

  .chart-container,
  .legend-container {
    justify-self: center;
  }
}

@container (max-width: 430px) {
  .distribution-card {
    padding: 22px 24px;
  }

  .card-body {
    gap: 18px;
    grid-template-columns: 1fr;
    justify-content: center;
  }

  .chart-container {
    height: min(184px, 72cqw);
    justify-self: center;
    width: min(184px, 72cqw);
  }
}
</style>
