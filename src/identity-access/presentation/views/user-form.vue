<script setup>
import {computed, onMounted, ref} from 'vue';
import {useI18n} from 'vue-i18n';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';

const {t} = useI18n();
const store = useIdentityAccessStore();
const submitted = ref(false);
const creating = ref(false);
const feedback = ref('idle');
const form = ref({
    fullName: '',
    email: '',
    roleId: 0,
});
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const assignableRoles = computed(() => store.roles.filter(role => store.canAssignRole(role)));
const canManageAccess = computed(() => store.canManageUsers());
const fullNameInvalid = computed(() => form.value.fullName.trim().length < 3);
const emailInvalid = computed(() => !emailPattern.test(form.value.email.trim()));
const roleInvalid = computed(() => !Number(form.value.roleId));

onMounted(async () => {
    await loadFormData();
});

async function loadFormData() {
    feedback.value = 'idle';
    try {
        await store.fetchAccessData();
        selectDefaultRole();
    } catch (error) {
        feedback.value = 'server-error';
    }
}

function selectDefaultRole() {
    const currentRole = assignableRoles.value.find(role => role.id === Number(form.value.roleId));
    if (!currentRole) form.value.roleId = assignableRoles.value[0]?.id ?? 0;
}

async function submit() {
    submitted.value = true;
    feedback.value = 'idle';

    if (fullNameInvalid.value || emailInvalid.value || roleInvalid.value) return;

    creating.value = true;
    try {
        const result = await store.createOrganizationUser(form.value);
        feedback.value = result.status;
        if (result.status === 'success') {
            submitted.value = false;
            form.value = {
                fullName: '',
                email: '',
                roleId: assignableRoles.value[0]?.id ?? 0,
            };
        }
    } catch (error) {
        feedback.value = 'server-error';
    } finally {
        creating.value = false;
    }
}
</script>

<template>
  <section class="form-card" aria-labelledby="create-user-title">
    <div class="table-heading">
      <div>
        <h2 id="create-user-title">{{ t('roles-permissions.create-user-title') }}</h2>
        <p>{{ t('roles-permissions.create-user-subtitle') }}</p>
      </div>
      <router-link class="secondary-action" to="/identity-access/roles-permissions">
        {{ t('roles-permissions.form.cancel') }}
      </router-link>
    </div>

    <p v-if="feedback === 'success'" class="feedback success">
      {{ t('roles-permissions.feedback.user-created') }}
    </p>
    <p v-if="feedback === 'duplicate-email'" class="feedback error">
      {{ t('roles-permissions.feedback.duplicate-email') }}
    </p>
    <p v-if="feedback === 'invalid-role'" class="feedback error">
      {{ t('roles-permissions.feedback.invalid-role') }}
    </p>
    <p v-if="feedback === 'server-error'" class="feedback error">
      {{ t('roles-permissions.feedback.server-error') }}
    </p>

    <p v-if="store.loading" class="feedback neutral">
      {{ t('roles-permissions.feedback.loading') }}
    </p>
    <p v-else-if="!canManageAccess" class="feedback error">
      {{ t('roles-permissions.denied.message') }}
    </p>
    <form v-else class="user-form" @submit.prevent="submit">
      <label class="form-field">
        <span>{{ t('roles-permissions.form.full-name') }}</span>
        <input
          v-model="form.fullName"
          type="text"
          :placeholder="t('roles-permissions.form.full-name-placeholder')"
        />
        <small v-if="submitted && fullNameInvalid">
          {{ t('roles-permissions.form.full-name-error') }}
        </small>
      </label>

      <label class="form-field">
        <span>{{ t('roles-permissions.form.email') }}</span>
        <input
          v-model="form.email"
          type="email"
          :placeholder="t('roles-permissions.form.email-placeholder')"
        />
        <small v-if="submitted && emailInvalid">
          {{ t('roles-permissions.form.email-error') }}
        </small>
      </label>

      <label class="form-field">
        <span>{{ t('roles-permissions.form.role') }}</span>
        <select v-model.number="form.roleId">
          <option v-for="role in assignableRoles" :key="role.id" :value="role.id">
            {{ t(store.roleLabelKey(role)) }}
          </option>
        </select>
        <small v-if="submitted && roleInvalid">
          {{ t('roles-permissions.form.role-error') }}
        </small>
      </label>

      <div class="form-actions">
        <router-link class="secondary-action" to="/identity-access/roles-permissions">
          {{ t('roles-permissions.form.cancel') }}
        </router-link>
        <button class="primary-form-action" type="submit" :disabled="creating">
          {{ t(creating ? 'roles-permissions.form.creating' : 'roles-permissions.form.create') }}
        </button>
      </div>
    </form>
  </section>
</template>
