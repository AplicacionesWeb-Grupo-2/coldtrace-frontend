<script setup>
import {computed, onMounted, ref, watch} from 'vue';
import {useI18n} from 'vue-i18n';
import {useRoute} from 'vue-router';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import ListPagination from '@/shared/presentation/components/list-pagination.vue';

const {t} = useI18n();
const route = useRoute();
const store = useIdentityAccessStore();
const feedback = ref('idle');
const savedUserId = ref(null);
const invalidUserId = ref(null);
const deletingUserId = ref(null);
const searchTerm = ref('');
const pageSize = 10;
const currentPage = ref(1);
const selectedRoleByUserId = ref({});
const accessDenied = computed(() => route.query.access === 'denied');
const activeOrganizationId = computed(() => store.currentOrganizationIdFrom());
const organizationUsers = computed(() => {
    if (!activeOrganizationId.value) return [];
    return store.users.filter(user => user.organizationId === activeOrganizationId.value);
});
const rows = computed(() => {
    const normalizedSearch = searchTerm.value.trim().toLowerCase();
    return organizationUsers.value
        .map(user => toUserAccessRow(user))
        .filter(row => {
            if (!normalizedSearch) return true;
            return [row.user.fullName, row.user.email, row.currentRole?.label, row.selectedRole?.label]
                .join(' ')
                .toLowerCase()
                .includes(normalizedSearch);
        });
});
const paginatedRows = computed(() => {
    const startIndex = (currentPage.value - 1) * pageSize;
    return rows.value.slice(startIndex, startIndex + pageSize);
});
const administratorCount = computed(() => organizationUsers.value.filter(user => {
    const role = roleFor(user.roleId);
    return store.isSuperAdministratorRole(role) || store.isAdministratorRole(role);
}).length);
const pendingChangeCount = computed(() => Object.keys(selectedRoleByUserId.value).filter(userId => {
    const user = organizationUsers.value.find(current => current.id === Number(userId));
    return user && selectedRoleByUserId.value[Number(userId)] !== user.roleId;
}).length);
const canManageAccess = computed(() => store.canManageUsers());

onMounted(() => {
    loadAccessData();
});

watch(searchTerm, () => {
    currentPage.value = 1;
});

function roleFor(roleId) {
    return store.roles.find(role => role.id === Number(roleId));
}

function toUserAccessRow(user) {
    const selectedRoleId = selectedRoleByUserId.value[user.id] ?? user.roleId;
    const currentRole = roleFor(user.roleId);
    const selectedRole = roleFor(selectedRoleId);
    return {
        user,
        currentRole,
        selectedRole,
        selectedRoleId,
        permissionKeys: store.permissionKeysForRole(selectedRole ?? currentRole),
        pending: selectedRoleId !== user.roleId,
    };
}

function selectRole(userId, roleId) {
    const nextRoleId = Number(roleId);
    const user = organizationUsers.value.find(current => current.id === userId);
    const selectedRole = roleFor(nextRoleId);

    if (!user || !selectedRole || !store.canManageUserRole(user) || !store.canAssignRole(selectedRole)) return;

    feedback.value = 'idle';
    savedUserId.value = null;
    invalidUserId.value = null;
    selectedRoleByUserId.value = {
        ...selectedRoleByUserId.value,
        [userId]: nextRoleId,
    };
}

async function saveRole(user) {
    const nextRoleId = selectedRoleByUserId.value[user.id] ?? user.roleId;
    const selectedRole = roleFor(nextRoleId);

    if (!selectedRole || !store.canManageUserRole(user) || !store.canAssignRole(selectedRole)) {
        feedback.value = 'invalid-role';
        invalidUserId.value = user.id;
        savedUserId.value = null;
        return;
    }

    try {
        await store.updateUserRole(user, nextRoleId);
        const next = {...selectedRoleByUserId.value};
        delete next[user.id];
        selectedRoleByUserId.value = next;
        feedback.value = 'saved';
        savedUserId.value = user.id;
        invalidUserId.value = null;
    } catch (error) {
        feedback.value = 'server-error';
        savedUserId.value = null;
        invalidUserId.value = user.id;
    }
}

async function deleteUser(user) {
    if (!store.canDeleteUser(user)) {
        feedback.value = 'delete-forbidden';
        invalidUserId.value = user.id;
        savedUserId.value = null;
        return;
    }

    const label = user.fullName || user.email;
    if (!window.confirm(t('roles-permissions.delete-confirm', {name: label}))) return;

    deletingUserId.value = user.id;
    feedback.value = 'idle';
    try {
        const result = await store.deleteUser(user);
        if (result.status !== 'success') {
            feedback.value = 'delete-forbidden';
            invalidUserId.value = user.id;
            return;
        }

        const next = {...selectedRoleByUserId.value};
        delete next[user.id];
        selectedRoleByUserId.value = next;
        feedback.value = 'deleted';
        savedUserId.value = null;
        invalidUserId.value = null;
        currentPage.value = Math.min(currentPage.value, Math.max(1, Math.ceil(rows.value.length / pageSize)));
    } catch {
        feedback.value = 'server-error';
        invalidUserId.value = user.id;
    } finally {
        deletingUserId.value = null;
    }
}

function loadAccessData() {
    feedback.value = 'idle';
    store.fetchAccessData().catch(() => {
        feedback.value = 'server-error';
    });
}
</script>

