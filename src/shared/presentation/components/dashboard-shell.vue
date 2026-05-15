<script setup>
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRoute, useRouter} from 'vue-router';
import useAlertsStore from '@/alerts/application/alerts.store.js';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import useMonitoringStore from '@/monitoring/application/monitoring.store.js';
import useReportsStore from '@/reports/application/reports.store.js';
import LanguageSwitcher from '@/shared/presentation/components/language-switcher.vue';

const telemetryPollingIntervalMs = 12000;

const {t} = useI18n();
const route = useRoute();
const router = useRouter();
const store = useIdentityAccessStore();
const alertsStore = useAlertsStore();
const assetManagementStore = useAssetManagementStore();
const monitoringStore = useMonitoringStore();
const reportsStore = useReportsStore();
const accessDropdownOpen = ref(false);
const accessDropdownTouched = ref(false);
const reportsDropdownOpen = ref(false);
const reportsDropdownTouched = ref(false);
const settingsDropdownOpen = ref(false);
const settingsDropdownTouched = ref(false);
let telemetryIntervalId = null;

onMounted(() => {
    loadShellData();
    startTelemetryUpdates();
});

onBeforeUnmount(() => {
    if (telemetryIntervalId !== null) {
        window.clearInterval(telemetryIntervalId);
        telemetryIntervalId = null;
    }
});

const activeOrganizationId = computed(() => store.currentOrganizationIdFrom());
const activeOrganizationName = computed(() => store.currentOrganizationNameFrom());
const profileUserName = computed(() => store.currentUserNameFrom());
const profileRoleLabelKey = computed(() => store.currentRoleLabelKeyFrom());
const canManageAccess = computed(() => store.canManageRolePermissions());
const canManageUsers = computed(() => store.canManageUsers());
const canMonitorAssets = computed(() => store.canMonitorAssets());
const currentRole = computed(() => store.currentRoleFrom());
const canDownloadReports = computed(() =>
    store
        .permissionKeysForRole(currentRole.value)
        .includes('roles-permissions.permissions.view-reports'),
);
const assetIssuesCount = computed(() => assetManagementStore.assetIssueCountFor(activeOrganizationId.value));
const pendingAlertsCount = computed(() => alertsStore.openIncidentsCount);

const isAccessRoute = computed(() =>
    route.path.includes('/identity-access/users') || route.path.includes('/identity-access/roles-permissions'),
);
const isReportsRoute = computed(() =>
    route.path.includes('/reports') || route.path.includes('/identity-access/reports'),
);
const isSettingsRoute = computed(() =>
    route.path.includes('/asset-management/safety-ranges') ||
    route.path.includes('/asset-management/operational-parameters') ||
    route.path.includes('/maintenance'),
);
const isAccessDropdownOpen = computed(() => accessDropdownTouched.value ? accessDropdownOpen.value : isAccessRoute.value);
const isReportsDropdownOpen = computed(() => reportsDropdownTouched.value ? reportsDropdownOpen.value : isReportsRoute.value);
const isSettingsDropdownOpen = computed(() => settingsDropdownTouched.value ? settingsDropdownOpen.value : isSettingsRoute.value);

function toggleAccessDropdown() {
    accessDropdownOpen.value = !isAccessDropdownOpen.value;
    accessDropdownTouched.value = true;
}

function toggleReportsDropdown() {
    reportsDropdownOpen.value = !isReportsDropdownOpen.value;
    reportsDropdownTouched.value = true;
}

function toggleSettingsDropdown() {
    settingsDropdownOpen.value = !isSettingsDropdownOpen.value;
    settingsDropdownTouched.value = true;
}

function logout() {
    store.clearCurrentUser();
    router.push('/identity-access/sign-in');
}

async function loadShellData() {
    try {
        await Promise.all([
            store.fetchAccessData(),
            assetManagementStore.fetchAssetManagementData({includeSettings: true}),
            monitoringStore.fetchMonitoringData({includeDependencies: false}),
            alertsStore.loadIncidents({silent: true}),
            reportsStore.fetchReports(),
        ]);
    } catch {
        // Keep the shell usable when the local data service is unavailable.
    }
}

function startTelemetryUpdates() {
    telemetryIntervalId = window.setInterval(() => {
        assetManagementStore.updateOrganizationTelemetry(activeOrganizationId.value);
        alertsStore.loadIncidents({silent: true}).catch(() => {});
    }, telemetryPollingIntervalMs);
}

