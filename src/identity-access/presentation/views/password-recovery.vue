<script setup>
import {useI18n} from 'vue-i18n';

const {t} = useI18n();
</script>

<template>
  <main class="placeholder-page">
    <h1>{{ t('password-recovery.title') }}</h1>
    <p>{{ t('password-recovery.subtitle') }}</p>
    <router-link class="field-link" to="/identity-access/sign-in">
      {{ t('password-recovery.back-to-login') }}
    </router-link>
  </main>
</template>
