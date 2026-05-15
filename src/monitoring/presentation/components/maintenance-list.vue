<script setup>
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';

/**
 * @typedef {Object} MaintenanceListProps
 * @property {*} [tasks]
 * @property {*} [completionRate]
 */
const props = defineProps({
    tasks: {type: Array, default: () => []},
    completionRate: {type: Number, default: 78},
});

const {t} = useI18n();
const progressDashArray = computed(() => {
    const circumference = 264;
    const completed = Math.round((props.completionRate / 100) * circumference);
    return `${completed} ${circumference}`;
});
</script>

<template>
  <div class="premium-card maintenance-card">
    <div class="card-header">
      <h3 class="card-title">{{ t('monitoring.operational.maintenance-title') }}</h3>
      <button class="more-btn" type="button"><span class="material-icons">more_horiz</span></button>
    </div>

    <div class="card-body">
      <div class="task-column">
        <div v-for="task in tasks" :key="task.id" class="task-item">
          <span class="material-icons device-icon">{{ task.icon }}</span>
          <span class="device-name">{{ task.label }}</span>
        </div>
      </div>

      <div class="progress-column">
        <svg viewBox="0 0 120 120" class="circular-chart">
          <circle class="circle-done" cx="60" cy="60" r="42"/>
          <circle class="circle-doing" cx="60" cy="60" r="42"/>
          <circle class="circle-progress" cx="60" cy="60" r="42" :stroke-dasharray="progressDashArray"/>
          <text x="60" y="67" class="percentage">{{ completionRate }}%</text>
        </svg>
        <span class="completion-label">{{ t('monitoring.operational.completion-rate') }}</span>
      </div>
    </div>

    <div class="card-footer">
      <div class="legend-dot"><span class="dot purple"></span>{{ t('monitoring.operational.task-to-do') }}</div>
      <div class="legend-dot"><span class="dot blue"></span>{{ t('monitoring.operational.task-doing') }}</div>
      <div class="legend-dot"><span class="dot gray"></span>{{ t('monitoring.operational.task-done') }}</div>
    </div>
  </div>
</template>

<style scoped>
.maintenance-card {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 24px 26px 18px;
}

.card-header {
  align-items: center;
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-title {
  color: #111827;
  font-size: 16px;
  font-weight: 800;
  margin: 0;
}

.more-btn {
  align-items: center;
  background: #ffffff;
  border: 1px solid #edf0f4;
  border-radius: 10px;
  color: #9ca3af;
  display: flex;
  height: 32px;
  justify-content: center;
  padding: 0;
  width: 32px;
}

.more-btn .material-icons {
  font-size: 18px;
}

.card-body {
  align-items: stretch;
  display: grid;
  flex: 1;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) 104px;
  min-height: 0;
  padding-top: 10px;
}

.task-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  max-height: 100%;
  min-height: 0;
  min-width: 0;
  overflow-y: auto;
  padding-right: 4px;
  scrollbar-color: transparent transparent;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.task-column::-webkit-scrollbar {
  width: 4px;
}

.task-column::-webkit-scrollbar-thumb {
  background: transparent;
  border-radius: 999px;
}

.maintenance-card:hover .task-column,
.task-column:focus-within {
  scrollbar-color: #d8dde6 transparent;
}

.maintenance-card:hover .task-column::-webkit-scrollbar-thumb,
.task-column:focus-within::-webkit-scrollbar-thumb {
  background: #d8dde6;
}

.task-item {
  align-items: center;
  display: flex;
  gap: 9px;
  min-width: 0;
}

.device-icon {
  color: #697386;
  flex: 0 0 auto;
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.device-name {
  color: #3f4a5f;
  display: -webkit-box;
  font-size: 11px;
  font-weight: 700;
  line-height: 15px;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.progress-column {
  align-items: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding-top: 2px;
}

.circular-chart {
  height: 82px;
  overflow: visible;
  transform: rotate(-90deg);
  width: 82px;
}

.circle-done,
.circle-doing,
.circle-progress {
  fill: none;
  stroke-width: 8;
}

.circle-done {
  stroke: #e8ddf6;
  stroke-dasharray: 264 264;
}

.circle-doing {
  stroke: #c8a5f1;
  stroke-dasharray: 64 264;
  stroke-dashoffset: -130;
  stroke-linecap: round;
}

.circle-progress {
  stroke: #7c2fd4;
  stroke-dasharray: 142 264;
  stroke-dashoffset: -30;
  stroke-linecap: round;
}

.percentage {
  fill: #1f2937;
  font-family: 'Inter', sans-serif;
  font-size: 23px;
  font-weight: 800;
  text-anchor: middle;
  transform: rotate(90deg);
  transform-origin: 60px 60px;
}

.completion-label {
  color: #9ca3af;
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.04em;
  line-height: 11px;
  margin-top: -2px;
  text-align: center;
  text-transform: uppercase;
  width: 58px;
}

.card-footer {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  min-height: 34px;
  padding-top: 10px;
}

.legend-dot {
  align-items: center;
  color: #6b7280;
  display: flex;
  font-size: 10px;
  font-weight: 700;
  gap: 7px;
  white-space: nowrap;
}

.dot {
  border-radius: 50%;
  height: 10px;
  width: 10px;
}

.purple {
  background: #7c2fd4;
}

.blue {
  background: #c8a5f1;
}

.gray {
  background: #d8dde6;
}
</style>
