<script setup>
import {computed, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';

const {t} = useI18n();
const store = useIdentityAccessStore();
const email = ref('');
const submitted = ref(false);
const requesting = ref(false);
const feedback = ref('idle');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailInvalid = computed(() => !emailPattern.test(email.value.trim()));

/**
 * Requests a generic password recovery response from the backend.
 *
 * @returns {Promise<void>}
 */
async function submit() {
    submitted.value = true;
    feedback.value = 'idle';
    if (emailInvalid.value) return;

    requesting.value = true;
    try {
        await store.requestPasswordReset(email.value);
        feedback.value = 'sent';
        submitted.value = false;
    } catch {
        feedback.value = 'server-error';
    } finally {
        requesting.value = false;
    }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-panel" aria-labelledby="password-recovery-title">
      <img class="brand-logo" src="/coldtrace-logo.svg" alt="ColdTrace"/>

      <form class="auth-form" @submit.prevent="submit" novalidate>
        <h1 id="password-recovery-title" class="screen-title">{{ t('password-recovery.title') }}</h1>
        <p class="screen-copy">{{ t('password-recovery.subtitle') }}</p>

        <div class="field-group">
          <label for="recovery-email">{{ t('password-recovery.email') }}</label>
          <input
            id="recovery-email"
            v-model="email"
            type="email"
            placeholder="example_123@email.com"
            autocomplete="email"
          />
          <p v-if="submitted && emailInvalid" class="field-error">
            {{ t('password-recovery.error.email-invalid') }}
          </p>
        </div>

        <p v-if="feedback === 'sent'" class="form-feedback success">
          {{ t('password-recovery.success') }}
        </p>
        <p v-if="feedback === 'server-error'" class="form-feedback error">
          {{ t('password-recovery.error.server-error') }}
        </p>

        <button class="primary-action" type="submit" :disabled="requesting">
          {{ t(requesting ? 'password-recovery.requesting' : 'password-recovery.request-link') }}
        </button>
      </form>

      <router-link v-if="feedback === 'sent'" class="primary-link" to="/identity-access/reset-password">
        {{ t('password-recovery.continue-reset') }}
      </router-link>
      <router-link class="secondary-link" to="/identity-access/sign-in">
      {{ t('password-recovery.back-to-login') }}
      </router-link>
    </section>
  </main>
</template>
