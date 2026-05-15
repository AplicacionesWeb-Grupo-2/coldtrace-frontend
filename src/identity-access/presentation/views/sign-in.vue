<script setup>
import {computed, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRouter} from 'vue-router';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';

const {t} = useI18n();
const router = useRouter();
const store = useIdentityAccessStore();
const form = ref({
    email: '',
    password: '',
    keepSignedIn: true,
});
const submitted = ref(false);
const signingIn = ref(false);
const passwordVisible = ref(false);
const feedback = ref('idle');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailInvalid = computed(() => !emailPattern.test(form.value.email.trim()));
const passwordInvalid = computed(() => !form.value.password);

async function submit() {
    submitted.value = true;
    feedback.value = 'idle';

    if (emailInvalid.value || passwordInvalid.value) return;

    signingIn.value = true;
    try {
        feedback.value = await store.signIn(form.value.email, form.value.password);
        if (feedback.value === 'success') {
            submitted.value = false;
            await router.push({name: 'identity-access-dashboard'});
        }
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        signingIn.value = false;
    }
}
</script>

<template>
  <main class="auth-page sign-in-page">
    <section class="auth-panel" aria-labelledby="sign-in-title">
      <img class="brand-logo" src="/coldtrace-logo.svg" alt="ColdTrace"/>

      <form class="sign-in-form" @submit.prevent="submit" novalidate>
        <h1 id="sign-in-title" class="visually-hidden">{{ t('sign-in.title') }}</h1>

        <div class="field-group">
          <label for="email">{{ t('sign-in.email') }}</label>
          <input
            id="email"
            v-model="form.email"
            type="email"
            placeholder="example_123@email.com"
            autocomplete="email"
          />
          <p v-if="submitted && emailInvalid" class="field-error">
            {{ t('sign-in.error.email-invalid') }}
          </p>
        </div>

        <div class="field-group">
          <div class="field-header">
            <label for="password">{{ t('sign-in.password') }}</label>
            <router-link class="field-link" to="/identity-access/password-recovery">
              {{ t('sign-in.forgot-password') }}
            </router-link>
          </div>
          <div class="password-control">
            <input
              id="password"
              v-model="form.password"
              :type="passwordVisible ? 'text' : 'password'"
              placeholder="************"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="icon-button"
              :aria-label="t('sign-in.toggle-password-visibility')"
              @click="passwordVisible = !passwordVisible"
            >
              <i :class="passwordVisible ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"/>
            </button>
          </div>
          <p v-if="submitted && passwordInvalid" class="field-error">
            {{ t('sign-in.error.password-required') }}
          </p>
        </div>

        <label class="check-row">
          <input v-model="form.keepSignedIn" type="checkbox"/>
          <span>{{ t('sign-in.keep-signed-in') }}</span>
        </label>

        <p v-if="feedback === 'invalid-credentials'" class="form-feedback error">
          {{ t('sign-in.error.invalid-credentials') }}
        </p>
        <p v-if="feedback === 'revoked-access'" class="form-feedback error">
          {{ t('sign-in.error.revoked-access') }}
        </p>
        <p v-if="feedback === 'success'" class="form-feedback success">
          {{ t('sign-in.success') }}
        </p>
        <p v-if="feedback === 'server-error'" class="form-feedback error">
          {{ t('sign-in.error.server-error') }}
        </p>

        <button class="primary-action" type="submit" :disabled="signingIn">
          {{ signingIn ? t('sign-in.signing-in') : t('sign-in.login') }}
        </button>
      </form>

      <div class="divider" aria-hidden="true">
        <span>{{ t('sign-in.social-divider') }}</span>
      </div>

      <button class="social-action" type="button">
        <img class="social-icon" src="/icons/google.svg" alt="" aria-hidden="true"/>
        <span>{{ t('sign-in.continue-with-google') }}</span>
      </button>
      <button class="social-action" type="button">
        <img class="social-icon" src="/icons/apple.svg" alt="" aria-hidden="true"/>
        <span>{{ t('sign-in.continue-with-apple') }}</span>
      </button>

      <router-link class="secondary-link" to="/identity-access/sign-up">
        {{ t('sign-in.create-account') }}
      </router-link>
    </section>
  </main>
</template>