<template>
  <section v-if="accessDenied" class="access-denied">
    <span class="material-icons denied-icon" aria-hidden="true">block</span>
    <h2>{{ t('roles-permissions.denied.title') }}</h2>
    <p>{{ t('roles-permissions.denied.message') }}</p>
  </section>
  <template v-else>
    <label class="search-box">
      <span class="material-icons search-icon" aria-hidden="true">search</span>
      <input
        v-model="searchTerm"
        type="search"
        :placeholder="t('roles-permissions.search')"
      />
    </label>

    <section class="summary-grid" aria-label="Access summary">
      <article>
        <span>{{ t('roles-permissions.summary.users') }}</span>
        <strong>{{ organizationUsers.length }}</strong>
      </article>
      <article>
        <span>{{ t('roles-permissions.summary.admins') }}</span>
        <strong>{{ administratorCount }}</strong>
      </article>
      <article>
        <span>{{ t('roles-permissions.summary.pending') }}</span>
        <strong>{{ pendingChangeCount }}</strong>
      </article>
    </section>

    <section class="table-card" aria-labelledby="access-table-title">
      <div class="table-heading">
        <div>
          <h2 id="access-table-title">{{ t('roles-permissions.table-title') }}</h2>
          <p>{{ t('roles-permissions.table-subtitle') }}</p>
        </div>
        <div class="table-actions">
          <router-link
            v-if="canManageAccess"
            class="reload-action"
            to="/identity-access/roles-permissions/users/new"
          >
            {{ t('roles-permissions.create-user') }}
          </router-link>
          <button class="reload-action" type="button" @click="loadAccessData">
            {{ t('roles-permissions.reload') }}
          </button>
        </div>
      </div>

      <p v-if="feedback === 'saved'" class="feedback success">
        {{ t('roles-permissions.feedback.saved') }}
      </p>
      <p v-if="feedback === 'invalid-role'" class="feedback error">
        {{ t('roles-permissions.feedback.invalid-role') }}
      </p>
      <p v-if="feedback === 'delete-forbidden'" class="feedback error">
        {{ t('roles-permissions.feedback.delete-forbidden') }}
      </p>
      <p v-if="feedback === 'deleted'" class="feedback success">
        {{ t('roles-permissions.feedback.deleted') }}
      </p>
      <p v-if="feedback === 'server-error'" class="feedback error">
        {{ t('roles-permissions.feedback.server-error') }}
      </p>

      <p v-if="store.loading" class="feedback neutral">
        {{ t('roles-permissions.feedback.loading') }}
      </p>
      <div v-else class="access-table-wrapper">
        <table class="access-table" :class="{'read-only-table': !canManageAccess}">
          <colgroup>
            <col style="width: 70px"/>
            <col style="width: 230px"/>
            <col style="width: 130px"/>
            <col v-if="canManageAccess" style="width: 170px"/>
            <col style="width: 330px"/>
            <col v-if="canManageAccess" style="width: 150px"/>
          </colgroup>
          <thead>
            <tr>
              <th>{{ t('roles-permissions.table.id') }}</th>
              <th>{{ t('roles-permissions.table.user') }}</th>
              <th>{{ t('roles-permissions.table.current-role') }}</th>
              <th v-if="canManageAccess">{{ t('roles-permissions.table.new-role') }}</th>
              <th>{{ t('roles-permissions.table.permissions') }}</th>
              <th v-if="canManageAccess">{{ t('roles-permissions.table.actions') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="row in paginatedRows"
              :key="row.user.id"
              :class="{'saved-row': savedUserId === row.user.id, 'invalid-row': invalidUserId === row.user.id}"
            >
              <td :data-label="t('roles-permissions.table.id')">USR-{{ row.user.organizationUserId }}</td>
              <td :data-label="t('roles-permissions.table.user')">
                <strong>{{ row.user.fullName || row.user.email }}</strong>
                <span>{{ row.user.email }}</span>
              </td>
              <td :data-label="t('roles-permissions.table.current-role')">
                <span class="role-pill">{{ t(store.roleLabelKey(row.currentRole)) }}</span>
              </td>
              <td v-if="canManageAccess" :data-label="t('roles-permissions.table.new-role')">
                <select
                  :value="row.selectedRoleId"
                  :disabled="!store.canManageUserRole(row.user)"
                  @change="selectRole(row.user.id, $event.target.value)"
                >
                  <option value="0">{{ t('roles-permissions.roles.unassigned') }}</option>
                  <option
                    v-for="role in store.roles"
                    :key="role.id"
                    :value="role.id"
                    :disabled="!store.canAssignRole(role)"
                  >
                    {{ t(store.roleLabelKey(role)) }}
                  </option>
                </select>
              </td>
              <td :data-label="t('roles-permissions.table.permissions')">
                <div class="permission-list">
                  <span v-for="permissionKey in row.permissionKeys" :key="permissionKey">
                    {{ t(permissionKey) }}
                  </span>
                </div>
              </td>
              <td v-if="canManageAccess" :data-label="t('roles-permissions.table.actions')">
                <div class="row-actions">
                  <button
                    class="save-action"
                    type="button"
                    :disabled="!row.pending || !store.canManageUserRole(row.user)"
                    @click="saveRole(row.user)"
                  >
                    {{ t(row.pending ? 'roles-permissions.save' : 'roles-permissions.saved') }}
                  </button>
                  <button
                    class="delete-action"
                    type="button"
                    :disabled="deletingUserId === row.user.id || !store.canDeleteUser(row.user)"
                    @click="deleteUser(row.user)"
                  >
                    {{ t(deletingUserId === row.user.id ? 'roles-permissions.deleting' : 'roles-permissions.delete') }}
                  </button>
                </div>
              </td>
            </tr>
            <tr v-if="!rows.length">
              <td class="empty-state" :colspan="canManageAccess ? 6 : 4">
                {{ t('roles-permissions.empty') }}
              </td>
            </tr>
          </tbody>
        </table>
        <list-pagination v-model="currentPage" :total="rows.length" :page-size="pageSize"/>
      </div>
    </section>
  </template>
</template>
