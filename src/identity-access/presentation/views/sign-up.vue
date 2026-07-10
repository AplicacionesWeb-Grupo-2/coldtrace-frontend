<script setup>
import {computed, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRoute, useRouter} from 'vue-router';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import {AppleIdentityService} from '@/identity-access/infrastructure/apple-identity.js';
import {GoogleIdentityService} from '@/identity-access/infrastructure/google-identity.js';

const {t} = useI18n();
const route = useRoute();
const router = useRouter();
const store = useIdentityAccessStore();
const appleIdentity = new AppleIdentityService();
const googleIdentity = new GoogleIdentityService();
const form = ref({
    organizationName: '',
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    acceptedTerms: true,
});
const socialForm = ref({
    organizationName: '',
    fullName: '',
    acceptedTerms: true,
});
const submitted = ref(false);
const socialSubmitted = ref(false);
const creating = ref(false);
const socialCreating = ref(false);
const passwordVisible = ref(false);
const feedback = ref('idle');
const pendingSocialCredential = ref(null);
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const organizationNameInvalid = computed(() => form.value.organizationName.trim().length < 2);
const fullNameInvalid = computed(() => form.value.fullName.trim().length < 3);
const emailInvalid = computed(() => !emailPattern.test(form.value.email.trim()));
const passwordInvalid = computed(() => form.value.password.length < 8);
const passwordMismatch = computed(() => form.value.password !== form.value.confirmPassword);
const selectedPlanCode = computed(() => String(route.query.plan ?? '').trim().toLowerCase());
const socialOrganizationNameInvalid = computed(() => socialForm.value.organizationName.trim().length < 2);
const socialFullNameInvalid = computed(() => socialForm.value.fullName.trim().length < 3);

restoreSocialSignUpFromNavigation();

/**
 * Handles submit behavior in the identity access context.
 *
 * @returns {Promise<*>}
 */
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
            await router.push(targetRouteFromSignUp());
        }
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        creating.value = false;
    }
}

/**
 * Submits the reduced social organization sign-up form.
 *
 * @returns {Promise<void>}
 */
async function submitSocialSignUp() {
    socialSubmitted.value = true;
    feedback.value = 'idle';

    const credential = pendingSocialCredential.value;
    if (!credential || (!credential.idToken && !credential.authorizationCode)) {
        feedback.value = 'social-unavailable';
        return;
    }

    if (socialOrganizationNameInvalid.value || socialFullNameInvalid.value || !socialForm.value.acceptedTerms) {
        return;
    }

    socialCreating.value = true;
    try {
        const result = await store.createSocialAccount(credential.provider, credential, socialForm.value);
        feedback.value = result.status;
        if (result.status === 'success') {
            pendingSocialCredential.value = null;
            socialSubmitted.value = false;
            socialForm.value = {
                organizationName: '',
                fullName: '',
                acceptedTerms: true,
            };
            await router.push(targetRouteFromSignUp());
        }
    } catch {
        feedback.value = 'server-error';
    } finally {
        socialCreating.value = false;
    }
}

/**
 * Starts Google sign-up.
 *
 * @returns {Promise<void>}
 */
async function signUpWithGoogle() {
    await startSocialSignUp('google');
}

/**
 * Starts Apple sign-up.
 *
 * @returns {Promise<void>}
 */
async function signUpWithApple() {
    await startSocialSignUp('apple');
}

/**
 * Cancels social sign-up and returns to email/password registration.
 *
 * @returns {void}
 */
function cancelSocialSignUp() {
    pendingSocialCredential.value = null;
    socialSubmitted.value = false;
    feedback.value = 'idle';
    socialForm.value = {
        organizationName: '',
        fullName: '',
        acceptedTerms: true,
    };
}

/**
 * Determines whether a social form field is invalid.
 *
 * @param {string} field
 * @returns {boolean}
 */
function hasSocialControlError(field) {
    if (!socialSubmitted.value) return false;
    if (field === 'organizationName') return socialOrganizationNameInvalid.value;
    if (field === 'fullName') return socialFullNameInvalid.value;
    return false;
}

/**
 * Starts a provider sign-up flow.
 *
 * @param {'google'|'apple'} provider
 * @returns {Promise<void>}
 */
async function startSocialSignUp(provider) {
    feedback.value = 'idle';

    try {
        creating.value = true;
        const credential = provider === 'google'
            ? await googleIdentity.signIn()
            : await appleIdentity.signIn();

        if (provider === 'google') {
            await startGoogleSignUp(credential);
            return;
        }

        startAppleSignUp(credential);
    } catch {
        feedback.value = 'social-unavailable';
    } finally {
        creating.value = false;
    }
}

/**
 * Opens Google social sign-up after backend profile preview.
 *
 * @param {*} credential
 * @returns {Promise<void>}
 */
