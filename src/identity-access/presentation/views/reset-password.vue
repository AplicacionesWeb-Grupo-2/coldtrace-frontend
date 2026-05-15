<script setup>
import {useI18n} from 'vue-i18n';

const {t} = useI18n();
</script>

<template>
  <main class="placeholder-page">
    <h1>{{ t('reset-password.title') }}</h1>
    <p>{{ t('roles-permissions.empty-section-message') }}</p>
    <router-link class="field-link" to="/identity-access/sign-in">
      {{ t('reset-password.back-to-login') }}
    </router-link>
  </main>
</template>