async function downloadCurrentMonthReport() {
    if (!canDownloadReports.value) {
        await router.push('/reports/monthly');
        return;
    }

    try {
        await Promise.all([
            assetManagementStore.fetchAssetManagementData({includeSettings: false}),
            monitoringStore.fetchMonitoringData({includeDependencies: false}),
            reportsStore.fetchReports(),
        ]);

        const month = reportsStore.currentDate().slice(0, 7);
        const monthlyReport = reportsStore.buildMonthlyReport(activeOrganizationId.value, month);

        if (!monthlyReport.canDownload) {
            await router.push('/reports/monthly');
            return;
        }

        await reportsStore.createMonthlySummaryReport(activeOrganizationId.value, monthlyReport);
        downloadMonthlyCsv(monthlyReport);
    } catch {
        await router.push('/reports/monthly');
    }
}

function downloadMonthlyCsv(monthlyReport) {
    const blob = new Blob([reportsStore.monthlyReportCsv(monthlyReport)], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileNamePart(activeOrganizationName.value)}-monthly-report-${monthlyReport.month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function fileNamePart(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'organization';
}
</script>

<template>
  <main class="access-page">
    <aside class="side-panel">
      <div class="sidebar-top">
        <div class="brand-section">
          <img src="/coldtrace-icon.png" alt="ColdTrace" class="logo-img"/>
          <div class="brand-text">
            <span class="brand-name">ColdTrace</span>
            <span class="brand-sub">{{ activeOrganizationName }}</span>
          </div>
        </div>

        <nav class="side-menu">
          <router-link class="menu-item" to="/identity-access/dashboard" active-class="active">
            <span class="material-icons menu-icon">dashboard</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-main') }}</span>
          </router-link>

          <router-link class="menu-item" to="/asset-management/assets" active-class="active">
            <span class="material-icons menu-icon">inventory_2</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-assets') }}</span>
            <span v-if="assetIssuesCount > 0" class="counter badge-red">{{ assetIssuesCount }}</span>
          </router-link>

          <router-link v-if="canMonitorAssets" class="menu-item" to="/monitoring/assets" active-class="active">
            <span class="material-icons menu-icon">sensors</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-monitoring') }}</span>
          </router-link>

          <router-link class="menu-item" to="/alerts/incidents" active-class="active">
            <span class="material-icons menu-icon">warning</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-alerts') }}</span>
            <span v-if="pendingAlertsCount > 0" class="counter badge-red">{{ pendingAlertsCount }}</span>
          </router-link>

          <div class="menu-group" :class="{open: isAccessDropdownOpen, 'active-group': isAccessRoute}">
            <button
              class="menu-item menu-trigger"
              type="button"
              :aria-expanded="isAccessDropdownOpen"
              @click="toggleAccessDropdown"
            >
              <span class="material-icons menu-icon">admin_panel_settings</span>
              <span class="menu-label">{{ t('dashboard-shell.nav-access') }}</span>
              <span class="material-icons dropdown-icon">expand_more</span>
            </button>
            <div v-if="isAccessDropdownOpen" class="sub-menu" aria-label="Access navigation">
              <router-link class="sub-menu-link" to="/identity-access/users" active-class="active">
                {{ t('dashboard-shell.nav-users') }}
              </router-link>
              <router-link v-if="canManageUsers" class="sub-menu-link" to="/identity-access/roles-permissions/users/new" active-class="active">
                {{ t('dashboard-shell.nav-new-user') }}
              </router-link>
              <router-link v-if="canManageAccess" class="sub-menu-link" to="/identity-access/roles-permissions/permissions" active-class="active">
                {{ t('dashboard-shell.nav-permissions') }}
              </router-link>
            </div>
          </div>

          <div class="menu-group" :class="{open: isSettingsDropdownOpen, 'active-group': isSettingsRoute}">
            <button
              class="menu-item menu-trigger"
              type="button"
              :aria-expanded="isSettingsDropdownOpen"
              @click="toggleSettingsDropdown"
            >
              <span class="material-icons menu-icon">settings</span>
              <span class="menu-label">{{ t('dashboard-shell.nav-settings') }}</span>
              <span class="material-icons dropdown-icon">expand_more</span>
            </button>
            <div v-if="isSettingsDropdownOpen" class="sub-menu" aria-label="Settings navigation">
              <router-link class="sub-menu-link" to="/asset-management/safety-ranges" active-class="active">
                {{ t('dashboard-shell.nav-safety-ranges') }}
              </router-link>
              <router-link class="sub-menu-link" to="/asset-management/operational-parameters" active-class="active">
                {{ t('dashboard-shell.nav-operational-parameters') }}
              </router-link>
              <router-link class="sub-menu-link" to="/maintenance/preventive" active-class="active">
                {{ t('dashboard-shell.nav-preventive-maintenance') }}
              </router-link>
              <router-link class="sub-menu-link" to="/maintenance/technical-service" active-class="active">
                {{ t('dashboard-shell.nav-technical-service') }}
              </router-link>
            </div>
          </div>

          <div class="menu-group" :class="{open: isReportsDropdownOpen, 'active-group': isReportsRoute}">
            <button
              class="menu-item menu-trigger"
              type="button"
              :aria-expanded="isReportsDropdownOpen"
              @click="toggleReportsDropdown"
            >
              <span class="material-icons menu-icon">description</span>
              <span class="menu-label">{{ t('dashboard-shell.nav-reports') }}</span>
              <span class="material-icons dropdown-icon">expand_more</span>
            </button>
            <div v-if="isReportsDropdownOpen" class="sub-menu" aria-label="Reports navigation">
              <router-link class="sub-menu-link" to="/reports/daily-log" active-class="active">
                {{ t('dashboard-shell.nav-daily-log') }}
              </router-link>
              <router-link class="sub-menu-link" to="/reports/monthly" active-class="active">
                {{ t('dashboard-shell.nav-monthly-report') }}
              </router-link>
              <router-link class="sub-menu-link" to="/reports/history" active-class="active">
                {{ t('dashboard-shell.nav-history') }}
              </router-link>
              <router-link class="sub-menu-link" to="/reports/compliance" active-class="active">
                {{ t('dashboard-shell.nav-compliance') }}
              </router-link>
              <router-link class="sub-menu-link" to="/reports/findings" active-class="active">
                {{ t('dashboard-shell.nav-findings') }}
              </router-link>
              <router-link class="sub-menu-link" to="/reports/audit-evidence" active-class="active">
                {{ t('dashboard-shell.nav-audit-evidence') }}
              </router-link>
            </div>
          </div>

          <router-link class="menu-item" to="/alerts/notifications" active-class="active">
            <span class="material-icons menu-icon">notifications</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-notifications') }}</span>
            <span v-if="pendingAlertsCount > 0" class="counter badge-red">{{ pendingAlertsCount }}</span>
          </router-link>
        </nav>
      </div>

      <div class="sidebar-footer">
        <language-switcher/>

        <button class="drag-upload" type="button" @click="downloadCurrentMonthReport">
          <span class="material-icons upload-icon">download</span>
          <span class="upload-text">{{ t('dashboard-shell.download-report') }}</span>
        </button>

        <div class="toggle-control theme-toggle">
          <div class="toggle-option active">
            <span class="material-icons">light_mode</span>
            <span>{{ t('dashboard-shell.theme-light') }}</span>
          </div>
          <div class="toggle-option">
            <span class="material-icons">dark_mode</span>
            <span>{{ t('dashboard-shell.theme-dark') }}</span>
          </div>
        </div>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <router-link
          v-if="pendingAlertsCount > 0"
          class="notification-shortcut"
          to="/alerts/notifications"
          :aria-label="t('dashboard-shell.notification-shortcut', {count: pendingAlertsCount})"
        >
          <span class="material-icons">notifications_active</span>
          <span>{{ t('dashboard-shell.notification-shortcut', {count: pendingAlertsCount}) }}</span>
        </router-link>

        <div class="user-profile">
          <div class="avatar-wrapper">
            <div class="avatar-container">
              <span class="material-icons avatar-placeholder">person</span>
            </div>
            <span class="profile-status"></span>
          </div>
          <div class="profile-meta">
            <span class="name">{{ profileUserName }}</span>
            <span class="role">{{ t(profileRoleLabelKey) }}</span>
          </div>
          <div class="user-actions">
            <button type="button" aria-label="Settings"><span class="material-icons">settings</span></button>
            <button type="button" aria-label="Logout" @click="logout"><span class="material-icons">logout</span></button>
          </div>
        </div>
      </header>

      <div class="content-scroll">
        <slot/>
      </div>
    </section>
  </main>
</template>

<style scoped>
.access-page {
  background: #f5f6f8;
  display: grid;
  font-family: 'Inter', sans-serif;
  grid-template-columns: 318px 1fr;
  height: 100vh;
  overflow: hidden;
}

.side-panel {
  background: transparent;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  height: 100vh;
  justify-content: space-between;
  overflow-x: hidden;
  overflow-y: auto;
  padding: 28px 0 24px;
}

.side-panel::-webkit-scrollbar {
  width: 0;
}

.brand-section {
  align-items: center;
  display: flex;
  gap: 12px;
  margin-bottom: 50px;
  padding: 0 36px;
}

.logo-img {
  height: 46px;
  width: auto;
}

.brand-text {
  display: flex;
  flex-direction: column;
}

.brand-name {
  color: #1a1a1a;
  display: block;
  font-size: 18px;
  font-weight: 800;
  line-height: 1.05;
}

.brand-sub {
  color: #9aa4b5;
  font-size: 12px;
  font-weight: 700;
}

.side-menu {
  display: flex;
  flex-direction: column;
  gap: 9px;
  margin-bottom: 34px;
}

.menu-item {
  align-items: center;
  background: transparent;
  border: 0;
  box-sizing: border-box;
  color: #606c80;
  cursor: pointer;
  display: flex;
  gap: 26px;
  padding: 12px 38px;
  text-decoration: none;
  transition: background 0.15s;
  width: 100%;
}

.menu-item .menu-icon {
  color: #dadee6;
  font-size: 24px;
  height: 24px;
  line-height: 24px;
  width: 24px;
}

.menu-label {
  flex: 1;
  font-size: 13.5px;
  font-weight: 700;
  text-align: left;
}

.menu-item.active,
.menu-group.open > .menu-item,
.menu-group.active-group > .menu-item {
  color: #2563eb;
}

.menu-item.active .menu-icon,
.menu-group.open > .menu-item .menu-icon,
.menu-group.active-group > .menu-item .menu-icon {
  color: #2563eb;
}

.menu-item:hover {
  background: rgba(37, 99, 235, 0.04);
}

.menu-group {
  display: flex;
  flex-direction: column;
}

.menu-trigger {
  font-family: inherit;
}

.dropdown-icon {
  color: #c8ced9;
  font-size: 20px;
  height: 20px;
  margin-left: auto;
  transition: transform 0.15s, color 0.15s;
  width: 20px;
}

.menu-group.open .dropdown-icon,
.menu-group.active-group .dropdown-icon {
  color: #2563eb;
  transform: rotate(180deg);
}

.sub-menu {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 38px 8px 88px;
}

.sub-menu-link {
  color: #9aa4b5;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  text-decoration: none;
}

.sub-menu-link.active,
.sub-menu-link:hover {
  color: #2563eb;
}

.counter {
  border-radius: 12px;
  font-size: 10px;
  font-weight: 800;
  padding: 4px 8px;
}

.badge-red {
  background: #fee2e2;
  color: #ef4444;
}

.sidebar-footer {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 0 24px;
}

:deep(.language-switcher) {
  width: 100%;
}

.drag-upload {
  align-items: center;
  appearance: none;
  background: #f8fafc;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  box-sizing: border-box;
  color: #2563eb;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  gap: 10px;
  height: 154px;
  justify-content: center;
  padding: 24px 20px;
  text-align: center;
  text-decoration: none;
  width: 100%;
}

.upload-icon {
  font-size: 32px;
  height: 32px;
  line-height: 32px;
  width: 32px;
}

.toggle-control {
  background: #eef1f5;
  border-radius: 32px;
  display: flex;
  gap: 0;
  height: 46px;
  padding: 4px;
  position: relative;
}

.toggle-option {
  align-items: center;
  border-radius: 24px;
  color: #9aa4b5;
  cursor: pointer;
  display: flex;
  flex: 1;
  font-size: 10.5px;
  font-weight: 700;
  gap: 8px;
  justify-content: center;
  min-height: 34px;
  padding: 5px 12px;
  position: relative;
  transition: all 0.2s;
}

.toggle-option.active {
  background: #fff;
  box-shadow: inset 0 2px 5px rgba(15, 23, 42, 0.08), 0 2px 8px rgba(96, 108, 128, 0.1);
  color: #1a1a1a;
}

.workspace {
  display: flex;
  flex-direction: column;
  height: 100vh;
  min-width: 0;
  overflow: hidden;
}

.topbar {
  align-items: center;
  background: #f5f6f8;
  display: flex;
  flex-shrink: 0;
  gap: 16px;
  height: 82px;
  justify-content: flex-end;
  padding: 10px 34px 0;
}

.notification-shortcut {
  align-items: center;
  background: #fff1f2;
  border: 1px solid #fecdd3;
  border-radius: 8px;
  box-shadow: 0 8px 18px rgba(225, 29, 72, 0.08);
  color: #be123c;
  display: flex;
  font-size: 12px;
  font-weight: 800;
  gap: 8px;
  max-width: min(320px, 42vw);
  min-height: 40px;
  padding: 0 12px;
  text-decoration: none;
}

.notification-shortcut:hover {
  background: #ffe4e6;
}

.notification-shortcut .material-icons {
  color: #e11d48;
  font-size: 20px;
  height: 20px;
  line-height: 20px;
  width: 20px;
}

.notification-shortcut span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-profile {
  align-items: center;
  align-self: center;
  display: flex;
  gap: 12px;
  padding-top: 0;
}

.profile-meta {
  min-width: 92px;
  text-align: left;
}

.name {
  color: #294566;
  display: block;
  font-size: 12px;
  font-weight: 800;
}

.role {
  color: #a3b6cc;
  font-size: 10px;
  font-weight: 700;
}

.avatar-wrapper {
  align-items: center;
  display: flex;
  height: 44px;
  justify-content: center;
  position: relative;
  width: 44px;
}

.avatar-container {
  align-items: center;
  background: #f3f4f6;
  border: 3px solid #e6ebf2;
  border-radius: 50%;
  display: flex;
  height: 40px;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 40px;
}

.profile-status {
  background: #22c55e;
  border: 2px solid #ffffff;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  height: 10px;
  max-width: 10px;
  position: absolute;
  right: 2px;
  top: 2px;
  width: 100%;
  z-index: 5;
}

.avatar-placeholder {
  color: #b8bfcc;
  font-size: 24px;
  height: 24px;
  line-height: 24px;
  width: 24px;
}

.user-actions {
  align-items: center;
  color: #9aa4b5;
  display: flex;
  gap: 8px;
  margin-left: 12px;
}

.user-actions button {
  align-items: center;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: flex;
  height: 32px;
  justify-content: center;
  padding: 0;
  width: 32px;
}

.content-scroll {
  background: #f5f6f8;
  flex: 1;
  overflow: auto;
  padding: 0 34px 34px;
}

@media (max-width: 1180px) {
  .access-page {
    grid-template-columns: 92px 1fr;
  }

  .side-panel {
    position: relative;
    transition: width 0.18s ease, box-shadow 0.18s ease;
    width: 92px;
    z-index: 30;
  }

  .brand-text,
  .menu-label,
  .counter,
  .dropdown-icon,
  .sub-menu,
  .sidebar-footer {
    display: none;
  }

  .brand-section,
  .menu-item {
    justify-content: center;
    padding-left: 0;
    padding-right: 0;
  }

  .menu-item {
    gap: 0;
  }

  .side-panel:hover,
  .side-panel:focus-within {
    background: #f5f6f8;
    box-shadow: 18px 0 34px rgba(15, 23, 42, 0.08);
    width: min(318px, calc(100vw - 18px));
  }

  .side-panel:hover .brand-text,
  .side-panel:focus-within .brand-text,
  .side-panel:hover .sub-menu,
  .side-panel:focus-within .sub-menu,
  .side-panel:hover .sidebar-footer,
  .side-panel:focus-within .sidebar-footer {
    display: flex;
  }

  .side-panel:hover .menu-label,
  .side-panel:focus-within .menu-label,
  .side-panel:hover .dropdown-icon,
  .side-panel:focus-within .dropdown-icon {
    display: block;
  }

  .side-panel:hover .counter,
  .side-panel:focus-within .counter {
    display: inline-flex;
  }

  .side-panel:hover .brand-section,
  .side-panel:focus-within .brand-section,
  .side-panel:hover .menu-item,
  .side-panel:focus-within .menu-item {
    justify-content: flex-start;
    padding-left: 38px;
    padding-right: 38px;
  }

  .side-panel:hover .menu-item,
  .side-panel:focus-within .menu-item {
    gap: 26px;
  }

  .notification-shortcut {
    justify-content: center;
    max-width: 40px;
    padding: 0;
    width: 40px;
  }

  .notification-shortcut span:last-child {
    display: none;
  }
}

@media (max-width: 640px) {
  .access-page {
    grid-template-columns: 72px 1fr;
  }

  .side-panel {
    padding-top: 18px;
    width: 72px;
  }

  .brand-section {
    margin-bottom: 34px;
  }

  .logo-img {
    height: 38px;
  }

  .side-panel:hover,
  .side-panel:focus-within {
    width: min(286px, calc(100vw - 12px));
  }

  .side-panel:hover .brand-section,
  .side-panel:focus-within .brand-section,
  .side-panel:hover .menu-item,
  .side-panel:focus-within .menu-item {
    padding-left: 24px;
    padding-right: 24px;
  }

  .topbar {
    gap: 10px;
    height: 70px;
    padding: 8px 14px 0;
  }

  .profile-meta,
  .user-actions {
    display: none;
  }

  .content-scroll {
    padding: 0 14px 24px;
  }
}
</style>