async function startGoogleSignUp(credential) {
    try {
        const profile = await store.previewSocialIdentityProfile('google', credential);
        const email = profile.email.trim().toLowerCase();
        const fullName = profile.fullName.trim() || suggestNameFromEmail(email);

        pendingSocialCredential.value = {
            provider: 'google',
            idToken: profile.idToken || credential.idToken,
            ...(credential.nonce ? {nonce: credential.nonce} : {}),
            ...(email ? {email} : {}),
        };
        socialSubmitted.value = false;
        feedback.value = 'idle';
        socialForm.value = {
            organizationName: '',
            fullName,
            acceptedTerms: true,
        };
    } catch (error) {
        feedback.value = socialFeedbackFromError(error);
    }
}

/**
 * Opens Apple social sign-up using the provider profile or ID token claims.
 *
 * @param {*} credential
 * @returns {void}
 */
function startAppleSignUp(credential) {
    const profile = appleSocialProfileFrom(credential);

    if (!profile.email) {
        feedback.value = 'social-invalid';
        return;
    }

    pendingSocialCredential.value = {
        provider: 'apple',
        ...(credential.idToken ? {idToken: credential.idToken} : {}),
        ...(credential.authorizationCode ? {authorizationCode: credential.authorizationCode} : {}),
        ...(credential.redirectUri ? {redirectUri: credential.redirectUri} : {}),
        ...(credential.nonce ? {nonce: credential.nonce} : {}),
        email: profile.email,
    };
    socialSubmitted.value = false;
    feedback.value = 'idle';
    socialForm.value = {
        organizationName: '',
        fullName: profile.fullName,
        acceptedTerms: true,
    };
}

/**
 * Restores social sign-up passed from sign-in onboarding.
 *
 * @returns {void}
 */
function restoreSocialSignUpFromNavigation() {
    const socialSignUp = window.history.state?.socialSignUp;
    if (!socialSignUp?.provider || !hasSocialAuthorization(socialSignUp.credential)) return;

    if (socialSignUp.provider === 'google') {
        void startGoogleSignUp(socialSignUp.credential);
        clearSocialSignUpNavigationState();
        return;
    }

    if (socialSignUp.provider === 'apple') {
        startAppleSignUp(socialSignUp.credential);
        clearSocialSignUpNavigationState();
    }
}

/**
 * Determines whether a provider credential has an exchange token.
 *
 * @param {*} credential
 * @returns {boolean}
 */
function hasSocialAuthorization(credential) {
    return Boolean(credential?.idToken || credential?.authorizationCode);
}

/**
 * Clears provider credentials from browser history state.
 *
 * @returns {void}
 */
function clearSocialSignUpNavigationState() {
    const historyState = {...window.history.state};
    delete historyState.socialSignUp;
    window.history.replaceState(historyState, '');
}

/**
 * Resolves the target route after sign-up.
 *
 * @returns {*}
 */
function targetRouteFromSignUp() {
    return selectedPlanCode.value
        ? {name: 'identity-access-billing', query: {plan: selectedPlanCode.value}}
        : {
            name: 'identity-access-dashboard',
            query: {
                organizationId: store.currentUser?.organizationId,
                userId: store.currentUser?.id,
            },
        };
}

/**
 * Builds Apple profile data from provider response and ID token claims.
 *
 * @param {*} credential
 * @returns {{email: string, fullName: string}}
 */
function appleSocialProfileFrom(credential) {
    const tokenProfile = credential.idToken
        ? socialProfileFromIdToken(credential.idToken)
        : {email: '', fullName: ''};
    const email = (credential.email || tokenProfile.email).trim().toLowerCase();
    const fullName = credential.fullName || tokenProfile.fullName || suggestNameFromEmail(email);

    return {email, fullName};
}

/**
 * Extracts profile data from an ID token.
 *
 * @param {string} idToken
 * @returns {{email: string, fullName: string}}
 */
function socialProfileFromIdToken(idToken) {
    try {
        const claims = decodeJwtPayload(idToken);
        const email = textClaim(claims, 'email').toLowerCase();
        const fullName = textClaim(claims, 'name') ||
            [textClaim(claims, 'given_name'), textClaim(claims, 'family_name')]
                .filter(Boolean)
                .join(' ') ||
            suggestNameFromEmail(email);

        return {email, fullName};
    } catch {
        return {email: '', fullName: ''};
    }
}

/**
 * Decodes a JWT payload.
 *
 * @param {string} idToken
 * @returns {*}
 */
function decodeJwtPayload(idToken) {
    const payload = idToken.split('.')[1];
    if (!payload) throw new Error('invalid-id-token');

    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
}

/**
 * Reads a text claim.
 *
 * @param {*} claims
 * @param {string} key
 * @returns {string}
 */
function textClaim(claims, key) {
    const value = claims[key];
    return typeof value === 'string' ? value.trim() : '';
}

/**
 * Suggests a display name from an email local part.
 *
 * @param {string} email
 * @returns {string}
 */
