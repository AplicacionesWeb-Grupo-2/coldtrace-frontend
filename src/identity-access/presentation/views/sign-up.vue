<script setup>
import {computed, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';

const {t} = useI18n();
const store = useIdentityAccessStore();
const form = ref({
    organizationName: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: true,
});
const submitted = ref(false);
const creating = ref(false);
const passwordVisible = ref(false);
const feedback = ref('idle');
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const organizationNameInvalid = computed(() => form.value.organizationName.trim().length < 2);
const fullNameInvalid = computed(() => form.value.fullName.trim().length < 3);
const emailInvalid = computed(() => !emailPattern.test(form.value.email.trim()));
const passwordInvalid = computed(() => form.value.password.length < 8);
const passwordMismatch = computed(() => form.value.password !== form.value.confirmPassword);

async function submit() {
    submitted.value = true;
    feedback.value = 'idle';

    if (
        organizationNameInvalid.value ||
        fullNameInvalid.value ||
        emailInvalid.value ||
        passwordInvalid.value ||
        passwordMismatch.value ||
        !form.value.acceptedTerms
    ) {
        return;
    }

    creating.value = true;
    try {
        const result = await store.createAccount(form.value);
        feedback.value = result.status;
        if (result.status === 'success') {
            submitted.value = false;
            form.value = {
                organizationName: '',
                fullName: '',
                email: '',
                password: '',
                confirmPassword: '',
                acceptedTerms: true,
            };
        }
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        creating.value = false;
    }
}
</script>

<template>
  <main class="auth-page sign-up-page">
    <section class="auth-panel" aria-labelledby="sign-up-title">
      <img class="brand-logo" src="/coldtrace-logo.svg" alt="ColdTrace"/>

      <form class="sign-up-form" @submit.prevent="submit" novalidate>
        <h1 id="sign-up-title" class="screen-title">{{ t('sign-up.title') }}</h1>

        <div class="field-group">
          <label for="organization-name">{{ t('sign-up.organization-name') }}</label>
          <input
            id="organization-name"
            v-model="form.organizationName"
            type="text"
            :placeholder="t('sign-up.organization-name-placeholder')"
          />
          <p v-if="submitted && organizationNameInvalid" class="field-error">
            {{ t('sign-up.error.organization-name-required') }}
          </p>
        </div>

        <div class="field-group">
          <label for="full-name">{{ t('sign-up.full-name') }}</label>
          <input
            id="full-name"
            v-model="form.fullName"
            type="text"
            :placeholder="t('sign-up.full-name-placeholder')"
            autocomplete="name"
          />
          <p v-if="submitted && fullNameInvalid" class="field-error">
            {{ t('sign-up.error.full-name-required') }}
          </p>
        </div>

        <div class="field-group">
          <label for="sign-up-email">{{ t('sign-up.email') }}</label>
          <input
            id="sign-up-email"
            v-model="form.email"
            type="email"
            placeholder="example_123@email.com"
            autocomplete="email"
          />
          <p v-if="submitted && emailInvalid" class="field-error">
            {{ t('sign-up.error.email-invalid') }}
          </p>
        </div>

        <div class="field-group">
          <label for="sign-up-password">{{ t('sign-up.password') }}</label>
          <div class="password-control">
            <input
              id="sign-up-password"
              v-model="form.password"
              :type="passwordVisible ? 'text' : 'password'"
              placeholder="************"
              autocomplete="new-password"
            />
            <button
              type="button"
              class="icon-button"
              :aria-label="t('sign-up.toggle-password-visibility')"
              @click="passwordVisible = !passwordVisible"
            >
              <i :class="passwordVisible ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true"/>
            </button>
          </div>
          <p v-if="submitted && passwordInvalid" class="field-error">
            {{ t('sign-up.error.password-min-length') }}
          </p>
        </div>

        <div class="field-group">
          <label for="confirm-password">{{ t('sign-up.confirm-password') }}</label>
          <input
            id="confirm-password"
            v-model="form.confirmPassword"
            :type="passwordVisible ? 'text' : 'password'"
            placeholder="************"
            autocomplete="new-password"
          />
          <p v-if="submitted && passwordMismatch" class="field-error">
            {{ t('sign-up.error.passwords-must-match') }}
          </p>
        </div>

        <label class="check-row">
          <input v-model="form.acceptedTerms" type="checkbox"/>
          <span>{{ t('sign-up.accept-terms') }}</span>
        </label>

        <p v-if="feedback === 'duplicate-email'" class="form-feedback error">
          {{ t('sign-up.error.duplicate-email') }}
        </p>
        <p v-if="feedback === 'success'" class="form-feedback success">
          {{ t('sign-up.success') }}
        </p>
        <p v-if="feedback === 'server-error'" class="form-feedback error">
          {{ t('sign-up.error.server-error') }}
        </p>

        <button class="primary-action" type="submit" :disabled="creating">
          {{ creating ? t('sign-up.creating') : t('sign-up.create') }}
        </button>
      </form>

      <div class="divider" aria-hidden="true">
        <span>{{ t('sign-up.social-divider') }}</span>
      </div>

      <button class="social-action" type="button">
        <img class="social-icon" src="/icons/google.svg" alt="" aria-hidden="true"/>
        <span>{{ t('sign-up.continue-with-google') }}</span>
      </button>
      <button class="social-action" type="button">
        <img class="social-icon" src="/icons/apple.svg" alt="" aria-hidden="true"/>
        <span>{{ t('sign-up.continue-with-apple') }}</span>
      </button>

      <router-link class="secondary-link" to="/identity-access/sign-in">
        {{ t('sign-up.already-have-account') }}
      </router-link>
    </section>
  </main>
</template>
