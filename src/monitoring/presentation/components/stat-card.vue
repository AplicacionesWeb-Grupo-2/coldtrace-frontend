<script setup>
import {computed} from 'vue';
import {useI18n} from 'vue-i18n';

/**
 * @typedef {Object} StatCardProps
 * @property {*} [title]
 * @property {*} [value]
 * @property {*} [valueUnit]
 * @property {*} [trend]
 * @property {*} [type]
 * @property {*} [size]
 * @property {*} [color]
 * @property {*} [tooltip]
 * @property {*} [chartData]
 * @property {*} [highlightedBar]
 * @property {*} [showAnchor]
 */
const props = defineProps({
    title: {type: String, default: ''},
    value: {type: String, default: ''},
    valueUnit: {type: String, default: ''},
    trend: {type: String, default: ''},
    type: {type: String, default: 'bars'},
    size: {type: String, default: 'small'},
    color: {
        type: Object,
        default: () => ({bg: '#ffffff', border: '#e5e7eb', text: '#1a1a1a', chart: '#33bfff'}),
    },
    tooltip: {type: Object, default: null},
    chartData: {type: Array, default: () => []},
    highlightedBar: {type: Number, default: -1},
    showAnchor: {type: Boolean, default: true},
});

const {t} = useI18n();
const wavePath = 'M0 32 C 6 35, 11 36, 17 31 C 23 24, 29 33, 35 34 C 42 35, 46 22, 52 25 C 56 28, 58 18, 64 20 C 70 23, 73 31, 79 27 C 84 24, 86 16, 93 15 C 96 15, 98 17, 100 16';
const waveFillPath = `${wavePath} L100 40 L0 40 Z`;
const fadedOpacity = computed(() => props.size === 'large' ? '0.42' : '0.55');
const trendOpacity = computed(() => props.size === 'small' ? '0.82' : '0.6');
const unitOpacity = computed(() => props.size === 'small' ? '0.92' : '0.8');
const bubbleTextColor = computed(() => props.color.text.toLowerCase() === '#ffffff' ? props.color.bg : props.color.text);

/**
 * Handles bar style behavior in the monitoring context.
 *
 * @param {string} value
 * @param {number|string} index
 * @returns {*}
 */
function barStyle(value, index) {
    return {
        backgroundColor: props.highlightedBar === index ? '#FFFFFF' : props.color.chart,
        height: `${Math.max(0, Math.min(100, value))}%`,
        opacity: props.highlightedBar === index ? '1' : index > (props.chartData.length - 6) ? '0.95' : fadedOpacity.value,
    };
}
</script>

<template>
  <div class="stat-card" :class="[`size-${size}`, `type-${type}`]" :style="{background: color.bg, borderColor: color.border}">
    <div v-if="tooltip" class="thought-bubble" :style="{left: `${tooltip.position}%`}">
      <span class="bubble-text" :style="{color: bubbleTextColor}">{{ t(tooltip.text) }}</span>
      <div class="bubble-tail"></div>
    </div>

    <div class="card-content">
      <div class="header">
        <h3 class="title" :style="{color: color.text}">{{ t(title) }}</h3>
        <div class="more-btn" :style="{color: color.text, opacity: '0.5'}">
          <span class="material-icons">more_horiz</span>
        </div>
      </div>

      <div class="main-metric">
        <div v-if="trend" class="trend" :style="{color: color.text, opacity: trendOpacity}">{{ t(trend) }}</div>
        <h2 class="value" :style="{color: color.text}">{{ value }}</h2>
        <div v-if="valueUnit" class="unit" :style="{color: color.text, opacity: unitOpacity}">{{ t(valueUnit) }}</div>
      </div>
    </div>

    <div class="chart-container" :class="{'is-wave': type === 'wave'}">
      <div v-if="type === 'bars'" class="bars">
        <div v-for="(value, index) in chartData" :key="index" class="bar" :style="barStyle(value, index)"></div>
        <div
          v-if="tooltip && showAnchor"
          class="anchor-dot bars-anchor"
          :style="{background: '#FFF', borderColor: color.chart, left: `${tooltip.position}%`}"
        ></div>
      </div>

      <div v-else class="wave">
        <svg viewBox="0 0 100 40" preserveAspectRatio="none">
          <path :d="waveFillPath" class="wave-fill" fill="rgba(61, 12, 116, 0.16)"/>
          <path :d="wavePath" class="wave-shadow" fill="none" stroke="rgba(62, 12, 116, 0.22)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" transform="translate(0 1.4)"/>
          <path :d="wavePath" class="wave-line" fill="none" :stroke="color.chart" stroke-width="1.05" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>
        </svg>
        <div
          v-if="tooltip && showAnchor"
          class="anchor-dot wave-anchor"
          :style="{background: '#FFF', borderColor: color.chart, left: `${tooltip.position}%`}"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stat-card {
  background-clip: padding-box;
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 8px;
  box-shadow: 0 5px 9px rgba(15, 23, 42, 0.12), 0 18px 32px rgba(15, 23, 42, 0.06);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: flex-start;
  overflow: visible;
  padding: 22px;
  position: relative;
  width: 100%;
}