function suggestNameFromEmail(email) {
    const localPart = email.split('@')[0] ?? '';
    return localPart
        .replace(/[._-]+/g, ' ')
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

/**
 * Maps social preview errors to UI feedback.
 *
 * @param {*} error
 * @returns {string}
 */
function socialFeedbackFromError(error) {
    const code = error?.response?.data?.code ?? error?.response?.data?.Code;
    if (error?.response?.status === 401 || code === 'PROVIDER_VALIDATION_FAILED') return 'social-invalid';
    if (error?.response?.status === 503 || code === 'SOCIAL_PROVIDER_CONFIGURATION_MISSING') return 'social-unavailable';
    return 'server-error';
}
</script>

<template>
  <main class="auth-page sign-up-page">
    <section class="auth-panel" aria-labelledby="sign-up-title">
      <img class="brand-logo" src="/coldtrace-logo.svg" alt="ColdTrace"/>

      <form
        v-if="pendingSocialCredential"
        class="sign-up-form"
        @submit.prevent="submitSocialSignUp"
        novalidate
      >
        <h1 id="sign-up-title" class="screen-title">{{ t('sign-up.social-title') }}</h1>

        <div class="social-account">
          <span class="account-provider">
            {{ t(pendingSocialCredential.provider === 'google' ? 'sign-up.google-account' : 'sign-up.apple-account') }}
          </span>
          <span v-if="pendingSocialCredential.email" class="account-email">{{ pendingSocialCredential.email }}</span>
        </div>

        <div class="field-group">
          <label for="social-organization-name">{{ t('sign-up.organization-name') }}</label>
          <input
            id="social-organization-name"
            v-model="socialForm.organizationName"
            type="text"
            :placeholder="t('sign-up.organization-name-placeholder')"
          />
          <p v-if="hasSocialControlError('organizationName')" class="field-error">
            {{ t('sign-up.error.organization-name-required') }}
          </p>
        </div>

        <div class="field-group">
          <label for="social-full-name">{{ t('sign-up.full-name') }}</label>
          <input
            id="social-full-name"
            v-model="socialForm.fullName"
            type="text"
            :placeholder="t('sign-up.full-name-placeholder')"
            autocomplete="name"
          />
          <p v-if="hasSocialControlError('fullName')" class="field-error">
            {{ t('sign-up.error.full-name-required') }}
          </p>
        </div>

        <label class="check-row">
          <input v-model="socialForm.acceptedTerms" type="checkbox"/>
          <span>{{ t('sign-up.accept-terms') }}</span>
        </label>

        <p v-if="feedback === 'duplicate-email'" class="form-feedback error">
          {{ t('sign-up.error.duplicate-email') }}
        </p>
        <p v-if="feedback === 'social-invalid'" class="form-feedback error">
          {{ t('sign-up.error.social-invalid') }}
        </p>
        <p v-if="feedback === 'social-unavailable'" class="form-feedback error">
          {{ t('sign-up.error.social-unavailable') }}
        </p>
        <p v-if="feedback === 'server-error'" class="form-feedback error">
          {{ t('sign-up.error.server-error') }}
        </p>

        <button class="primary-action" type="submit" :disabled="socialCreating">
          {{ socialCreating ? t('sign-up.creating') : t('sign-up.create') }}
        </button>

        <button class="secondary-action" type="button" :disabled="socialCreating" @click="cancelSocialSignUp">
          {{ t('sign-up.use-another-method') }}
        </button>
      </form>

      <template v-else>
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
                placeholder="••••••••••••"
                autocomplete="new-password"
              />
              <button
                type="button"
                class="icon-button"
                :aria-label="t('sign-up.toggle-password-visibility')"
                @click="passwordVisible = !passwordVisible"
              >
                <span class="material-icons" aria-hidden="true">
                  {{ passwordVisible ? 'visibility_off' : 'visibility' }}
                </span>
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
              placeholder="••••••••••••"
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

        <button class="social-action" type="button" :disabled="creating" @click="signUpWithGoogle">
          <img class="social-icon" src="/icons/google.svg" alt="" aria-hidden="true"/>
          <span>{{ t('sign-up.continue-with-google') }}</span>
        </button>
        <button class="social-action" type="button" :disabled="creating" @click="signUpWithApple">
          <img class="social-icon" src="/icons/apple.svg" alt="" aria-hidden="true"/>
          <span>{{ t('sign-up.continue-with-apple') }}</span>
        </button>

        <p v-if="feedback === 'social-invalid'" class="form-feedback error">
          {{ t('sign-up.error.social-invalid') }}
        </p>
        <p v-if="feedback === 'social-unavailable'" class="form-feedback error">
          {{ t('sign-up.error.social-unavailable') }}
        </p>

        <router-link class="secondary-link" to="/identity-access/sign-in">
          {{ t('sign-up.already-have-account') }}
        </router-link>
      </template>
    </section>
  </main>
</template>
