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
  background: #f7f8fa;
  box-sizing: border-box;
  display: flex;
  justify-content: flex-end;
  min-height: 72px;
  padding: 14px 24px 0;
  width: 100%;
}
</style>
