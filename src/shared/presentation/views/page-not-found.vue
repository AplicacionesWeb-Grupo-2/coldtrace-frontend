<script setup>
import {useI18n} from 'vue-i18n';
import {useRoute} from 'vue-router';

const {t} = useI18n();
const route = useRoute();
</script>

<template>
  <main class="not-found-page">
    <h1>{{ t('page-not-found.title') }}</h1>
    <p>{{ t('page-not-found.content', {invalid_path: route.fullPath}) }}</p>
    <router-link class="field-link" to="/identity-access/sign-in">
      {{ t('page-not-found.go-home') }}
    </router-link>
  </main>
</template>
