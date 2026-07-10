<script setup>
import {computed, reactive, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRoute} from 'vue-router';

const {t} = useI18n();
const route = useRoute();
const form = reactive({password: '', confirmPassword: ''});
const submitted = ref(false);
const passwordVisible = ref(false);
const feedback = ref('idle');
const expired = computed(() => route.query.state === 'expired');
const passwordInvalid = computed(() => form.password.length < 8);
const confirmationInvalid = computed(() => !form.confirmPassword || form.password !== form.confirmPassword);

/**
 * Completes the reset-password demonstration flow.
 *
 * @returns {void}
 */
function submit() {
    submitted.value = true;
    feedback.value = 'idle';
    if (expired.value || passwordInvalid.value || confirmationInvalid.value) return;

    feedback.value = 'success';
    submitted.value = false;
    form.password = '';
    form.confirmPassword = '';
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel" aria-labelledby="reset-password-title">
      <img class="brand-logo" src="/coldtrace-logo.svg" alt="ColdTrace"/>

      <form class="auth-form" @submit.prevent="submit" novalidate>
        <h1 id="reset-password-title" class="screen-title">{{ t('reset-password.title') }}</h1>

        <p v-if="expired" class="form-feedback error">{{ t('reset-password.error.expired') }}</p>
        <template v-else>
          <div class="field-group">
            <label for="new-password">{{ t('reset-password.password') }}</label>
            <div class="password-control">
              <input
                id="new-password"
                v-model="form.password"
                :type="passwordVisible ? 'text' : 'password'"
                placeholder="••••••••••••"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="icon-button"
                :aria-label="t('reset-password.toggle-password-visibility')"
                @click="passwordVisible = !passwordVisible"
              >
                <span class="material-icons" aria-hidden="true">
                  {{ passwordVisible ? 'visibility_off' : 'visibility' }}
                </span>
              </button>
            </div>
            <p v-if="submitted && passwordInvalid" class="field-error">
              {{ t('reset-password.error.password-min-length') }}
            </p>
          </div>

          <div class="field-group">
            <label for="confirm-password">{{ t('reset-password.confirm-password') }}</label>
            <input
              id="confirm-password"
              v-model="form.confirmPassword"
              :type="passwordVisible ? 'text' : 'password'"
              placeholder="••••••••••••"
              autocomplete="new-password"
            />
            <p v-if="submitted && confirmationInvalid" class="field-error">
              {{ t('reset-password.error.passwords-must-match') }}
            </p>
          </div>

          <p v-if="feedback === 'success'" class="form-feedback success">
            {{ t('reset-password.success') }}
          </p>

          <button class="primary-action" type="submit">{{ t('reset-password.change-password') }}</button>
        </template>
      </form>

      <router-link v-if="expired" class="primary-link" to="/identity-access/password-recovery">
        {{ t('reset-password.request-new-link') }}
      </router-link>
      <router-link class="secondary-link" to="/identity-access/sign-in">
        {{ t('reset-password.back-to-login') }}
      </router-link>
    </section>
  </main>
</template>
