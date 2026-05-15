<script setup>
import {computed, onMounted, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';

const {t} = useI18n();
const store = useIdentityAccessStore();
const savingRoleId = ref(null);
const feedback = ref('idle');
const pageSize = 10;
const currentPage = ref(1);
const canManageAccess = computed(() => store.canManageRolePermissions());
const paginatedRoles = computed(() => {
    const startIndex = (currentPage.value - 1) * pageSize;
    return store.roles.slice(startIndex, startIndex + pageSize);
});

onMounted(() => {
    loadRoles();
});

async function loadRoles() {
    feedback.value = 'idle';
    try {
        await store.fetchAccessData();
    } catch (error) {
        feedback.value = 'server-error';
    }
}

async function toggleRolePermission(role, permissionKey, checked) {
    if (!canManageAccess.value) return;
    savingRoleId.value = role.id;
    feedback.value = 'idle';
    try {
        await store.toggleRolePermission(role, permissionKey, checked);
        feedback.value = 'saved';
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        savingRoleId.value = null;
    }
}
</script>

<template>
  <section class="table-card permission-editor" aria-labelledby="role-permissions-title">
    <div class="table-heading">
      <div>
        <h2 id="role-permissions-title">{{ t('roles-permissions.permissions-title') }}</h2>
        <p>{{ t('roles-permissions.permissions-subtitle') }}</p>
      </div>
      <button class="reload-action" type="button" @click="loadRoles">
        {{ t('roles-permissions.reload') }}
      </button>
    </div>

    <p v-if="feedback === 'server-error'" class="feedback error">
      {{ t('roles-permissions.feedback.server-error') }}
    </p>
    <p v-if="feedback === 'saved'" class="feedback success">
      {{ t('roles-permissions.feedback.permissions-saved') }}
    </p>

    <p v-if="store.loading" class="feedback neutral">
      {{ t('roles-permissions.feedback.loading') }}
    </p>
    <p v-else-if="!canManageAccess" class="feedback error">
      {{ t('roles-permissions.denied.message') }}
    </p>
    <div v-else class="role-permission-list">
      <article v-for="role in paginatedRoles" :key="role.id" class="role-permission-row">
        <span class="role-pill">{{ t(store.roleLabelKey(role)) }}</span>
        <div class="permission-list">
          <label
            v-for="permissionKey in store.availablePermissionKeys"
            :key="permissionKey"
            class="permission-toggle"
          >
            <input
              type="checkbox"
              :checked="store.isPermissionSelected(role, permissionKey)"
              :disabled="savingRoleId === role.id || store.isPermissionToggleDisabled(role, permissionKey)"
              @change="toggleRolePermission(role, permissionKey, $event.target.checked)"
            />
            <span>{{ t(permissionKey) }}</span>
          </label>
        </div>
      </article>
      <list-pagination v-model="currentPage" :total="store.roles.length" :page-size="pageSize"/>
    </div>
  </section>
</template>
