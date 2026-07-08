<script setup>
import {computed, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRouter} from 'vue-router';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import {AppleIdentityService} from '@/identity-access/infrastructure/apple-identity.js';
import {GoogleIdentityService} from '@/identity-access/infrastructure/google-identity.js';

const {t} = useI18n();
const router = useRouter();
const store = useIdentityAccessStore();
const appleIdentity = new AppleIdentityService();
const googleIdentity = new GoogleIdentityService();
const form = ref({
    email: '',
    password: '',
});
const submitted = ref(false);
const signingIn = ref(false);
const passwordVisible = ref(false);
const feedback = ref('idle');
const pendingSocialOnboardingProvider = ref(null);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const emailInvalid = computed(() => !emailPattern.test(form.value.email.trim()));
const passwordInvalid = computed(() => !form.value.password);

/**
 * Handles submit behavior in the identity access context.
 *
 * @returns {Promise<*>}
 */
async function submit() {
    submitted.value = true;
    feedback.value = 'idle';
    pendingSocialOnboardingProvider.value = null;

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

/**
 * Starts Google sign-in and exchanges the provider token through the backend.
 *
 * @returns {Promise<void>}
 */
async function signInWithGoogle() {
    await startSocialSignIn('google');
}

/**
 * Starts Apple sign-in and exchanges the provider token through the backend.
 *
 * @returns {Promise<void>}
 */
async function signInWithApple() {
    await startSocialSignIn('apple');
}

/**
 * Continues social onboarding after the backend reports that no account is linked.
 *
 * @returns {Promise<void>}
 */
async function continueWithSocialSignUp() {
    const provider = pendingSocialOnboardingProvider.value;
    if (!provider) return;

    try {
        signingIn.value = true;
        const credential = provider === 'google'
            ? await googleIdentity.signIn()
            : await appleIdentity.signIn();
        await openSocialSignUp(provider, credential);
    } catch {
        feedback.value = 'social-unavailable';
        pendingSocialOnboardingProvider.value = null;
    } finally {
        signingIn.value = false;
    }
}

/**
 * Lets the user restart provider selection.
 *
 * @returns {Promise<void>}
 */
async function chooseAnotherSocialAccount() {
    const provider = pendingSocialOnboardingProvider.value;
    feedback.value = 'idle';
    pendingSocialOnboardingProvider.value = null;

    if (provider === 'google') {
        await signInWithGoogle();
        return;
    }

    if (provider === 'apple') {
        await signInWithApple();
    }
}

/**
 * Starts a social provider sign-in.
 *
 * @param {'google'|'apple'} provider
 * @returns {Promise<void>}
 */
async function startSocialSignIn(provider) {
    feedback.value = 'idle';
    pendingSocialOnboardingProvider.value = null;

    try {
        signingIn.value = true;
        const credential = provider === 'google'
            ? await googleIdentity.signIn()
            : await appleIdentity.signIn();
        const result = await store.signInWithSocialProvider(provider, credential);
        feedback.value = result;

        if (result === 'success') {
            submitted.value = false;
            await router.push({
                name: 'identity-access-dashboard',
                query: {
                    organizationId: store.currentUser?.organizationId,
                    userId: store.currentUser?.id,
                },
            });
            return;
        }

        if (result === 'onboarding-required') {
            pendingSocialOnboardingProvider.value = provider;
        }
    } catch {
        feedback.value = 'social-unavailable';
    } finally {
        signingIn.value = false;
    }
}

/**
 * Opens the sign-up screen with the fresh provider credential.
 *
 * @param {'google'|'apple'} provider
 * @param {*} credential
 * @returns {Promise<void>}
 */
async function openSocialSignUp(provider, credential) {
    feedback.value = 'idle';
    pendingSocialOnboardingProvider.value = null;
    await router.push({
        name: 'identity-access-sign-up',
        state: {
            socialSignUp: {
                provider,
                credential,
            },
        },
    });
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
              placeholder="••••••••••••"
              autocomplete="current-password"
            />
            <button
              type="button"
              class="icon-button"
              :aria-label="t('sign-in.toggle-password-visibility')"
              @click="passwordVisible = !passwordVisible"
            >
              <span class="material-icons" aria-hidden="true">
                {{ passwordVisible ? 'visibility_off' : 'visibility' }}
              </span>
            </button>
          </div>
          <p v-if="submitted && passwordInvalid" class="field-error">
            {{ t('sign-in.error.password-required') }}
          </p>
        </div>

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
        <p v-if="feedback === 'onboarding-required' && !pendingSocialOnboardingProvider" class="form-feedback error">
          {{ t('sign-in.error.onboarding-required') }}
        </p>
        <p v-if="feedback === 'social-unavailable'" class="form-feedback error">
          {{ t('sign-in.error.social-unavailable') }}
        </p>
        <p v-if="feedback === 'social-validation-failed'" class="form-feedback error">
          {{ t('sign-in.error.social-validation-failed') }}
        </p>

        <button class="primary-action" type="submit" :disabled="signingIn">
          {{ signingIn ? t('sign-in.signing-in') : t('sign-in.login') }}
        </button>
      </form>

      <section v-if="feedback === 'onboarding-required' && pendingSocialOnboardingProvider" class="social-onboarding-prompt" aria-live="polite">
        <p class="form-feedback">{{ t('sign-in.onboarding.title') }}</p>
        <p class="form-feedback">{{ t('sign-in.onboarding.copy') }}</p>

        <div class="prompt-actions">
          <button class="primary-action" type="button" :disabled="signingIn" @click="continueWithSocialSignUp">
            {{ t('sign-in.onboarding.create-account') }}
          </button>

          <button class="secondary-action" type="button" :disabled="signingIn" @click="chooseAnotherSocialAccount">
            {{ t('sign-in.onboarding.choose-another-account') }}
          </button>
        </div>
      </section>

      <template v-else>
        <div class="divider" aria-hidden="true">
          <span>{{ t('sign-in.social-divider') }}</span>
        </div>

        <button class="social-action" type="button" :disabled="signingIn" @click="signInWithGoogle">
          <img class="social-icon" src="/icons/google.svg" alt="" aria-hidden="true"/>
          <span>{{ t('sign-in.continue-with-google') }}</span>
        </button>
        <button class="social-action" type="button" :disabled="signingIn" @click="signInWithApple">
          <img class="social-icon" src="/icons/apple.svg" alt="" aria-hidden="true"/>
          <span>{{ t('sign-in.continue-with-apple') }}</span>
        </button>

        <router-link class="secondary-link" to="/identity-access/sign-up">
          {{ t('sign-in.create-account') }}
        </router-link>
      </template>
    </section>
  </main>
</template>
