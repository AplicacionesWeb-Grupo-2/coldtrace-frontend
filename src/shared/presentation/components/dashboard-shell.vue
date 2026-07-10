<script setup>
import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRoute, useRouter} from 'vue-router';
import useAlertsStore from '@/alerts/application/alerts.store.js';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import useMonitoringStore from '@/monitoring/application/monitoring.store.js';
import useReportsStore from '@/reports/application/reports.store.js';
import {createOperationalDataPoller} from '@/shared/application/operational-data-poller.js';
import LanguageSwitcher from '@/shared/presentation/components/language-switcher.vue';

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
const mobileNavigationOpen = ref(false);
const contextNavigationElement = ref(null);
let mobileNavigationCloseTimeout = null;
watch(() => route.path, (nextPath, previousPath) => {
    if (nextPath !== previousPath) {
        closeMobileNavigation();
        scrollActiveContextLinkIntoView();
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
const operationalDataPoller = createOperationalDataPoller({
    getOrganizationId: () => activeOrganizationId.value,
    refreshAssets: organizationId => assetManagementStore.refreshOrganizationOperationalState(organizationId),
    refreshIncidents: organizationId => alertsStore.fetchIncidentsOnly(organizationId),
    scheduler: window,
});

onMounted(() => {
    loadShellData();
    operationalDataPoller.start();
    scrollActiveContextLinkIntoView();
});

onBeforeUnmount(() => {
    operationalDataPoller.stop();
    clearMobileNavigationCloseTimeout();
});

const assetIssuesCount = computed(() => assetManagementStore.assetIssueCountFor(activeOrganizationId.value));
const pendingAlertsCount = computed(() => alertsStore.openIncidentsCount);
const organizationMembers = computed(() => {
    const organizationId = Number(activeOrganizationId.value);
    if (!organizationId) return [];

    return (store.users ?? [])
        .filter(user => Number(user.organizationId) === organizationId)
        .slice(0, 5)
        .map(user => {
            const role = (store.roles ?? []).find(current => current.id === Number(user.roleId));
            return {
                id: user.id,
                fullName: user.fullName,
                initials: initialsFor(user.fullName),
                roleLabelKey: store.roleLabelKey(role),
            };
        });
});

const isAccessRoute = computed(() =>
    route.path.includes('/identity-access/users') || route.path.includes('/identity-access/roles-permissions'),
);
const isReportsRoute = computed(() =>
    route.path.includes('/reports') || route.path.includes('/identity-access/reports'),
);
const isAlertsRoute = computed(() => route.path.includes('/alerts'));
const isSettingsRoute = computed(() =>
    route.path.includes('/asset-management/safety-ranges') ||
    route.path.includes('/asset-management/operational-parameters') ||
    route.path.includes('/maintenance') ||
    route.path.includes('/settings'),
);
const isAccessDropdownOpen = computed(() => accessDropdownTouched.value ? accessDropdownOpen.value : isAccessRoute.value);
const isReportsDropdownOpen = computed(() => reportsDropdownTouched.value ? reportsDropdownOpen.value : isReportsRoute.value);
const isSettingsDropdownOpen = computed(() => settingsDropdownTouched.value ? settingsDropdownOpen.value : isSettingsRoute.value);
const contextQueryParams = computed(() => {
    const organizationId = Number(activeOrganizationId.value);
    return organizationId ? {organizationId} : {};
});
const contextualLinks = computed(() => {
    if (isAlertsRoute.value) {
        return [
            {path: '/alerts/incidents', labelKey: 'dashboard-shell.nav-incidents', visible: true},
            {path: '/alerts/ai-guidance', labelKey: 'dashboard-shell.nav-ai-guidance', visible: true},
        ];
    }

    if (isAccessRoute.value) {
        return [
            {path: '/identity-access/users', labelKey: 'dashboard-shell.nav-users', visible: true},
            {path: '/identity-access/roles-permissions/users/new', labelKey: 'dashboard-shell.nav-new-user', visible: canManageUsers.value},
            {path: '/identity-access/roles-permissions/permissions', labelKey: 'dashboard-shell.nav-permissions', visible: canManageAccess.value},
        ];
    }

    if (isSettingsRoute.value) {
        return [
            {path: '/asset-management/safety-ranges', labelKey: 'dashboard-shell.nav-safety-ranges', visible: true},
            {path: '/asset-management/operational-parameters', labelKey: 'dashboard-shell.nav-operational-parameters', visible: true},
            {path: '/maintenance/preventive', labelKey: 'dashboard-shell.nav-preventive-maintenance', visible: true},
            {path: '/maintenance/technical-service', labelKey: 'dashboard-shell.nav-technical-service', visible: true},
            {path: '/settings/billing', labelKey: 'dashboard-shell.nav-billing', visible: true},
        ];
    }

    if (isReportsRoute.value) {
        return [
            {path: '/reports/daily-log', labelKey: 'dashboard-shell.nav-daily-log', visible: true},
            {path: '/reports/monthly', labelKey: 'dashboard-shell.nav-monthly-report', visible: true},
            {path: '/reports/history', labelKey: 'dashboard-shell.nav-history', visible: true},
            {path: '/reports/compliance', labelKey: 'dashboard-shell.nav-compliance', visible: true},
            {path: '/reports/ai-summary', labelKey: 'dashboard-shell.nav-ai-summary', visible: true},
            {path: '/reports/findings', labelKey: 'dashboard-shell.nav-findings', visible: true},
            {path: '/reports/audit-evidence', labelKey: 'dashboard-shell.nav-audit-evidence', visible: true},
        ];
    }

    return [];
});

/**
 * Toggles access dropdown.
 *
 * @returns {void}
 */
function toggleAccessDropdown() {
    accessDropdownOpen.value = !isAccessDropdownOpen.value;
    accessDropdownTouched.value = true;
    reportsDropdownOpen.value = false;
    reportsDropdownTouched.value = true;
    settingsDropdownOpen.value = false;
    settingsDropdownTouched.value = true;
}

/**
 * Toggles reports dropdown.
 *
 * @returns {void}
 */
function toggleReportsDropdown() {
    reportsDropdownOpen.value = !isReportsDropdownOpen.value;
    reportsDropdownTouched.value = true;
    accessDropdownOpen.value = false;
    accessDropdownTouched.value = true;
    settingsDropdownOpen.value = false;
    settingsDropdownTouched.value = true;
}

/**
 * Toggles settings dropdown.
 *
 * @returns {void}
 */
function toggleSettingsDropdown() {
    settingsDropdownOpen.value = !isSettingsDropdownOpen.value;
    settingsDropdownTouched.value = true;
    accessDropdownOpen.value = false;
    accessDropdownTouched.value = true;
    reportsDropdownOpen.value = false;
    reportsDropdownTouched.value = true;
}

/**
 * Toggles the responsive navigation drawer.
 *
 * @returns {void}
 */
function toggleMobileNavigation() {
    clearMobileNavigationCloseTimeout();
    if (mobileNavigationOpen.value) {
        closeMobileNavigation();
        return;
    }
    mobileNavigationOpen.value = true;
}

/**
 * Closes the responsive navigation and resets its grouped menus.
 *
 * @returns {void}
 */
function closeMobileNavigation() {
    clearMobileNavigationCloseTimeout();
    mobileNavigationOpen.value = false;
    accessDropdownOpen.value = false;
    accessDropdownTouched.value = false;
    reportsDropdownOpen.value = false;
    reportsDropdownTouched.value = false;
    settingsDropdownOpen.value = false;
    settingsDropdownTouched.value = false;
}

/**
 * Closes the responsive drawer after a menu link handles navigation.
 *
 * @param {MouseEvent} event
 * @returns {void}
 */
function closeMobileNavigationAfterNavigation(event) {
    if (!(event.target instanceof Element) || !event.target.closest('a')) return;
    clearMobileNavigationCloseTimeout();
    mobileNavigationCloseTimeout = window.setTimeout(() => {
        mobileNavigationCloseTimeout = null;
        closeMobileNavigation();
    }, 180);
}

/**
 * Clears the pending responsive navigation close operation.
 *
 * @returns {void}
 */
function clearMobileNavigationCloseTimeout() {
    if (mobileNavigationCloseTimeout === null) return;
    window.clearTimeout(mobileNavigationCloseTimeout);
    mobileNavigationCloseTimeout = null;
}

/**
 * Keeps the active contextual tab visible in the responsive horizontal navigation.
 *
 * @returns {void}
 */
function scrollActiveContextLinkIntoView() {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 1100px)').matches) return;

    void nextTick(() => {
        const navigation = contextNavigationElement.value;
        const activeLink = navigation?.querySelector('a.active');
        if (!navigation || !activeLink) return;

        let alignmentTarget = activeLink;
        let previousLink = alignmentTarget.previousElementSibling;
        while (previousLink) {
            const visibleSpan = activeLink.offsetLeft + activeLink.offsetWidth - previousLink.offsetLeft;
            if (visibleSpan > navigation.clientWidth - 20) break;
            alignmentTarget = previousLink;
            previousLink = alignmentTarget.previousElementSibling;
        }

        alignmentTarget.scrollIntoView({behavior: 'auto', block: 'nearest', inline: 'start'});
    });
}

/**
 * Handles logout behavior in the shared context.
 *
 * @returns {*}
 */
function logout() {
    closeMobileNavigation();
    store.clearCurrentUser();
    router.push('/identity-access/sign-in');
}

/**
 * Navigates to the shared settings section from the profile actions.
 *
 * @returns {Promise<*>}
 */
function openSettings() {
    closeMobileNavigation();
    return router.push({path: '/asset-management/safety-ranges', query: contextQueryParams.value});
}

/**
 * Determines whether contextual topbar link is active.
 *
 * @param {{path: string}} link
 * @returns {boolean}
 */
function isContextLinkActive(link) {
    return route.path === link.path;
}

/**
 * Loads shell data data for the current view or use case.
 *
 * @returns {Promise<*>}
 */
async function loadShellData() {
    try {
        await store.fetchAccessData();
        await operationalDataPoller.refresh();
    } catch {
        // Keep the shell usable when the local data service is unavailable.
    }
}

/**
 * Downloads current month report for the current selection.
 *
 * @returns {Promise<*>}
 */
async function downloadCurrentMonthReport() {
    if (!canDownloadReports.value) {
        await router.push('/reports/monthly');
        return;
    }

    try {
        const organizationId = activeOrganizationId.value;
        await Promise.all([
            assetManagementStore.fetchAssetManagementData({organizationId, includeSettings: false}),
            monitoringStore.fetchMonitoringData({organizationId, includeDependencies: false}),
            reportsStore.fetchReports(organizationId),
        ]);

        const month = reportsStore.currentDate().slice(0, 7);
        const monthlyReport = reportsStore.buildMonthlyReport(organizationId, month);

        if (!monthlyReport.canDownload) {
            await router.push('/reports/monthly');
            return;
        }

        await reportsStore.createMonthlySummaryReport(organizationId, monthlyReport);
        downloadMonthlyCsv(monthlyReport);
    } catch {
        await router.push('/reports/monthly');
    }
}

/**
 * Downloads monthly csv for the current selection.
 *
 * @param {*} monthlyReport
 * @returns {void}
 */
function downloadMonthlyCsv(monthlyReport) {
    const blob = new Blob([reportsStore.monthlyReportCsv(monthlyReport)], {type: 'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${fileNamePart(activeOrganizationName.value)}-monthly-report-${monthlyReport.month}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

/**
 * Handles file name part behavior in the shared context.
 *
 * @param {string} value
 * @returns {string}
 */
function fileNamePart(value) {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'organization';
}

/**
 * Builds compact initials for sidebar member avatars.
 *
 * @param {string} fullName
 * @returns {string}
 */
function initialsFor(fullName) {
    const initials = String(fullName ?? '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? '')
        .join('');

    return initials || 'CT';
}
</script>

<template>
  <main class="access-page" :class="{'mobile-navigation-open': mobileNavigationOpen}">
    <button
      v-if="mobileNavigationOpen"
      class="mobile-nav-backdrop"
      type="button"
      :aria-label="t('dashboard-shell.close-navigation')"
      @click="closeMobileNavigation"
    ></button>

    <aside
      id="dashboard-navigation"
      class="side-panel"
      :class="{'mobile-open': mobileNavigationOpen}"
    >
      <div class="sidebar-top">
        <div class="brand-section">
          <img src="/coldtrace-icon.png" alt="ColdTrace" class="logo-img"/>
          <div class="brand-text">
            <span class="brand-name">ColdTrace</span>
            <span class="brand-sub">{{ activeOrganizationName }}</span>
          </div>
        </div>

        <nav class="side-menu" @click="closeMobileNavigationAfterNavigation">
          <router-link class="menu-item" to="/identity-access/dashboard" active-class="active" :aria-label="t('dashboard-shell.nav-main')">
            <span class="material-icons menu-icon" aria-hidden="true">dashboard</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-main') }}</span>
          </router-link>

          <router-link class="menu-item" to="/asset-management/assets" active-class="active" :aria-label="t('dashboard-shell.nav-assets')">
            <span class="material-icons menu-icon" aria-hidden="true">inventory_2</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-assets') }}</span>
            <span v-if="assetIssuesCount > 0" class="counter badge-red">{{ assetIssuesCount }}</span>
          </router-link>

          <router-link v-if="canMonitorAssets" class="menu-item" to="/monitoring/assets" active-class="active" :aria-label="t('dashboard-shell.nav-monitoring')">
            <span class="material-icons menu-icon" aria-hidden="true">sensors</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-monitoring') }}</span>
          </router-link>

          <router-link class="menu-item" to="/alerts/incidents" active-class="active" :aria-label="t('dashboard-shell.nav-alerts')">
            <span class="material-icons menu-icon" aria-hidden="true">warning</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-alerts') }}</span>
            <span v-if="pendingAlertsCount > 0" class="counter badge-red">{{ pendingAlertsCount }}</span>
          </router-link>

          <div class="menu-group" :class="{open: isAccessDropdownOpen, 'active-group': isAccessRoute}">
            <button
              class="menu-item menu-trigger"
              type="button"
              :aria-label="t('dashboard-shell.nav-access')"
              :aria-expanded="isAccessDropdownOpen"
              @click="toggleAccessDropdown"
            >
              <span class="material-icons menu-icon" aria-hidden="true">admin_panel_settings</span>
              <span class="menu-label">{{ t('dashboard-shell.nav-access') }}</span>
              <span class="material-icons dropdown-icon">expand_more</span>
            </button>
            <div v-if="isAccessDropdownOpen" class="sub-menu" :aria-label="t('dashboard-shell.nav-access-aria')">
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
              :aria-label="t('dashboard-shell.nav-settings')"
              :aria-expanded="isSettingsDropdownOpen"
              @click="toggleSettingsDropdown"
            >
              <span class="material-icons menu-icon" aria-hidden="true">settings</span>
              <span class="menu-label">{{ t('dashboard-shell.nav-settings') }}</span>
              <span class="material-icons dropdown-icon">expand_more</span>
            </button>
            <div v-if="isSettingsDropdownOpen" class="sub-menu" :aria-label="t('dashboard-shell.nav-settings-aria')">
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
              <router-link class="sub-menu-link" to="/settings/billing" active-class="active">
                {{ t('dashboard-shell.nav-billing') }}
              </router-link>
            </div>
          </div>

          <div class="menu-group" :class="{open: isReportsDropdownOpen, 'active-group': isReportsRoute}">
            <button
              class="menu-item menu-trigger"
              type="button"
              :aria-label="t('dashboard-shell.nav-reports')"
              :aria-expanded="isReportsDropdownOpen"
              @click="toggleReportsDropdown"
            >
              <span class="material-icons menu-icon" aria-hidden="true">description</span>
              <span class="menu-label">{{ t('dashboard-shell.nav-reports') }}</span>
              <span class="material-icons dropdown-icon">expand_more</span>
            </button>
            <div v-if="isReportsDropdownOpen" class="sub-menu" :aria-label="t('dashboard-shell.nav-reports-aria')">
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
              <router-link class="sub-menu-link" to="/reports/ai-summary" active-class="active">
                {{ t('dashboard-shell.nav-ai-summary') }}
              </router-link>
              <router-link class="sub-menu-link" to="/reports/findings" active-class="active">
                {{ t('dashboard-shell.nav-findings') }}
              </router-link>
              <router-link class="sub-menu-link" to="/reports/audit-evidence" active-class="active">
                {{ t('dashboard-shell.nav-audit-evidence') }}
              </router-link>
            </div>
          </div>

          <router-link class="menu-item" to="/alerts/notifications" active-class="active" :aria-label="t('dashboard-shell.nav-notifications')">
            <span class="material-icons menu-icon" aria-hidden="true">notifications</span>
            <span class="menu-label">{{ t('dashboard-shell.nav-notifications') }}</span>
            <span v-if="pendingAlertsCount > 0" class="counter badge-red">{{ pendingAlertsCount }}</span>
          </router-link>
        </nav>

        <section
          v-if="organizationMembers.length"
          class="team-card"
          :aria-label="t('dashboard-shell.team-members-aria')"
          @click="closeMobileNavigationAfterNavigation"
        >
          <div class="team-card-header">
            <span>{{ t('dashboard-shell.team-members') }}</span>
            <router-link
              class="team-manage-link"
              to="/identity-access/roles-permissions"
              :aria-label="t('dashboard-shell.team-manage')"
            >
              <span class="material-icons">manage_accounts</span>
            </router-link>
          </div>
          <div class="team-list">
            <router-link
              v-for="member in organizationMembers"
              :key="member.id"
              class="team-member"
              to="/identity-access/roles-permissions"
            >
              <span class="member-avatar">{{ member.initials }}</span>
              <span class="member-copy">
                <span class="member-name">{{ member.fullName }}</span>
                <small class="member-role">{{ t(member.roleLabelKey) }}</small>
              </span>
            </router-link>
          </div>
        </section>
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

    <section class="workspace" :inert="mobileNavigationOpen">
      <header class="topbar">
        <button
          class="mobile-nav-toggle"
          type="button"
          aria-controls="dashboard-navigation"
          :aria-label="t(mobileNavigationOpen ? 'dashboard-shell.close-navigation' : 'dashboard-shell.open-navigation')"
          :aria-expanded="mobileNavigationOpen"
          @click="toggleMobileNavigation"
        >
          <span class="material-icons" aria-hidden="true">{{ mobileNavigationOpen ? 'close' : 'menu' }}</span>
        </button>

        <nav ref="contextNavigationElement" class="context-nav" :aria-label="t('dashboard-shell.section-navigation')">
          <router-link
            v-for="link in contextualLinks.filter(current => current.visible)"
            :key="link.path"
            :to="{path: link.path, query: contextQueryParams}"
            :class="{active: isContextLinkActive(link)}"
          >
            {{ t(link.labelKey) }}
          </router-link>
        </nav>

        <div class="topbar-actions">
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
            </div>
            <div class="profile-meta">
              <span class="name">{{ profileUserName }}</span>
              <span class="role">{{ t(profileRoleLabelKey) }}</span>
            </div>
            <div class="user-actions">
              <button type="button" :aria-label="t('dashboard-shell.settings-action')" @click="openSettings">
                <span class="material-icons">settings</span>
              </button>
              <button type="button" :aria-label="t('dashboard-shell.logout-action')" @click="logout">
                <span class="material-icons">logout</span>
              </button>
            </div>
          </div>

          <div class="topbar-language-switcher">
            <language-switcher/>
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
  font-family: Inter, Arial, sans-serif;
  grid-template-columns: 318px minmax(0, 1fr);
  height: 100vh;
  overflow: hidden;
}

.side-panel {
  display: flex;
  flex-direction: column;
  height: 100vh;
  justify-content: space-between;
  -ms-overflow-style: none;
  overflow: auto;
  padding: 28px 0 24px;
  scrollbar-width: none;
}

.side-panel::-webkit-scrollbar {
  height: 0;
  width: 0;
}

.brand-section {
  align-items: center;
  display: flex;
  gap: 12px;
  margin-bottom: 48px;
  padding: 0 36px;
}

.logo-img {
  height: 46px;
  width: 46px;
}

.brand-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.brand-name {
  color: #1f2937;
  font-size: 18px;
  font-weight: 800;
  line-height: 20px;
}

.brand-sub {
  color: #9aa4b5;
  font-size: 12px;
  font-weight: 800;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.side-menu {
  display: grid;
  gap: 8px;
  margin-bottom: 28px;
}

.menu-item {
  align-items: center;
  background: transparent;
  border: 0;
  box-sizing: border-box;
  color: #606c80;
  cursor: pointer;
  display: flex;
  gap: 24px;
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
  font-size: 13px;
  font-weight: 800;
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
  transition: transform 0.15s;
  width: 20px;
}

.menu-group.open .dropdown-icon,
.menu-group.active-group .dropdown-icon {
  transform: rotate(180deg);
}

.sub-menu {
  display: grid;
  gap: 10px;
  padding: 0 38px 8px 88px;
}

.sub-menu-link {
  color: #9aa4b5;
  font-size: 12px;
  font-weight: 800;
  line-height: 16px;
  text-decoration: none;
}

.sub-menu-link.active,
.sub-menu-link:hover {
  color: #2563eb;
}

.counter {
  border-radius: 999px;
  font-size: 10px;
  font-weight: 800;
  padding: 4px 8px;
}

.badge-red {
  background: #fee2e2;
  color: #ef4444;
}

.team-card {
  background: #ffffff;
  border: 1px solid #e8edf5;
  border-radius: 8px;
  margin: 0 18px 24px;
  padding: 16px 16px 19px;
}

.team-card-header {
  align-items: center;
  color: #667085;
  display: flex;
  font-size: 13px;
  font-weight: 800;
  justify-content: space-between;
  line-height: 18px;
  margin-bottom: 12px;
}

.team-manage-link {
  align-items: center;
  border: 1px solid #e4e7ec;
  border-radius: 8px;
  color: #98a2b3;
  display: inline-flex;
  height: 28px;
  justify-content: center;
  text-decoration: none;
  transition:
    background-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
  width: 28px;
}

.team-manage-link:hover {
  background: #f4f7fb;
  color: #2563eb;
  transform: translateY(-1px);
}

.team-manage-link .material-icons {
  font-size: 18px;
  height: 18px;
  line-height: 18px;
  width: 18px;
}

.team-list {
  display: grid;
  gap: 10px;
  max-height: 92px;
  overflow: hidden;
  transition: max-height 220ms ease;
}

.team-card:hover .team-list,
.team-card:focus-within .team-list {
  max-height: 260px;
}

.team-member {
  align-items: center;
  border-radius: 7px;
  color: #263348;
  display: grid;
  gap: 11px;
  grid-template-columns: 34px minmax(0, 1fr);
  min-height: 40px;
  padding: 4px 5px;
  text-decoration: none;
}

.team-member:hover {
  background: #f8fafc;
}

.member-avatar {
  align-items: center;
  background: #f4f7fb;
  border: 1px solid #e4e7ec;
  border-radius: 999px;
  color: #667085;
  display: inline-flex;
  font-size: 11px;
  font-weight: 800;
  height: 34px;
  justify-content: center;
  width: 34px;
}

.member-copy {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.member-name {
  color: #263348;
  font-size: 12.5px;
  font-weight: 800;
  line-height: 17px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.member-role {
  color: #98a2b3;
  font-size: 10.5px;
  font-weight: 800;
  line-height: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sidebar-footer {
  display: grid;
  gap: 22px;
  padding: 0 32px;
}

.drag-upload {
  align-items: center;
  appearance: none;
  background: #fff;
  border: 1px dashed #e4e7ec;
  border-radius: 8px;
  box-sizing: border-box;
  color: #2563eb;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  font-family: inherit;
  font-size: 15px;
  font-weight: 800;
  gap: 8px;
  justify-content: center;
  min-height: 126px;
  padding: 1px 6px;
  text-align: center;
  text-decoration: none;
  width: 100%;
}

.upload-icon {
  font-size: 28px;
  height: 28px;
  line-height: 28px;
  width: 28px;
}

.upload-text {
  font-size: 12px;
  font-weight: 800;
}

.toggle-control {
  background: #eef2f7;
  border-radius: 999px;
  display: flex;
  gap: 4px;
  padding: 4px;
}

.toggle-option {
  align-items: center;
  border-radius: 999px;
  color: #98a2b3;
  cursor: pointer;
  display: flex;
  flex: 1;
  gap: 8px;
  justify-content: center;
  min-height: 36px;
  transition: all 0.2s;
}

.toggle-option.active {
  background: #fff;
  box-shadow: 0 2px 6px rgba(96, 108, 128, 0.16);
  color: #111827;
}

.toggle-option span {
  font-size: 12px;
  font-weight: 800;
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
  box-sizing: border-box;
  display: flex;
  flex-shrink: 0;
  gap: 20px;
  height: 74px;
  justify-content: space-between;
  min-width: 0;
  padding: 0 28px;
}

.context-nav {
  align-items: center;
  display: flex;
  gap: 28px;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  scrollbar-width: none;
  width: 100%;
}

.context-nav::-webkit-scrollbar {
  height: 0;
}

.context-nav a {
  color: #98a2b3;
  flex: none;
  font-size: 13px;
  font-weight: 800;
  padding: 22px 0 14px;
  position: relative;
  text-decoration: none;
}

.context-nav a.active {
  color: #2563eb;
}

.context-nav a.active::after {
  background: #2563eb;
  border-radius: 999px;
  bottom: 6px;
  content: '';
  height: 2px;
  left: 0;
  position: absolute;
  right: 0;
}

.topbar-actions {
  align-items: center;
  display: flex;
  gap: 22px;
  justify-content: flex-end;
  max-width: 100%;
  min-width: 0;
}

.notification-shortcut {
  align-items: center;
  background: #feeceb;
  border: 1px solid #fecaca;
  border-radius: 8px;
  color: #b51313;
  display: flex;
  gap: 10px;
  min-height: 42px;
  padding: 0 16px;
  text-decoration: none;
}

.notification-shortcut .material-icons {
  color: #b51313;
}

.notification-shortcut span:last-child {
  font-size: 13px;
  font-weight: 800;
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
  color: #a7b1c2;
  font-size: 11px;
  font-weight: 800;
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
  background: #f8fafc;
  border: 4px solid #eef2f7;
  border-radius: 999px;
  display: flex;
  height: 48px;
  justify-content: center;
  overflow: hidden;
  position: relative;
  width: 48px;
}

.avatar-placeholder {
  color: #c4ccd8;
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
  padding: 0 28px 44px;
}

.mobile-nav-backdrop,
.mobile-nav-toggle,
.topbar-language-switcher {
  display: none;
}

@media (max-width: 1100px) {
  .access-page {
    display: block;
    height: 100dvh;
    min-height: 100dvh;
    overflow: hidden;
    position: relative;
  }

  .side-panel {
    background: #ffffff;
    border-right: 1px solid #e4e7ec;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
    display: none;
    height: 100dvh;
    justify-content: flex-start;
    left: 0;
    overflow: visible;
    padding: 14px 0;
    position: fixed;
    top: 0;
    width: 76px;
    z-index: 50;
  }

  .side-panel.mobile-open {
    display: flex;
  }

  .mobile-nav-backdrop {
    background: rgba(15, 23, 42, 0.28);
    border: 0;
    cursor: pointer;
    display: block;
    inset: 0;
    padding: 0;
    position: fixed;
    z-index: 45;
  }

  .mobile-nav-toggle {
    align-items: center;
    background: #ffffff;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    color: #2563eb;
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    height: 40px;
    justify-content: center;
    padding: 0;
    width: 40px;
  }

  .mobile-nav-toggle .material-icons {
    font-size: 22px;
  }

  .sidebar-top {
    display: grid;
    gap: 18px;
    min-width: 0;
  }

  .brand-section {
    justify-content: center;
    margin-bottom: 0;
    padding: 0;
  }

  .logo-img {
    height: 38px;
    width: 38px;
  }

  .brand-text,
  .menu-label,
  .dropdown-icon,
  .team-card,
  .sidebar-footer {
    display: none;
  }

  .side-menu {
    display: grid;
    gap: 8px;
    margin: 0;
    padding: 0 10px;
  }

  .menu-group {
    position: relative;
  }

  .menu-group.open {
    z-index: 60;
  }

  .menu-item {
    background: #f8fafc;
    border: 1px solid #edf1f7;
    border-radius: 8px;
    gap: 0;
    height: 48px;
    justify-content: center;
    padding: 0;
    position: relative;
    width: 56px;
  }

  .menu-item.active,
  .menu-group.active-group > .menu-item,
  .menu-group.open > .menu-item {
    background: #eef4ff;
  }

  .counter {
    align-items: center;
    display: inline-flex;
    justify-content: center;
    min-width: 18px;
    padding: 2px 5px;
    position: absolute;
    right: -4px;
    top: -5px;
  }

  .menu-group.open::after {
    border-bottom: 8px solid transparent;
    border-right: 8px solid #ffffff;
    border-top: 8px solid transparent;
    content: '';
    position: absolute;
    right: -11px;
    top: 16px;
    z-index: 62;
  }

  .menu-group.open::before {
    border-bottom: 9px solid transparent;
    border-right: 9px solid #e4e7ec;
    border-top: 9px solid transparent;
    content: '';
    position: absolute;
    right: -11px;
    top: 15px;
    z-index: 61;
  }

  .menu-group.open .sub-menu {
    background: #ffffff;
    border: 1px solid #e4e7ec;
    border-radius: 8px;
    box-shadow: 0 12px 30px rgba(15, 23, 42, 0.14);
    display: grid;
    gap: 6px;
    left: 68px;
    max-height: min(72dvh, 420px);
    min-width: min(244px, calc(100vw - 96px));
    overflow-y: auto;
    padding: 8px;
    position: absolute;
    top: 0;
    z-index: 60;
  }

  .sub-menu-link {
    border-radius: 6px;
    color: #667085;
    padding: 8px 10px;
  }

  .sub-menu-link.active,
  .sub-menu-link:hover {
    background: #eef4ff;
  }

  .workspace {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    min-height: 0;
    min-width: 0;
  }

  .topbar {
    align-items: center;
    background: #f5f6f8;
    border-bottom: 1px solid #e4e7ec;
    flex: 0 0 auto;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 10px;
    height: auto;
    justify-content: space-between;
    padding: 10px 14px 12px;
  }

  .context-nav {
    flex: 0 0 100%;
    gap: 18px;
    max-width: 100%;
    order: 3;
    padding-bottom: 2px;
    scroll-padding-inline: 12px;
  }

  .context-nav::after {
    content: '';
    flex: 0 0 60px;
  }

  .context-nav a {
    font-size: 12px;
    padding: 8px 0 10px;
  }

  .topbar-actions {
    flex: 0 1 auto;
    flex-wrap: nowrap;
    gap: 10px;
    justify-content: flex-end;
    margin-left: auto;
    position: static;
  }

  .notification-shortcut {
    border-radius: 8px;
    flex: 0 0 42px;
    gap: 0;
    justify-content: center;
    min-height: 42px;
    padding: 0;
    width: 42px;
  }

  .notification-shortcut span:last-child {
    display: none;
  }

  .user-profile {
    gap: 8px;
    min-width: 0;
  }

  .avatar-wrapper,
  .avatar-container {
    height: 40px;
    width: 40px;
  }

  .avatar-container {
    border-width: 3px;
  }

  .user-actions {
    gap: 4px;
    margin-left: 0;
  }

  .user-actions button {
    height: 28px;
    width: 28px;
  }

  .topbar-language-switcher {
    display: block;
    flex: 0 0 44px;
    height: 44px;
    position: relative;
    width: 44px;
    z-index: 70;
  }

  .topbar-language-switcher :deep(.language-menu-trigger) {
    align-items: center;
    background: #ffffff;
    border: 1px solid #e4e7ec;
    border-radius: 999px;
    color: #667085;
    cursor: pointer;
    display: flex;
    height: 44px;
    inset: 0;
    justify-content: center;
    position: absolute;
    width: 44px;
  }

  .topbar-language-switcher :deep(.language-switcher) {
    opacity: 0;
    pointer-events: none;
    position: absolute;
    right: 0;
    top: -5px;
    transform: scaleX(0.18);
    transform-origin: center right;
    transition: opacity 0.16s ease, transform 0.2s ease;
  }

  .topbar-language-switcher:focus-within :deep(.language-menu-trigger),
  .topbar-language-switcher :deep(.language-menu-trigger[aria-expanded='true']) {
    opacity: 0;
    pointer-events: none;
  }

  .topbar-language-switcher:focus-within :deep(.language-switcher),
  .topbar-language-switcher :deep(.language-switcher.menu-open) {
    opacity: 1;
    pointer-events: auto;
    transform: scaleX(1);
  }

  .content-scroll {
    flex: 1 1 auto;
    height: auto;
    min-height: 0;
    overflow: auto;
    padding: 0 14px 34px;
  }
}

@media (max-width: 520px) {
  .topbar {
    column-gap: 8px;
    padding: 9px 12px 11px;
  }

  .topbar-actions {
    gap: 8px;
    max-width: calc(100% - 48px);
  }

  .profile-meta {
    display: none;
  }

  .content-scroll {
    padding-inline: 12px;
  }
}

@media (max-width: 390px) {
  .topbar {
    padding-inline: 10px;
  }

  .context-nav {
    gap: 16px;
    scroll-padding-inline: 0;
  }

  .side-panel {
    width: 68px;
  }

  .side-menu {
    padding-inline: 8px;
  }

  .menu-item {
    height: 44px;
    width: 52px;
  }

  .menu-group.open .sub-menu {
    left: 62px;
    min-width: min(226px, calc(100vw - 84px));
  }
}

@media (max-width: 1100px) and (max-height: 700px) {
  .side-panel {
    padding-block: 8px;
  }

  .sidebar-top {
    gap: 8px;
  }

  .logo-img {
    height: 30px;
    width: 30px;
  }

  .side-menu {
    gap: 3px;
  }

  .menu-item {
    height: 40px;
  }
}
</style>
