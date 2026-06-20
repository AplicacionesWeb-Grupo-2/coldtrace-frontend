<script setup>
import {ref} from 'vue';
import {useI18n} from 'vue-i18n';

const {locale, t} = useI18n();
const menuOpen = ref(false);
const options = [
    {label: 'EN', value: 'en', icon: '/icons/flag-en.svg', ariaLabelKey: 'language-switcher.english'},
    {label: 'ES', value: 'es', icon: '/icons/flag-es.svg', ariaLabelKey: 'language-switcher.spanish'},
];

/**
 * Handles set language behavior in the shared context.
 *
 * @param {string} value
 * @returns {void}
 */
function setLanguage(value) {
    locale.value = value;
    menuOpen.value = false;
}

/**
 * Toggles the compact language menu used by auth pages.
 *
 * @returns {void}
 */
function toggleMenu() {
    menuOpen.value = !menuOpen.value;
}
</script>

<template>
  <button
    class="language-menu-trigger"
    type="button"
    :aria-label="t('language-switcher.open')"
    :aria-expanded="menuOpen"
    @click="toggleMenu"
  >
    <span class="material-icons" aria-hidden="true">language</span>
  </button>

  <div class="language-switcher" :class="{'menu-open': menuOpen}" :aria-label="t('language-switcher.selector')">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-label="t(option.ariaLabelKey)"
      :class="{active: locale === option.value}"
      @click="setLanguage(option.value)"
    >
      <span class="language-option">
        <img class="language-flag" :src="option.icon" alt="" aria-hidden="true"/>
        <span>{{ option.label }}</span>
      </span>
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
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 24px;
  color: #9aa4b5;
  display: inline-flex;
  font-family: 'Inter', Arial, sans-serif;
  font-size: 10px;
  font-weight: 700;
  height: 38px;
  justify-content: center;
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

.language-option {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: center;
  min-width: 0;
  width: 100%;
}

.language-flag {
  border-radius: 5px;
  display: block;
  flex: 0 0 auto;
  height: 22px;
  width: auto;
}

.language-menu-trigger {
  display: none;
}
</style>
