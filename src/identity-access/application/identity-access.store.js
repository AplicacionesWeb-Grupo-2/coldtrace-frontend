import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {IdentityAccessApi} from '@/identity-access/infrastructure/identity-access-api.js';
import {OrganizationAssembler} from '@/identity-access/infrastructure/organization.assembler.js';
import {RoleAssembler} from '@/identity-access/infrastructure/role.assembler.js';
import {UserAssembler} from '@/identity-access/infrastructure/user.assembler.js';
import {Organization} from '@/identity-access/domain/model/organization-entity.js';
import {Permission} from '@/identity-access/domain/model/permission-entity.js';
import {Role} from '@/identity-access/domain/model/role-entity.js';
import {User} from '@/identity-access/domain/model/user-entity.js';
import {RoleName} from '@/identity-access/domain/model/role-name.js';

const identityAccessApi = new IdentityAccessApi();

const permissionDefinitions = [
    {
        key: 'roles-permissions.permissions.manage-administrators',
        resource: 'administrators',
        action: 'manage',
        description: 'Manage administrators',
    },
    {key: 'roles-permissions.permissions.manage-users', resource: 'users', action: 'manage', description: 'Manage users'},
    {key: 'roles-permissions.permissions.manage-assets', resource: 'assets', action: 'manage', description: 'Manage assets'},
    {key: 'roles-permissions.permissions.view-reports', resource: 'reports', action: 'view', description: 'View reports'},
    {key: 'roles-permissions.permissions.resolve-alerts', resource: 'alerts', action: 'update', description: 'Resolve alerts'},
    {key: 'roles-permissions.permissions.monitor-assets', resource: 'monitoring', action: 'view', description: 'Monitor assets'},
    {key: 'roles-permissions.permissions.read-only', resource: 'workspace', action: 'view', description: 'Read only'},
];
const availablePermissionKeys = permissionDefinitions.map(definition => definition.key);
const manageAdministratorsPermissionKey = 'roles-permissions.permissions.manage-administrators';
const manageUsersPermissionKey = 'roles-permissions.permissions.manage-users';
const manageAssetsPermissionKey = 'roles-permissions.permissions.manage-assets';
const monitorAssetsPermissionKey = 'roles-permissions.permissions.monitor-assets';

/**
 * Pinia store that coordinates identity access application state and use cases.
 *
 * @returns {import('pinia').StoreDefinition}
 */
