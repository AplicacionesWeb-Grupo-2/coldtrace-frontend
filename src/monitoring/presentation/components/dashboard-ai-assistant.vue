<script setup>
import {computed, nextTick, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import useMonitoringStore from '@/monitoring/application/monitoring.store.js';

const props = defineProps({
  organizationId: {type: [Number, String], default: null},
  thermalCompliance: {type: Number, default: 0},
  activeIncidents: {type: Number, default: 0},
  criticalIncidents: {type: Number, default: 0},
  monitoredAssets: {type: Number, default: 0},
  activeSensors: {type: Number, default: 0},
  readingsCount: {type: Number, default: 0},
  maintenanceCompletion: {type: Number, default: 0},
  assetIssueCount: {type: Number, default: 0},
});

const {t, locale} = useI18n();
const monitoringStore = useMonitoringStore();
const question = ref('');
const expanded = ref(false);
const loading = ref(false);
const failure = ref('none');
const chatTurns = ref([]);
const launcher = ref(null);
const panel = ref(null);
const closeButton = ref(null);
let nextChatTurnId = 1;
let previouslyFocusedElement = null;

const latestInterpretation = computed(() => [...chatTurns.value].reverse().find(turn => turn.answer)?.answer ?? null);
const currentTone = computed(() => latestInterpretation.value ? toneFromAttentionLevel(latestInterpretation.value.attentionLevel) : insightTone.value);
const insightTone = computed(() => {
  if (props.criticalIncidents > 0 || props.thermalCompliance < 85) return 'critical';
  if (props.activeIncidents > 0 || props.assetIssueCount > 0 || props.thermalCompliance < 95) return 'warning';
  return 'ok';
});
const insightStatusKey = computed(() => `monitoring.operational.ai-status-${currentTone.value}`);
const suggestedQuestions = computed(() => [
  {
    id: 'risk',
    textKey: 'monitoring.operational.ai-question-risk',
    params: {incidents: props.activeIncidents},
  },
  {
    id: 'compliance',
    textKey: 'monitoring.operational.ai-question-compliance',
    params: {compliance: formatNumber(props.thermalCompliance)},
  },
  {
    id: 'next',
    textKey: props.criticalIncidents > 0
      ? 'monitoring.operational.ai-question-next-critical'
      : 'monitoring.operational.ai-question-next-open',
    params: {critical: props.criticalIncidents, incidents: props.activeIncidents},
  },
  {
    id: 'maintenance',
    textKey: 'monitoring.operational.ai-question-maintenance',
    params: {progress: formatNumber(props.maintenanceCompletion)},
  },
]);

/**
 * Opens the assistant and preserves the empty prompt state until the operator asks a question.
 *
 * @returns {void}
 */
function openPanel() {
  previouslyFocusedElement = document.activeElement;
  expanded.value = true;
  nextTick(() => closeButton.value?.focus());
}

/**
 * Closes the assistant without losing the current dashboard state.
 *
 * @returns {void}
 */
function closePanel() {
  expanded.value = false;
  nextTick(() => {
    const focusTarget = launcher.value ?? previouslyFocusedElement;
    focusTarget?.focus?.();
    previouslyFocusedElement = null;
  });
}

/**
 * Keeps keyboard focus inside the modal and closes it with Escape.
 *
 * @param {KeyboardEvent} event
 * @returns {void}
 */
function handlePanelKeydown(event) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closePanel();
    return;
  }

  if (event.key !== 'Tab') return;

  const focusableElements = panel.value
    ? [...panel.value.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), details > summary, [tabindex]:not([tabindex="-1"])',
    )].filter(element => !element.hasAttribute('hidden'))
    : [];

  if (focusableElements.length === 0) {
    event.preventDefault();
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements.at(-1);
  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

/**
 * Sends one of the suggested translated questions.
 *
 * @param {*} prompt
 * @returns {void}
 */
function askSuggestedQuestion(prompt) {
  askQuestion(t(prompt.textKey, prompt.params));
}

/**
 * Adds a user question to the chat and requests backend interpretation when needed.
 *
 * @param {string} submittedQuestion
 * @param {{requestQuestion?: string}} options
 * @returns {void}
 */
function askQuestion(submittedQuestion = question.value, options = {}) {
  const normalizedQuestion = String(submittedQuestion ?? '').trim();
  if (!normalizedQuestion) return;

  const chatTurnId = nextChatTurnId;
  nextChatTurnId += 1;
  const greeting = isGreeting(normalizedQuestion);

  chatTurns.value = [
    ...chatTurns.value,
    {
      id: chatTurnId,
      question: normalizedQuestion,
      answer: null,
      localAnswer: greeting ? localAnswerFor(normalizedQuestion) : '',
      failure: 'none',
      loading: !greeting,
    },
  ];
  question.value = '';

  if (greeting) return;
  requestInterpretation(options.requestQuestion ?? normalizedQuestion, chatTurnId);
}

/**
 * Retries a failed chat turn.
 *
 * @param {*} turn
 * @returns {void}
 */
function retryChatTurn(turn) {
  updateChatTurn(turn.id, {answer: null, failure: 'none', loading: true});
  const requestQuestion = turn.question === t('monitoring.operational.ai-initial-question') ? '' : turn.question;
  requestInterpretation(requestQuestion, turn.id);
}

/**
 * Requests dashboard AI interpretation from the backend.
 *
 * @param {string} submittedQuestion
 * @param {number} chatTurnId
 * @returns {Promise<void>}
 */
async function requestInterpretation(submittedQuestion = '', chatTurnId = null) {
  const normalizedQuestion = String(submittedQuestion ?? '').trim();
  loading.value = true;
  failure.value = 'none';

  try {
    const request = {preferredLanguage: preferredLanguageFrom(normalizedQuestion)};
    if (normalizedQuestion) request.question = normalizedQuestion;

    const interpretation = await monitoringStore.generateDashboardAiInterpretation(props.organizationId, request);
    if (chatTurnId) updateChatTurn(chatTurnId, {answer: normalizedInterpretation(interpretation), failure: 'none', loading: false});
  } catch (error) {
    const resolvedFailure = failureFrom(error);
    if (chatTurnId) updateChatTurn(chatTurnId, {failure: resolvedFailure, loading: false});
    else failure.value = resolvedFailure;
  } finally {
    loading.value = false;
  }
}

/**
 * Updates one chat turn by id.
 *
 * @param {number} chatTurnId
 * @param {*} partialTurn
 * @returns {void}
 */
function updateChatTurn(chatTurnId, partialTurn) {
  chatTurns.value = chatTurns.value.map(turn => turn.id === chatTurnId ? {...turn, ...partialTurn} : turn);
}

/**
 * Normalizes optional backend arrays so the template can render safely.
 *
 * @param {*} interpretation
 * @returns {*}
 */
function normalizedInterpretation(interpretation = {}) {
  return {
    organizationId: interpretation.organizationId ?? props.organizationId,
    question: interpretation.question ?? '',
    generatedAt: interpretation.generatedAt ?? '',
    overallReading: interpretation.overallReading ?? t('monitoring.operational.ai-empty-response'),
    attentionLevel: interpretation.attentionLevel ?? currentTone.value,
    metricInsights: interpretation.metricInsights ?? [],
    risks: interpretation.risks ?? [],
    recommendedActions: interpretation.recommendedActions ?? [],
    uncertaintyNotes: interpretation.uncertaintyNotes ?? [],
    sourceMetrics: interpretation.sourceMetrics ?? [],
    modelProvider: interpretation.modelProvider ?? '',
    modelName: interpretation.modelName ?? '',
  };
}

/**
 * Formats the backend generatedAt timestamp.
 *
 * @param {*} interpretation
 * @returns {string}
 */
function formattedGeneratedAtFor(interpretation) {
  if (!interpretation.generatedAt) return '';

  const date = new Date(interpretation.generatedAt);
  if (Number.isNaN(date.getTime())) return interpretation.generatedAt;

  return new Intl.DateTimeFormat(currentLocale(), {dateStyle: 'medium', timeStyle: 'short'}).format(date);
}

/**
 * Formats one source metric value and unit.
 *
 * @param {*} metric
 * @returns {string}
 */
function formatSourceMetric(metric) {
  const value = `${metric.value ?? ''}`.trim();
  const unit = `${metric.unit ?? ''}`.trim();
  if (!unit) return value;
  return unit === '%' ? `${value}${unit}` : `${value} ${unit}`;
}

/**
 * Selects the most relevant evidence metrics for the compact answer.
 *
 * @param {*} interpretation
 * @returns {Array<*>}
 */
function visibleSourceMetricsFor(interpretation) {
  const sourceMetrics = interpretation.sourceMetrics ?? [];
  const primaryMetricNames = ['openIncidents', 'thermalCompliance', 'outOfRangeReadings', 'devicesWithUnhealthyStatus'];
  const metricsByName = new Map(sourceMetrics.map(metric => [metric.name, metric]));
  const primaryMetrics = primaryMetricNames.map(metricName => metricsByName.get(metricName)).filter(Boolean);
  return (primaryMetrics.length > 0 ? primaryMetrics : sourceMetrics).slice(0, 4);
}

/**
 * Counts hidden source metrics.
 *
 * @param {*} interpretation
 * @returns {number}
 */
function hiddenSourceMetricCountFor(interpretation) {
  return Math.max(0, (interpretation.sourceMetrics?.length ?? 0) - visibleSourceMetricsFor(interpretation).length);
}

/**
 * Selects compact metric insights.
 *
 * @param {*} interpretation
 * @returns {Array<*>}
 */
function visibleMetricInsightsFor(interpretation) {
  return (interpretation.metricInsights ?? []).slice(0, 3);
}

/**
 * Resolves a localized metric label.
 *
 * @param {string} metricName
 * @returns {string}
 */
function metricLabel(metricName) {
  const translationKey = `monitoring.operational.ai-source-metric-${metricName}`;
  const translatedLabel = t(translationKey);
  return translatedLabel === translationKey ? metricName : translatedLabel;
}

/**
 * Resolves a translated failure title.
 *
 * @param {string} failureType
 * @returns {string}
 */
function failureTitleKeyFor(failureType) {
  return `monitoring.operational.ai-error-${failureType}-title`;
}

/**
 * Resolves a translated failure body.
 *
 * @param {string} failureType
 * @returns {string}
 */
function failureBodyKeyFor(failureType) {
  return `monitoring.operational.ai-error-${failureType}-body`;
}

/**
 * Resolves a metric insight tone.
 *
 * @param {*} metricInsight
 * @returns {'ok'|'warning'|'critical'}
 */
function metricTone(metricInsight) {
  return toneFromAttentionLevel(metricInsight.severity);
}

/**
 * Maps backend failures to controlled UI states.
 *
 * @param {*} error
 * @returns {string}
 */
function failureFrom(error) {
  if (error instanceof Error && error.message === 'organization-scope-required') return 'organization-required';

  const status = error?.response?.status;
  if (status === 401) return 'auth-required';
  if ([402, 403, 409].includes(status)) return 'plan-locked';
  if (status === 502) return 'invalid-output';
  if (status === 504) return 'timeout';
  return 'provider-error';
}

/**
 * Chooses request language using app locale and simple question detection.
 *
 * @param {string} submittedQuestion
 * @returns {'es'|'en'}
 */
function preferredLanguageFrom(submittedQuestion) {
  if (locale.value?.startsWith('es') || looksLikeSpanish(submittedQuestion)) return 'es';
  return 'en';
}

/**
 * Returns a local greeting without calling the AI endpoint.
 *
 * @param {string} submittedQuestion
 * @returns {string}
 */
function localAnswerFor(submittedQuestion) {
  if (preferredLanguageFrom(submittedQuestion) === 'es') {
    return 'Hola. Puedo ayudarte a revisar incidencias, cumplimiento térmico, sensores o mantenimiento del dashboard.';
  }

  return 'Hi. I can help review incidents, thermal compliance, sensors, or dashboard maintenance.';
}

/**
 * Determines whether the user message is just a greeting.
 *
 * @param {string} submittedQuestion
 * @returns {boolean}
 */
function isGreeting(submittedQuestion) {
  const normalizedQuestion = normalizeText(submittedQuestion).replace(/[^\p{L}\p{N}\s]/gu, '').trim();
  return ['hola', 'buenas', 'buenos dias', 'buenas tardes', 'buenas noches', 'hello', 'hi', 'hey'].includes(normalizedQuestion);
}

/**
 * Detects Spanish questions when the app locale is English.
 *
 * @param {string} submittedQuestion
 * @returns {boolean}
 */
function looksLikeSpanish(submittedQuestion) {
  const normalizedQuestion = normalizeText(submittedQuestion);
  return /[¿¡]/.test(submittedQuestion) ||
    [
      /\bque\b/,
      /\bcual(es)?\b/,
      /\bpor que\b/,
      /\bincidencia(s)?\b/,
      /\bcumplimiento\b/,
      /\bmantenimiento\b/,
      /\briesgo(s)?\b/,
      /\btemperatura\b/,
      /\bdeberia\b/,
      /\baccion(es)?\b/,
      /\bhola\b/,
      /\bbuenas\b/,
      /\bbuenos dias\b/,
      /\bbuenas tardes\b/,
      /\bbuenas noches\b/,
    ].some(pattern => pattern.test(normalizedQuestion));
}

/**
 * Maps attention labels to UI tone.
 *
 * @param {string} attentionLevel
 * @returns {'ok'|'warning'|'critical'}
 */
function toneFromAttentionLevel(attentionLevel = '') {
  const normalizedAttentionLevel = normalizeText(attentionLevel);
  if (normalizedAttentionLevel.includes('critical') || normalizedAttentionLevel.includes('critica') || normalizedAttentionLevel.includes('high')) {
    return 'critical';
  }

  if (
    normalizedAttentionLevel.includes('warning') ||
    normalizedAttentionLevel.includes('medium') ||
    normalizedAttentionLevel.includes('attention') ||
    normalizedAttentionLevel.includes('moderate')
  ) {
    return 'warning';
  }

  return 'ok';
}

/**
 * Normalizes text for language and tone checks.
 *
 * @param {string} text
 * @returns {string}
 */
function normalizeText(text = '') {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Formats numbers using the current UI locale.
 *
 * @param {number} value
 * @returns {string}
 */
function formatNumber(value) {
  return new Intl.NumberFormat(currentLocale(), {maximumFractionDigits: 1}).format(value);
}

/**
 * Resolves the current browser display locale.
 *
 * @returns {string}
 */
function currentLocale() {
  return locale.value?.startsWith('es') ? 'es-PE' : 'en-US';
}
</script>

<template>
  <button
    v-if="!expanded"
    ref="launcher"
    class="ai-launcher"
    type="button"
    :class="currentTone"
    @click="openPanel"
  >
    <span class="material-icons" aria-hidden="true">auto_awesome</span>
    <span>{{ t('monitoring.operational.ai-open') }}</span>
    <strong>{{ t(insightStatusKey) }}</strong>
  </button>

  <template v-else>
    <div class="ai-backdrop" aria-hidden="true" @click="closePanel"></div>

    <section
      ref="panel"
      class="ai-panel"
      aria-labelledby="dashboard-ai-title"
      role="dialog"
      aria-modal="true"
      @keydown="handlePanelKeydown"
    >
      <div class="ai-header">
        <div class="ai-mark" aria-hidden="true">
          <span class="material-icons">auto_awesome</span>
        </div>

        <div class="ai-heading">
          <span>{{ t('monitoring.operational.ai-kicker') }}</span>
          <h2 id="dashboard-ai-title">{{ t('monitoring.operational.ai-title') }}</h2>
          <p>{{ t('monitoring.operational.ai-subtitle') }}</p>
        </div>

        <button ref="closeButton" class="ai-close" type="button" :aria-label="t('monitoring.operational.ai-close')" @click="closePanel">
          <span class="material-icons" aria-hidden="true">close</span>
        </button>
      </div>

      <span class="ai-status" :class="currentTone">{{ t(insightStatusKey) }}</span>

      <div class="ai-body">
        <article v-if="chatTurns.length === 0" class="ai-state">
          <span class="material-icons" aria-hidden="true">chat</span>
          <div>
            <h3>{{ t('monitoring.operational.ai-empty-title') }}</h3>
            <p>{{ t('monitoring.operational.ai-empty-body') }}</p>
          </div>
        </article>

        <section v-if="chatTurns.length > 0" class="ai-chat" aria-labelledby="ai-chat-title">
          <h3 id="ai-chat-title">{{ t('monitoring.operational.ai-chat-title') }}</h3>

          <div class="ai-chat-list">
            <template v-for="turn in chatTurns" :key="turn.id">
              <article class="ai-message user">
                <span>{{ t('monitoring.operational.ai-chat-user') }}</span>
                <p>{{ turn.question }}</p>
              </article>

              <article class="ai-message assistant">
                <span>{{ t('monitoring.operational.ai-chat-assistant') }}</span>

                <p v-if="turn.loading">{{ t('monitoring.operational.ai-chat-loading') }}</p>
                <p v-else-if="turn.localAnswer">{{ turn.localAnswer }}</p>

                <template v-else-if="turn.failure !== 'none'">
                  <strong>{{ t(failureTitleKeyFor(turn.failure)) }}</strong>
                  <p>{{ t(failureBodyKeyFor(turn.failure)) }}</p>
                  <button class="ai-chat-action" type="button" @click="retryChatTurn(turn)">
                    {{ t('monitoring.operational.ai-retry') }}
                  </button>
                </template>

                <template v-else-if="turn.answer">
                  <article class="ai-summary compact">
                    <div>
                      <span>{{ t('monitoring.operational.ai-answer-title') }}</span>
                      <h3>{{ turn.answer.overallReading }}</h3>
                    </div>

                    <p v-if="formattedGeneratedAtFor(turn.answer)" class="ai-metadata">
                      {{ t('monitoring.operational.ai-generated-at') }}
                      {{ formattedGeneratedAtFor(turn.answer) }}
                    </p>
                  </article>

                  <div v-if="visibleMetricInsightsFor(turn.answer).length > 0" class="ai-insight-list compact">
                    <article
                      v-for="insight in visibleMetricInsightsFor(turn.answer)"
                      :key="`${turn.id}-${insight.title}-${insight.metric}`"
                      class="ai-insight"
                      :class="metricTone(insight)"
                    >
                      <span>{{ metricLabel(insight.metric) }}</span>
                      <strong>{{ insight.title }}</strong>
                      <p>{{ insight.interpretation }}</p>
                    </article>
                  </div>

                  <details class="ai-details compact">
                    <summary>{{ t('monitoring.operational.ai-details-title') }}</summary>

                    <div class="ai-details-body">
                      <section v-if="turn.answer.risks.length > 0" class="ai-section compact">
                        <h3>{{ t('monitoring.operational.ai-risks-title') }}</h3>
                        <ul class="ai-list">
                          <li v-for="risk in turn.answer.risks" :key="risk">{{ risk }}</li>
                        </ul>
                      </section>

                      <section v-if="turn.answer.recommendedActions.length > 0" class="ai-section compact">
                        <h3>{{ t('monitoring.operational.ai-actions-title') }}</h3>
                        <ol class="ai-list numbered">
                          <li v-for="action in turn.answer.recommendedActions" :key="action">{{ action }}</li>
                        </ol>
                      </section>

                      <section v-if="turn.answer.uncertaintyNotes.length > 0" class="ai-section compact">
                        <h3>{{ t('monitoring.operational.ai-uncertainty-title') }}</h3>
                        <ul class="ai-list muted">
                          <li v-for="note in turn.answer.uncertaintyNotes" :key="note">{{ note }}</li>
                        </ul>
                      </section>

                      <section v-if="visibleSourceMetricsFor(turn.answer).length > 0" class="ai-section compact">
                        <h3>{{ t('monitoring.operational.ai-source-metrics-title') }}</h3>

                        <div class="ai-source-grid">
                          <article
                            v-for="metric in visibleSourceMetricsFor(turn.answer)"
                            :key="`${turn.id}-${metric.name}`"
                            class="ai-source-metric"
                          >
                            <span>{{ metricLabel(metric.name) }}</span>
                            <strong>{{ formatSourceMetric(metric) }}</strong>
                          </article>
                        </div>

                        <p v-if="hiddenSourceMetricCountFor(turn.answer) > 0" class="ai-source-note">
                          {{ t('monitoring.operational.ai-source-metrics-extra', {count: hiddenSourceMetricCountFor(turn.answer)}) }}
                        </p>
                      </section>

                      <p v-if="turn.answer.modelProvider || turn.answer.modelName" class="ai-model">
                        {{ t('monitoring.operational.ai-model-label') }}
                        {{ turn.answer.modelProvider }} {{ turn.answer.modelName }}
                      </p>
                    </div>
                  </details>
                </template>
              </article>
            </template>
          </div>
        </section>

        <section class="ai-qa" aria-labelledby="ai-qa-title">
          <h3 id="ai-qa-title">{{ t('monitoring.operational.ai-qa-title') }}</h3>

          <div class="ai-prompts">
            <button
              v-for="prompt in suggestedQuestions"
              :key="prompt.id"
              type="button"
              :disabled="loading"
              @click="askSuggestedQuestion(prompt)"
            >
              {{ t(prompt.textKey, prompt.params) }}
            </button>
          </div>

          <label class="ai-question">
            <span>{{ t('monitoring.operational.ai-question-label') }}</span>
            <div class="ai-question-row">
              <input
                v-model="question"
                type="text"
                :disabled="loading"
                :placeholder="t('monitoring.operational.ai-question-placeholder')"
                @keydown.enter="askQuestion()"
              />
              <button
                type="button"
                :disabled="loading || question.trim().length === 0"
                :aria-label="t('monitoring.operational.ai-send')"
                @click="askQuestion()"
              >
                <span class="material-icons" aria-hidden="true">send</span>
              </button>
            </div>
          </label>
        </section>
      </div>
    </section>
  </template>
</template>

<style scoped>
.ai-launcher {
  align-items: center;
  background: #263348;
  border: 0;
  border-radius: 999px;
  bottom: 28px;
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.18);
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  gap: 9px;
  padding: 12px 15px;
  position: fixed;
  right: 28px;
  z-index: 900;
}

.ai-launcher span,
.ai-launcher strong {
  font-size: 13px;
  font-weight: 900;
}

.ai-launcher strong {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 999px;
  padding: 5px 8px;
}

.ai-backdrop {
  background: rgba(15, 23, 42, 0.36);
  inset: 0;
  position: fixed;
  z-index: 1100;
}

.ai-panel {
  background: #ffffff;
  border: 1px solid rgba(17, 24, 39, 0.06);
  border-radius: 8px;
  bottom: 24px;
  box-shadow:
    0 14px 34px rgba(15, 23, 42, 0.16),
    0 28px 56px rgba(15, 23, 42, 0.14);
  box-sizing: border-box;
  max-width: 720px;
  overflow: auto;
  padding: 22px;
  position: fixed;
  right: 24px;
  top: 24px;
  width: 100%;
  z-index: 1101;
}

.ai-header,
.ai-body,
.ai-question-row,
.ai-source-grid,
.ai-insight-list {
  display: grid;
  gap: 16px;
}

.ai-header {
  align-items: center;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.ai-mark {
  align-items: center;
  background: #eef4ff;
  border-radius: 8px;
  color: #2f64ed;
  display: flex;
  height: 46px;
  justify-content: center;
  width: 46px;
}

.ai-heading span,
.ai-summary span,
.ai-source-metric span,
.ai-question span,
.ai-insight span {
  color: #667085;
  display: block;
  font-size: 12px;
  font-weight: 800;
}

.ai-heading h2,
.ai-section h3,
.ai-qa h3,
.ai-state h3,
.ai-summary h3 {
  color: #263348;
  font-size: 18px;
  font-weight: 800;
  margin: 0;
}

.ai-heading p,
.ai-state p,
.ai-insight p,
.ai-metadata,
.ai-model,
.ai-source-note {
  color: #98a2b3;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  margin: 6px 0 0;
}

.ai-close {
  align-items: center;
  background: #f1f5f9;
  border: 0;
  border-radius: 8px;
  color: #667085;
  cursor: pointer;
  display: inline-flex;
  height: 36px;
  justify-content: center;
  width: 36px;
}

.ai-status {
  border-radius: 999px;
  display: inline-block;
  font-size: 12px;
  font-weight: 900;
  margin-top: 16px;
  padding: 9px 13px;
  white-space: nowrap;
}

.ai-status.ok,
.ai-insight.ok {
  background: #e6f9eb;
  color: #0f8f57;
}

.ai-status.warning,
.ai-insight.warning {
  background: #fff7e6;
  color: #b7791f;
}

.ai-status.critical,
.ai-insight.critical {
  background: #fff0f0;
  color: #c2410c;
}

.ai-body {
  margin-top: 20px;
}

.ai-summary,
.ai-state,
.ai-section,
.ai-chat,
.ai-qa {
  border: 1px solid #e5eaf2;
  border-radius: 8px;
  padding: 16px;
}

.ai-details {
  border: 1px solid #e5eaf2;
  border-radius: 8px;
  padding: 0;
}

.ai-details summary {
  color: #315fcb;
  cursor: pointer;
  font-size: 14px;
  font-weight: 900;
  list-style: none;
  padding: 14px 16px;
}

.ai-details summary::-webkit-details-marker {
  display: none;
}

.ai-details summary::after {
  content: '+';
  float: right;
}

.ai-details[open] summary::after {
  content: '-';
}

.ai-details-body {
  border-top: 1px solid #e5eaf2;
  display: grid;
  gap: 12px;
  padding: 12px;
}

.ai-summary {
  background: #f8fafc;
}

.ai-summary h3 {
  font-size: 17px;
  line-height: 1.45;
  margin-top: 6px;
}

.ai-state {
  align-items: start;
  background: #f8fafc;
  display: grid;
  gap: 12px;
  grid-template-columns: auto minmax(0, 1fr);
}

.ai-state .material-icons {
  color: #2f64ed;
}

.ai-section h3,
.ai-chat h3,
.ai-qa h3 {
  font-size: 15px;
}

.ai-chat-list {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.ai-message {
  border-radius: 8px;
  display: grid;
  gap: 6px;
  max-width: 86%;
  padding: 12px;
}

.ai-message span {
  color: #667085;
  font-size: 12px;
  font-weight: 900;
}

.ai-message p,
.ai-message ul {
  color: #475467;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.5;
  margin: 0;
}

.ai-message strong {
  color: #263348;
  font-size: 14px;
  font-weight: 900;
}

.ai-message.user {
  background: #eef4ff;
  justify-self: end;
}

.ai-message.assistant {
  background: #f8fafc;
  gap: 10px;
  justify-self: start;
  max-width: 94%;
}

.ai-chat-action {
  background: transparent;
  border: 0;
  color: #2f64ed;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 900;
  justify-self: start;
  padding: 0;
}

.ai-insight-list,
.ai-source-grid {
  margin-top: 12px;
}

.ai-insight-list.compact {
  display: grid;
  gap: 8px;
  margin-top: 0;
}

.ai-message .ai-summary,
.ai-message .ai-section,
.ai-message .ai-details {
  background: #ffffff;
}

.ai-summary.compact,
.ai-section.compact {
  padding: 12px;
}

.ai-details.compact summary {
  padding: 12px;
}

.ai-details.compact .ai-details-body {
  padding: 10px;
}

.ai-insight {
  border-radius: 8px;
  padding: 14px;
}

.ai-insight strong,
.ai-source-metric strong {
  color: #263348;
  display: block;
  font-size: 16px;
  font-weight: 900;
  margin-top: 5px;
}

.ai-insight p {
  color: #667085;
}

.ai-list {
  color: #667085;
  display: grid;
  font-size: 13px;
  font-weight: 700;
  gap: 9px;
  line-height: 1.5;
  margin: 12px 0 0;
  padding-left: 18px;
}

.ai-list.numbered {
  padding-left: 20px;
}

.ai-list.muted {
  color: #98a2b3;
}

.ai-source-grid {
  gap: 10px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.ai-source-metric {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px;
}

.ai-source-metric strong {
  font-size: 15px;
}

.ai-source-note {
  margin-top: 10px;
}

.ai-model {
  text-align: right;
}

.ai-prompts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 12px 0 14px;
}

.ai-prompts button,
.ai-question-row button {
  border: 0;
  cursor: pointer;
  font: inherit;
  font-weight: 800;
}

.ai-prompts button {
  background: #eef4ff;
  border-radius: 999px;
  color: #315fcb;
  padding: 8px 11px;
}

.ai-prompts button:disabled,
.ai-question-row button:disabled {
  cursor: progress;
  opacity: 0.62;
}

.ai-question-row {
  grid-template-columns: minmax(0, 1fr) auto;
  margin-top: 8px;
}

.ai-question-row input {
  border: 1px solid #d9e1ec;
  border-radius: 8px;
  color: #263348;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  min-height: 42px;
  padding: 0 12px;
}

.ai-question-row input:disabled {
  background: #f8fafc;
  color: #98a2b3;
}

.ai-question-row button {
  align-items: center;
  background: #2f64ed;
  border-radius: 8px;
  color: #ffffff;
  display: inline-flex;
  height: 42px;
  justify-content: center;
  width: 46px;
}

@media (max-width: 1020px) {
  .ai-panel {
    bottom: 16px;
    max-width: none;
    right: 16px;
    top: 16px;
    width: calc(100vw - 32px);
  }

  .ai-launcher {
    bottom: 18px;
    left: 16px;
    justify-content: center;
    right: 16px;
  }
}

@media (max-width: 720px) {
  .ai-header,
  .ai-state {
    grid-template-columns: minmax(0, 1fr);
  }

  .ai-source-grid {
    grid-template-columns: 1fr;
  }

  .ai-message {
    max-width: 100%;
  }
}
</style>
