<script setup>
import {computed} from 'vue';
import {useRoute} from 'vue-router';
import DashboardShell from '@/shared/presentation/components/dashboard-shell.vue';
import LanguageSwitcher from '@/shared/presentation/components/language-switcher.vue';

const route = useRoute();
const dashboardRoutePaths = [
    '/identity-access/dashboard',
    '/identity-access/users',
    '/identity-access/roles-permissions',
    '/asset-management',
    '/maintenance',
    '/alerts',
    '/monitoring',
    '/reports',
];
const showDashboardShell = computed(() => dashboardRoutePaths.some(path => route.path.includes(path)));
const showLanguageSwitcher = computed(() => !showDashboardShell.value);
</script>

<template>
  <pv-toast/>
  <pv-confirm-dialog/>
  <div class="page-shell">
    <div v-if="showLanguageSwitcher" class="language-switcher-bar">
      <language-switcher/>
    </div>
    <dashboard-shell v-if="showDashboardShell">
      <router-view/>
    </dashboard-shell>
    <router-view v-else/>
  </div>
</template>

<style scoped>
.language-switcher-bar {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 0;
  box-sizing: border-box;
  box-shadow: none;
  display: flex;
  height: 74px;
  justify-content: flex-end;
  min-height: 0;
  padding: 20px 28px 0;
  pointer-events: none;
  position: fixed;
  right: 0;
  top: 0;
  width: 100%;
  z-index: 10;
}

.language-switcher-bar :deep(.language-menu-trigger) {
  align-items: center;
  background: #fff;
  border: 1px solid #e4e7ec;
  border-radius: 999px;
  box-shadow: 0 3px 10px rgba(15, 23, 42, 0.06);
  color: #667085;
  cursor: pointer;
  display: flex;
  height: 44px;
  justify-content: center;
  padding: 0;
  pointer-events: auto;
  position: absolute;
  right: 27px;
  top: 24px;
  transition: opacity 0.14s ease, transform 0.16s ease;
  width: 44px;
  z-index: 1;
}

.language-switcher-bar :deep(.language-menu-trigger .material-icons) {
  font-size: 22px;
}

.language-switcher-bar:hover :deep(.language-menu-trigger),
.language-switcher-bar:focus-within :deep(.language-menu-trigger),
.language-switcher-bar :deep(.language-menu-trigger[aria-expanded='true']) {
  opacity: 0;
  pointer-events: none;
  transform: scale(0.86);
}

.language-switcher-bar :deep(.language-switcher) {
  opacity: 0;
  pointer-events: none;
  position: absolute;
  right: 27px;
  top: 19px;
  transform: scaleX(0.18);
  transform-origin: center right;
  transition: opacity 0.16s ease, transform 0.2s ease;
}

.language-switcher-bar :deep(.language-switcher *) {
  pointer-events: none;
}

.language-switcher-bar:hover :deep(.language-switcher),
.language-switcher-bar:focus-within :deep(.language-switcher),
.language-switcher-bar :deep(.language-switcher.menu-open) {
  opacity: 1;
  pointer-events: auto;
  transform: scaleX(1);
}

.language-switcher-bar:hover :deep(.language-switcher *),
.language-switcher-bar:focus-within :deep(.language-switcher *),
.language-switcher-bar :deep(.language-switcher.menu-open *) {
  pointer-events: auto;
}
</style>