const useIdentityAccessStore = defineStore('identity-access', () => {
    const users = ref([]);
    const organizations = ref([]);
    const roles = ref([]);
    const errors = ref([]);
    const loading = ref(false);
    const usersLoaded = ref(false);
    const organizationsLoaded = ref(false);
    const rolesLoaded = ref(false);
    const currentUser = ref(null);
    const currentOrganization = ref(null);
    const currentRole = ref(null);
    const rolePermissionKeysByRoleId = ref({});
    const userCount = computed(() => users.value.length);

    /**
     * Loads users from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchUsers() {
        const response = await identityAccessApi.getUsers();
        users.value = UserAssembler.toEntitiesFromResponse(response);
        usersLoaded.value = true;
        return users.value;
    }

    /**
     * Loads organizations from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchOrganizations() {
        const response = await identityAccessApi.getOrganizations();
        organizations.value = OrganizationAssembler.toEntitiesFromResponse(response);
        organizationsLoaded.value = true;
        return organizations.value;
    }

    /**
     * Loads roles from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchRoles() {
        const response = await identityAccessApi.getRoles();
        roles.value = RoleAssembler.toEntitiesFromResponse(response);
        rolesLoaded.value = true;
        initializeRolePermissions(roles.value);
        return roles.value;
    }

    /**
     * Loads access data from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchAccessData() {
        loading.value = true;
        errors.value = [];
        try {
            const [loadedUsers, loadedRoles, loadedOrganizations] = await Promise.all([
                fetchUsers(),
                fetchRoles(),
                fetchOrganizations(),
            ]);
            setCurrentContextFrom(loadedUsers, loadedRoles, loadedOrganizations);
            return {users: loadedUsers, roles: loadedRoles, organizations: loadedOrganizations};
        } catch (error) {
            errors.value.push(error);
            throw error;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Handles set current context behavior in the identity access context.
     *
     * @param {*} user
     * @param {*} availableRoles
     * @param {*} availableOrganizations
     * @returns {void}
     */
    function setCurrentContext(user, availableRoles = roles.value, availableOrganizations = organizations.value) {
        currentUser.value = user;
        currentRole.value = availableRoles.find(role => role.id === user?.roleId) ?? null;
        currentOrganization.value = availableOrganizations.find(organization => organization.id === user?.organizationId) ?? null;
    }

    /**
     * Handles set current context from behavior in the identity access context.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @param {*} availableOrganizations
     * @returns {void}
     */
    function setCurrentContextFrom(availableUsers = users.value, availableRoles = roles.value, availableOrganizations = organizations.value) {
        const user = currentUserFrom(availableUsers);
        if (user) setCurrentContext(user, availableRoles, availableOrganizations);
        initializeRolePermissions(availableRoles);
    }

    /**
     * Handles clear current user behavior in the identity access context.
     *
     * @returns {void}
     */
    function clearCurrentUser() {
        currentUser.value = null;
        currentRole.value = null;
        currentOrganization.value = null;
    }

    /**
     * Handles current user from behavior in the identity access context.
     *
     * @param {*} availableUsers
     * @returns {*}
     */
    function currentUserFrom(availableUsers = users.value) {
        if (currentUser.value) {
            const selected = availableUsers.find(user => user.id === currentUser.value.id);
            if (selected) return selected;
        }
        return availableUsers.find(user => user.id === 1) ?? availableUsers[0] ?? null;
    }

    /**
     * Handles current organization id from behavior in the identity access context.
     *
     * @param {*} availableUsers
     * @returns {*}
     */
    function currentOrganizationIdFrom(availableUsers = users.value) {
        return currentUserFrom(availableUsers)?.organizationId ?? null;
    }

    /**
     * Handles current organization name from behavior in the identity access context.
     *
     * @param {*} availableUsers
     * @param {*} availableOrganizations
     * @returns {string}
     */
    function currentOrganizationNameFrom(availableUsers = users.value, availableOrganizations = organizations.value) {
        const organizationId = currentOrganizationIdFrom(availableUsers);
        const organization = availableOrganizations.find(current => current.id === organizationId);
        return organization?.commercialName || currentOrganization.value?.commercialName || 'ColdTrace';
    }

    /**
     * Handles current user name from behavior in the identity access context.
     *
     * @param {*} availableUsers
     * @returns {string}
     */
    function currentUserNameFrom(availableUsers = users.value) {
        return currentUserFrom(availableUsers)?.fullName || currentUser.value?.fullName || 'ColdTrace';
    }

    /**
     * Handles current role from behavior in the identity access context.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {*}
     */
    function currentRoleFrom(availableUsers = users.value, availableRoles = roles.value) {
        const user = currentUserFrom(availableUsers);
        return availableRoles.find(role => role.id === user?.roleId);
    }

    /**
     * Handles current role label key from behavior in the identity access context.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {string}
     */
    function currentRoleLabelKeyFrom(availableUsers = users.value, availableRoles = roles.value) {
        return roleLabelKey(currentRoleFrom(availableUsers, availableRoles));
    }

    /**
     * Handles initialize role permissions behavior in the identity access context.
     *
     * @param {*} availableRoles
     * @returns {*}
     */
    function initializeRolePermissions(availableRoles = roles.value) {
        rolePermissionKeysByRoleId.value = availableRoles.reduce((state, role) => ({
            ...state,
            [role.id]: permissionKeysFromRole(role),
        }), {});
    }

    /**
     * Handles permission keys for role behavior in the identity access context.
     *
     * @param {*} role
     * @returns {string}
     */
    function permissionKeysForRole(role) {
        if (!role) return ['roles-permissions.permissions.none'];
        const permissionKeys = rolePermissionKeysByRoleId.value[role.id] ?? permissionKeysFromRole(role);
        return permissionKeys.length ? permissionKeys : ['roles-permissions.permissions.none'];
    }

    /**
     * Handles permission keys from role behavior in the identity access context.
     *
     * @param {*} role
     * @returns {string}
     */
    function permissionKeysFromRole(role) {
        const keys = (role?.permissions ?? [])
            .map(permission => permissionKeyFrom(permission))
            .filter(permissionKey => permissionKey !== null);
        return orderPermissionKeys(keys);
    }

    /**
     * Handles permission key from behavior in the identity access context.
     *
     * @param {*} permission
     * @returns {string}
     */
    function permissionKeyFrom(permission) {
        if (availablePermissionKeys.includes(permission.description)) {
            return permission.description;
        }
        return permissionDefinitions.find(definition =>
            definition.resource === permission.resource && definition.action === permission.action,
        )?.key ?? null;
    }

    /**
     * Determines whether permission selected is true.
     *
     * @param {*} role
     * @param {string} permissionKey
     * @returns {boolean}
     */
    function isPermissionSelected(role, permissionKey) {
        return permissionKeysForRole(role).includes(permissionKey);
    }

    /**
     * Determines whether administrator role is true.
     *
     * @param {*} role
     * @returns {boolean}
     */
    function isAdministratorRole(role) {
        return role?.name === RoleName.Administrator;
    }

    /**
     * Determines whether super administrator role is true.
     *
     * @param {*} role
     * @returns {boolean}
     */
    function isSuperAdministratorRole(role) {
        return role?.name === RoleName.SuperAdministrator;
    }

    /**
     * Determines whether operations manager role is true.
     *
     * @param {*} role
     * @returns {boolean}
     */
    function isOperationsManagerRole(role) {
        return role?.name === RoleName.OperationsManager;
    }

    /**
     * Determines whether manage role permissions is available.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canManageRolePermissions(availableUsers = users.value, availableRoles = roles.value) {
        const role = currentRoleFrom(availableUsers, availableRoles);
        return isSuperAdministratorRole(role) || isAdministratorRole(role);
    }

    /**
     * Determines whether manage access is available.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canManageAccess(availableUsers = users.value, availableRoles = roles.value) {
        return canManageRolePermissions(availableUsers, availableRoles);
    }

    /**
     * Determines whether manage users is available.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canManageUsers(availableUsers = users.value, availableRoles = roles.value) {
        return permissionKeysForRole(currentRoleFrom(availableUsers, availableRoles)).includes(manageUsersPermissionKey);
    }

    /**
     * Determines whether manage assets is available.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canManageAssets(availableUsers = users.value, availableRoles = roles.value) {
        return permissionKeysForRole(currentRoleFrom(availableUsers, availableRoles)).includes(manageAssetsPermissionKey);
    }

    /**
     * Determines whether monitor assets is available.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canMonitorAssets(availableUsers = users.value, availableRoles = roles.value) {
        return permissionKeysForRole(currentRoleFrom(availableUsers, availableRoles)).includes(monitorAssetsPermissionKey);
    }

    /**
     * Determines whether manage administrators is available.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canManageAdministrators(availableUsers = users.value, availableRoles = roles.value) {
        return isSuperAdministratorRole(currentRoleFrom(availableUsers, availableRoles));
    }

    /**
     * Determines whether delete user is available.
     *
     * @param {*} user
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canDeleteUser(user, availableUsers = users.value, availableRoles = roles.value) {
        if (!user || currentUserFrom(availableUsers)?.id === user.id) return false;

        const actorRole = currentRoleFrom(availableUsers, availableRoles);
        const targetRole = availableRoles.find(role => role.id === user.roleId);
        if (isSuperAdministratorRole(actorRole)) return true;
        if (!isAdministratorRole(actorRole)) return false;

        return !isSuperAdministratorRole(targetRole) && !isAdministratorRole(targetRole);
    }

    /**
     * Determines whether delete asset resources is available.
     *
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canDeleteAssetResources(availableUsers = users.value, availableRoles = roles.value) {
        const role = currentRoleFrom(availableUsers, availableRoles);
        return isSuperAdministratorRole(role) || isAdministratorRole(role) || isOperationsManagerRole(role);
    }

    /**
     * Determines whether assign role is available.
     *
     * @param {*} role
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canAssignRole(role, availableUsers = users.value, availableRoles = roles.value) {
        if (!role || !canManageUsers(availableUsers, availableRoles) || isSuperAdministratorRole(role)) {
            return false;
        }
        if (isAdministratorRole(role)) {
            return canManageAdministrators(availableUsers, availableRoles);
        }
        return true;
    }

    /**
     * Determines whether manage user role is available.
     *
     * @param {*} user
     * @param {*} availableUsers
     * @param {*} availableRoles
     * @returns {boolean}
     */
    function canManageUserRole(user, availableUsers = users.value, availableRoles = roles.value) {
        if (!user || !canManageUsers(availableUsers, availableRoles)) {
            return false;
        }
        const role = availableRoles.find(current => current.id === user.roleId);
        if (isSuperAdministratorRole(role)) return false;
        if (isAdministratorRole(role)) return canManageAdministrators(availableUsers, availableRoles);
        return true;
    }

    /**
     * Handles role label key behavior in the identity access context.
     *
     * @param {*} role
     * @returns {string}
     */
    function roleLabelKey(role) {
        return role ? `roles-permissions.roles.${role.name}` : 'roles-permissions.roles.unassigned';
    }

    /**
     * Determines whether permission toggle disabled is true.
     *
     * @param {*} role
     * @param {string} permissionKey
     * @returns {boolean}
     */
    function isPermissionToggleDisabled(role, permissionKey) {
        if (isSuperAdministratorRole(role) || isAdministratorRole(role)) return true;
        if (permissionKey === manageAdministratorsPermissionKey) return true;
        const selectedKeys = permissionKeysForRole(role).filter(key => key !== 'roles-permissions.permissions.none');
        return !isPermissionSelected(role, permissionKey) && selectedKeys.length >= availablePermissionKeys.length - 1;
    }

    /**
     * Handles sign in behavior in the identity access context.
     *
     * @param {string} email
     * @param {string} password
     * @returns {Promise<*>}
     */
    async function signIn(email, password) {
        const validPassword = 'ColdTrace123';
        const revokedAccessEmail = 'revoked@coldtrace.com';
        const normalizedEmail = email.trim().toLowerCase();
        const accessData = await fetchAccessData();

        if (normalizedEmail === revokedAccessEmail) {
            return 'revoked-access';
        }

        const user = accessData.users.find(current => current.email.toLowerCase() === normalizedEmail);
        if (!user || password !== validPassword) {
            return 'invalid-credentials';
        }

        setCurrentContext(user, accessData.roles, accessData.organizations);
        return 'success';
    }

    /**
     * Creates account in the identity access context.
     *
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function createAccount({organizationName, fullName, email}) {
        const normalizedEmail = email.trim().toLowerCase();
        const accessData = await fetchAccessData();
        const duplicateEmail = accessData.users.some(user => user.email.toLowerCase() === normalizedEmail);

        if (duplicateEmail) {
            return {status: 'duplicate-email'};
        }

        const [firstName, ...lastNameParts] = fullName.trim().replace(/\s+/g, ' ').split(' ');
        const nextOrganizationId = Math.max(...accessData.organizations.map(organization => organization.id), 0) + 1;
        const nextUserId = Math.max(...accessData.users.map(user => user.id), 0) + 1;
        const creatorRole = accessData.roles.find(role => role.name === RoleName.SuperAdministrator);

        if (!creatorRole) {
            return {status: 'server-error'};
        }

        const organization = new Organization({
            id: nextOrganizationId,
            legalName: organizationName,
            commercialName: organizationName,
            taxId: '',
            contactEmail: normalizedEmail,
        });
        const createdOrganizationResponse = await identityAccessApi.createOrganization(
            OrganizationAssembler.toResourceFromEntity(organization),
        );
        const createdOrganization = OrganizationAssembler.toEntityFromResource(createdOrganizationResponse.data);

        const user = new User({
            id: nextUserId,
            uuid: `USR-${nextUserId}`,
            organizationUserId: 1,
            firstName,
            lastName: lastNameParts.join(' '),
            email: normalizedEmail,
            organizationId: createdOrganization.id,
            roleId: creatorRole.id,
        });
        const createdUserResponse = await identityAccessApi.createUser(UserAssembler.toResourceFromEntity(user));
        const createdUser = UserAssembler.toEntityFromResource(createdUserResponse.data);

        users.value.push(createdUser);
        organizations.value.push(createdOrganization);
        setCurrentContext(createdUser, accessData.roles, [...accessData.organizations, createdOrganization]);
        return {status: 'success', user: createdUser};
    }

    /**
     * Creates organization user in the identity access context.
     *
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function createOrganizationUser({fullName, email, roleId}) {
        const organizationId = currentOrganizationIdFrom();
        const selectedRole = roles.value.find(role => role.id === Number(roleId));

        if (!canManageUsers() || !canAssignRole(selectedRole) || !organizationId) {
            return {status: 'invalid-role'};
        }

        const normalizedEmail = email.trim().toLowerCase();
        await fetchUsers();
        const duplicateEmail = users.value.some(user => user.email.toLowerCase() === normalizedEmail);
        if (duplicateEmail) return {status: 'duplicate-email'};

        const [firstName, ...lastNameParts] = fullName.trim().replace(/\s+/g, ' ').split(' ');
        const nextId = Math.max(...users.value.map(user => user.id), 0) + 1;
        const nextOrganizationUserId = Math.max(
            ...users.value
                .filter(user => user.organizationId === organizationId)
                .map(user => user.organizationUserId),
            0,
        ) + 1;
        const user = new User({
            id: nextId,
            uuid: `USR-${nextId}`,
            organizationUserId: nextOrganizationUserId,
            firstName,
            lastName: lastNameParts.join(' '),
            email: normalizedEmail,
            organizationId,
            roleId: Number(roleId),
        });
        const response = await identityAccessApi.createUser(UserAssembler.toResourceFromEntity(user));
        const createdUser = UserAssembler.toEntityFromResource(response.data);
        users.value.push(createdUser);
        return {status: 'success', user: createdUser};
    }

    /**
     * Updates user role in the identity access context.
     *
     * @param {*} user
     * @param {number|string} roleId
     * @returns {Promise<*>}
     */
    async function updateUserRole(user, roleId) {
        const updatedUser = new User({...user, roleId: Number(roleId)});
        const response = await identityAccessApi.updateUser(UserAssembler.toResourceFromEntity(updatedUser));
        const savedUser = UserAssembler.toEntityFromResource(response.data);
        users.value = users.value.map(current => current.id === savedUser.id ? savedUser : current);
        return savedUser;
    }

    /**
     * Deletes user from the identity access context.
     *
     * @param {*} user
     * @returns {Promise<*>}
     */
    async function deleteUser(user) {
        if (!canDeleteUser(user)) {
            return {status: 'forbidden'};
        }

        const previousUsers = users.value;
        users.value = users.value.filter(current => current.id !== user.id);

        try {
            await identityAccessApi.deleteUser(user.id);
            return {status: 'success'};
        } catch (error) {
            if (await userWasDeletedRemotely(user.id)) {
                return {status: 'success'};
            }

            users.value = previousUsers;
            throw error;
        }
    }

    /**
     * Handles user was deleted remotely behavior in the identity access context.
     *
     * @param {number|string} userId
     * @returns {Promise<*>}
     */
    async function userWasDeletedRemotely(userId) {
        try {
            const response = await identityAccessApi.getUsers();
            const remoteUsers = UserAssembler.toEntitiesFromResponse(response);
            return !remoteUsers.some(user => user.id === userId);
        } catch {
            return false;
        }
    }

    /**
     * Toggles role permission.
     *
     * @param {*} role
     * @param {string} permissionKey
     * @param {boolean} checked
     * @returns {Promise<*>}
     */
    async function toggleRolePermission(role, permissionKey, checked) {
        if (isPermissionToggleDisabled(role, permissionKey)) return role;

        const previousKeys = permissionKeysForRole(role).filter(key => key !== 'roles-permissions.permissions.none');
        const nextKeys = orderPermissionKeys(
            checked ? [...previousKeys, permissionKey] : previousKeys.filter(key => key !== permissionKey),
        );
        const updatedRole = roleWithPermissionKeys(role, nextKeys);
        setPermissionKeysForRole(role.id, nextKeys);
        updateRoleState(updatedRole);

        try {
            const response = await identityAccessApi.updateRole(RoleAssembler.toResourceFromEntity(updatedRole));
            const savedRole = RoleAssembler.toEntityFromResource(response.data);
            setPermissionKeysForRole(savedRole.id, permissionKeysFromRole(savedRole));
            updateRoleState(savedRole);
            return savedRole;
        } catch (error) {
            setPermissionKeysForRole(role.id, previousKeys);
            updateRoleState(roleWithPermissionKeys(role, previousKeys));
            throw error;
        }
    }

    /**
     * Handles permission definition for behavior in the identity access context.
     *
     * @param {string} permissionKey
     * @returns {*}
     */
    function permissionDefinitionFor(permissionKey) {
        return permissionDefinitions.find(definition => definition.key === permissionKey) ??
            permissionDefinitions[permissionDefinitions.length - 1];
    }

    /**
     * Handles role with permission keys behavior in the identity access context.
     *
     * @param {*} role
     * @param {string} permissionKeys
     * @returns {string}
     */
    function roleWithPermissionKeys(role, permissionKeys) {
        return new Role({
            id: role.id,
            name: role.name,
            label: role.label,
            permissions: orderPermissionKeys(permissionKeys).map((permissionKey, index) => {
                const definition = permissionDefinitionFor(permissionKey);
                return new Permission({
                    id: index + 1,
                    resource: definition.resource,
                    action: definition.action,
                    description: definition.description,
                });
            }),
        });
    }

    /**
     * Handles order permission keys behavior in the identity access context.
     *
     * @param {string} permissionKeys
     * @returns {string}
     */
    function orderPermissionKeys(permissionKeys) {
        return availablePermissionKeys.filter(permissionKey => permissionKeys.includes(permissionKey));
    }

    /**
     * Handles set permission keys for role behavior in the identity access context.
     *
     * @param {number|string} roleId
     * @param {string} permissionKeys
     * @returns {void}
     */
    function setPermissionKeysForRole(roleId, permissionKeys) {
        rolePermissionKeysByRoleId.value = {
            ...rolePermissionKeysByRoleId.value,
            [roleId]: orderPermissionKeys(permissionKeys),
        };
    }

    /**
     * Updates role state in the identity access context.
     *
     * @param {*} role
     * @returns {void}
     */
    function updateRoleState(role) {
        roles.value = roles.value.map(current => current.id === role.id ? role : current);
    }

    return {
        users,
        organizations,
        roles,
        errors,
        loading,
        usersLoaded,
        organizationsLoaded,
        rolesLoaded,
        currentUser,
        currentOrganization,
        currentRole,
        rolePermissionKeysByRoleId,
        userCount,
        availablePermissionKeys,
        fetchAccessData,
        signIn,
        createAccount,
        createOrganizationUser,
        updateUserRole,
        deleteUser,
        toggleRolePermission,
        setCurrentContext,
        setCurrentContextFrom,
        clearCurrentUser,
        currentUserFrom,
        currentOrganizationIdFrom,
        currentOrganizationNameFrom,
        currentUserNameFrom,
        currentRoleFrom,
        currentRoleLabelKeyFrom,
        permissionKeysForRole,
        isPermissionSelected,
        isPermissionToggleDisabled,
        isAdministratorRole,
        isSuperAdministratorRole,
        isOperationsManagerRole,
        canManageAccess,
        canManageRolePermissions,
        canManageUsers,
        canManageAssets,
        canMonitorAssets,
        canDeleteUser,
        canDeleteAssetResources,
        canAssignRole,
        canManageUserRole,
        roleLabelKey,
    };
});

export default useIdentityAccessStore;
