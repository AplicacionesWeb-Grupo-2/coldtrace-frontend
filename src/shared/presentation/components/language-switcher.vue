<script setup>
import {useI18n} from 'vue-i18n';

const {locale} = useI18n();
const options = [
    {label: 'EN', value: 'en', icon: '/icons/flag-en.svg'},
    {label: 'ES', value: 'es', icon: '/icons/flag-es.svg'},
];

/**
 * Handles set language behavior in the shared context.
 *
 * @param {string} value
 * @returns {void}
 */
function setLanguage(value) {
    locale.value = value;
}
</script>

<template>
  <div class="language-switcher" aria-label="Language selector">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :class="{active: locale === option.value}"
      @click="setLanguage(option.value)"
    >
      <img :src="option.icon" alt="" aria-hidden="true"/>
      <span>{{ option.label }}</span>
    </button>
  </div>
</template>

<style scoped>
.language-switcher {
  align-items: center;
  background: #f0f2f5;
  border: 0;
  border-radius: 32px;
  box-sizing: border-box;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  height: 54px;
  padding: 8px;
  width: 250px;
}

button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 38px;
  border: 0;
  border-radius: 24px;
  color: #9aa4b5;
  background: transparent;
  font-family: 'Inter', Arial, sans-serif;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  cursor: pointer;
  padding: 0;
  width: 100%;
}

button.active {
  color: #404040;
  background: #ffffff;
  box-shadow: 0 1px 3px rgba(96, 108, 128, 0.05), 0 6px 14px rgba(96, 108, 128, 0.12);
}

img {
  border-radius: 5px;
  display: block;
  flex: 0 0 auto;
  height: 22px;
  width: auto;
}
</style>