.card-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  pointer-events: none;
  position: relative;
  z-index: 5;
}

.header {
  align-items: center;
  display: flex;
  justify-content: space-between;
}

.title {
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0;
  margin: 0;
}

.more-btn {
  align-items: center;
  border-radius: 999px;
  display: flex;
  height: 20px;
  justify-content: center;
  pointer-events: auto;
  width: 24px;
}

.more-btn .material-icons {
  font-size: 18px;
  height: 18px;
  width: 18px;
}

.main-metric {
  display: flex;
  flex-direction: column;
  gap: 7px;
  min-width: 0;
}

.trend,
.unit {
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 700;
}

.value {
  font-family: 'Inter', sans-serif;
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0;
  line-height: 1.04;
  margin: 0;
}

.unit {
  margin-top: 0;
}

.size-small {
  padding: 22px 20px;
}

.size-small .card-content {
  gap: 12px;
}

.size-small .title {
  font-size: 12px;
  line-height: 1.22;
  max-width: 106px;
}

.size-small .main-metric,
.size-small .value {
  max-width: 112px;
}

.size-small .value {
  font-size: 22px;
}

.size-small .unit {
  font-size: 11px;
}

.size-large .title {
  opacity: 0.74;
}

.size-large .value {
  font-size: 25px;
}

.chart-container {
  bottom: 24px;
  height: 98px;
  left: 22px;
  position: absolute;
  right: 22px;
  z-index: 1;
}

.chart-container.is-wave {
  bottom: 0;
  height: 142px;
  left: 0;
  right: 0;
}

.size-small .chart-container {
  bottom: 20px;
  height: 92px;
  left: auto;
  right: 18px;
  width: 108px;
}

.bars {
  align-items: flex-end;
  display: flex;
  gap: 8px;
  height: 100%;
  justify-content: flex-end;
  position: relative;
  width: 100%;
}

.bar {
  border-radius: 999px;
  transition: height 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  width: 5px;
}

.size-small .bars {
  gap: 5px;
}

.size-small .bar {
  width: 4px;
}

.wave {
  height: 100%;
  position: relative;
  width: 100%;
}

.wave svg {
  height: 100%;
  opacity: 0.95;
  width: 100%;
}

.wave-fill {
  opacity: 0.42;
}

.wave-line {
  filter: drop-shadow(0 2px 3px rgba(68, 12, 124, 0.22));
  opacity: 0.82;
}

.wave-shadow {
  opacity: 0.55;
}

.anchor-dot {
  border: 3px solid;
  border-radius: 50%;
  height: 8px;
  position: absolute;
  transform: translate(-50%, 50%);
  width: 8px;
  z-index: 10;
}

.bars-anchor {
  bottom: 70%;
}

.wave-anchor {
  bottom: 37%;
}

.thought-bubble {
  align-items: center;
  background: #ffffff;
  border-radius: 5px;
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.10);
  display: flex;
  justify-content: center;
  padding: 6px 10px;
  position: absolute;
  top: 102px;
  transform: translateX(-50%);
  white-space: nowrap;
  z-index: 100;
}

.size-large.type-wave .thought-bubble {
  top: 116px;
}

.size-small .thought-bubble {
  top: 28px;
}

.stat-card:hover .thought-bubble {
  transform: translateX(-50%) translateY(-5px);
  transition: transform 0.2s ease;
}

.bubble-text {
  font-family: 'Inter', sans-serif;
  font-size: 11px;
  font-weight: 800;
}

.bubble-tail {
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 7px solid #ffffff;
  bottom: -5px;
  height: 0;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 0;
}
</style>
