import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {IdentityAccessApi} from '@/identity-access/infrastructure/identity-access-api.js';
import {OrganizationAssembler} from '@/identity-access/infrastructure/organization.assembler.js';
import {RoleAssembler} from '@/identity-access/infrastructure/role.assembler.js';
import {UserAssembler} from '@/identity-access/infrastructure/user.assembler.js';
import {authSession} from '@/shared/infrastructure/auth-session.js';
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
    const session = ref(authSession.current());
    const currentUser = ref(null);
    const currentOrganization = ref(null);
    const currentRole = ref(null);
    const rolePermissionKeysByRoleId = ref({});
    const userCount = computed(() => users.value.length);
    const sessionToken = computed(() => session.value?.token ?? null);

    restoreSessionContext();

    /**
     * Loads users from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchUsers(organizationId = currentOrganizationIdFrom()) {
        const response = await identityAccessApi.getUsers(organizationId);
        users.value = UserAssembler.toEntitiesFromResponse(response);
        usersLoaded.value = !!organizationId;
        return users.value;
    }

    /**
     * Loads users from one organization without replacing state.
     *
     * @param {number|string} organizationId
     * @returns {Promise<User[]>}
     */
    async function fetchUsersForOrganization(organizationId) {
        const response = await identityAccessApi.getUsersForOrganization(organizationId);
        return UserAssembler.toEntitiesFromResponse(response);
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
            const [loadedRoles, loadedOrganizations] = await Promise.all([
                fetchRoles(),
                fetchOrganizations(),
            ]);
            const organizationUsers = await initialUsersForCurrentContext(loadedOrganizations);
            const loadedUsers = organizationUsers.users;

            users.value = loadedUsers;
            usersLoaded.value = organizationUsers.organization !== null;
            if (organizationUsers.organization && !currentOrganization.value) currentOrganization.value = organizationUsers.organization;

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
        currentRole.value = availableRoles.find(role => role.id === Number(user?.roleId)) ?? null;
        currentOrganization.value = availableOrganizations.find(organization => organization.id === Number(user?.organizationId)) ?? null;
    }

    /**
     * Persists the backend session and activates the authenticated user.
     *
     * @param {string} token
     * @param {*} user
     * @returns {void}
     */
    function setAuthenticatedSession(token, user) {
        session.value = authSession.set(token, {
            id: user.id,
            fullName: user.fullName,
            organizationId: user.organizationId,
            roleId: user.roleId,
        });
        currentUser.value = user;
    }

    /**
     * Restores the persisted backend session into the store context.
     *
     * @returns {void}
     */
    function restoreSessionContext() {
        const restoredUser = session.value?.user;
        if (!restoredUser) return;

        currentUser.value = {
            id: Number(restoredUser.id),
            fullName: restoredUser.fullName,
            organizationId: Number(restoredUser.organizationId),
            roleId: restoredUser.roleId === undefined ? null : Number(restoredUser.roleId),
        };
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
     * Resolves initial users for the current session or the first organization with users.
     *
     * @param {Organization[]} availableOrganizations
     * @returns {Promise<{organization: Organization|null, users: User[]}>}
     */
    async function initialUsersForCurrentContext(availableOrganizations) {
        const currentOrganizationId = currentUser.value?.organizationId ?? currentOrganization.value?.id;
        if (currentOrganizationId) {
            return {
                organization: availableOrganizations.find(organization => organization.id === Number(currentOrganizationId)) ?? null,
                users: await fetchUsersForOrganization(currentOrganizationId),
            };
        }

        for (const organization of availableOrganizations) {
            const organizationUsers = await fetchUsersForOrganization(organization.id);
            if (organizationUsers.length) return {organization, users: organizationUsers};
        }

        return {organization: availableOrganizations[0] ?? null, users: []};
    }

    /**
     * Handles clear current user behavior in the identity access context.
     *
     * @returns {void}
     */
    function clearCurrentUser() {
        authSession.clear();
        session.value = null;
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
        const organization = availableOrganizations.find(current => current.id === Number(organizationId));
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
        return availableRoles.find(role => role.id === Number(user?.roleId));
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
        const normalizedEmail = email.trim().toLowerCase();
        loading.value = true;
        errors.value = [];
        try {
            const authenticated = await identityAccessApi.signIn({email: normalizedEmail, password});
            await completeAuthenticatedSession(authenticated);
            return 'success';
        } catch (error) {
            return signInFeedbackFromError(error);
        } finally {
            loading.value = false;
        }
    }

    /**
     * Completes session setup after backend authentication succeeds.
     *
     * @param {{token: string, user: User}} authenticated
     * @returns {Promise<void>}
     */
    async function completeAuthenticatedSession(authenticated) {
        if (!authenticated?.token || !authenticated?.user?.id) {
            throw new Error('Invalid authentication response.');
        }

        setAuthenticatedSession(authenticated.token, authenticated.user);
        const [loadedRoles, loadedOrganizations, organizationUsers] = await Promise.all([
            fetchRoles(),
            fetchOrganizations(),
            fetchUsersForOrganization(authenticated.user.organizationId),
        ]);
        const usersWithAuthenticated = ensureAuthenticatedUser(organizationUsers, authenticated.user);

        users.value = usersWithAuthenticated;
        usersLoaded.value = true;
        setCurrentContext(authenticated.user, loadedRoles, loadedOrganizations);
    }

    /**
     * Ensures the authenticated user exists in the active organization users collection.
     *
     * @param {User[]} availableUsers
     * @param {User} authenticatedUser
     * @returns {User[]}
     */
    function ensureAuthenticatedUser(availableUsers, authenticatedUser) {
        return availableUsers.some(user => user.id === authenticatedUser.id)
            ? availableUsers
            : [...availableUsers, authenticatedUser];
    }

    /**
     * Maps backend authentication errors to sign-in feedback states.
     *
     * @param {*} error
     * @returns {string}
     */
    function signInFeedbackFromError(error) {
        if (error.response?.status === 401) return 'invalid-credentials';
        if (error.response?.status === 403) return 'revoked-access';
        return 'server-error';
    }

    /**
     * Handles social provider sign-in through the backend.
     *
     * @param {'google'|'apple'} provider
     * @param {*} credential
     * @returns {Promise<string>}
     */
    async function signInWithSocialProvider(provider, credential) {
        loading.value = true;
        errors.value = [];

        try {
            const response = provider === 'google'
                ? await identityAccessApi.signInWithGoogle(credential)
                : await identityAccessApi.signInWithApple(credential);
            await completeAuthenticatedSession(response.data);
            return 'success';
        } catch (error) {
            return socialSignInFeedbackFromError(error);
        } finally {
            loading.value = false;
        }
    }

    /**
     * Validates a social provider profile for organization onboarding.
     *
     * @param {'google'|'apple'} provider
     * @param {*} credential
     * @returns {Promise<*>}
     */
    async function previewSocialIdentityProfile(provider, credential) {
        const response = await identityAccessApi.getSocialIdentityProfile(provider, credential);
        const resource = response.data ?? {};

        return {
            idToken: read(resource, ['idToken', 'IdToken'], credential.idToken ?? ''),
            email: read(resource, ['email', 'Email'], ''),
            fullName: read(resource, ['fullName', 'FullName'], ''),
        };
    }

    /**
     * Creates an organization and first user with a social provider.
     *
     * @param {'google'|'apple'} provider
     * @param {*} credential
     * @param {*} account
     * @returns {Promise<{status: string, user?: *}>}
     */
    async function createSocialAccount(provider, credential, account) {
        loading.value = true;
        errors.value = [];

        try {
            const response = await identityAccessApi.createSocialOrganizationSignUp(provider, {
                ...(credential.idToken ? {idToken: credential.idToken} : {}),
                ...(credential.authorizationCode ? {authorizationCode: credential.authorizationCode} : {}),
                ...(credential.redirectUri ? {redirectUri: credential.redirectUri} : {}),
                ...(credential.nonce ? {nonce: credential.nonce} : {}),
                organizationName: account.organizationName.trim(),
                fullName: account.fullName.trim(),
            });
            await completeAuthenticatedSession(response.data);
            return {status: 'success', user: response.data.user};
        } catch (error) {
            return {status: socialSignUpFeedbackFromError(error)};
        } finally {
            loading.value = false;
        }
    }

    /**
     * Requests a generic backend-owned password recovery response.
     *
     * @param {string} email
     * @returns {Promise<*>}
     */
    async function requestPasswordReset(email) {
        const response = await identityAccessApi.requestPasswordReset(email.trim().toLowerCase());
        if (response.status !== 202 || response.data?.accepted === false) {
            throw new Error('Password reset request was not accepted.');
        }
        return response.data;
    }

    /**
     * Creates account in the identity access context.
     *
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function createAccount({organizationName, fullName, email, password}) {
        const normalizedEmail = email.trim().toLowerCase();
        const [firstName, ...lastNameParts] = fullName.trim().replace(/\s+/g, ' ').split(' ');

        try {
            await identityAccessApi.createOrganizationSignUp({
                legalName: organizationName,
                commercialName: organizationName,
                taxId: '',
                contactEmail: normalizedEmail,
                firstName,
                lastName: lastNameParts.join(' '),
                email: normalizedEmail,
                password,
            });
            const authenticated = await identityAccessApi.signIn({
                email: normalizedEmail,
                password,
            });
            await completeAuthenticatedSession(authenticated);
            return {status: 'success', user: authenticated.user};
        } catch (error) {
            if (error.response?.status === 409) return {status: 'duplicate-email'};
            throw error;
        }
    }

    /**
     * Creates organization user in the identity access context.
     *
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function createOrganizationUser({fullName, email, password, roleId}) {
        const organizationId = currentOrganizationIdFrom();
        const selectedRole = roles.value.find(role => role.id === Number(roleId));

        if (!canManageUsers() || !canAssignRole(selectedRole) || !organizationId) {
            return {status: 'invalid-role'};
        }

        const normalizedEmail = email.trim().toLowerCase();
        await fetchUsers(organizationId);
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
        const response = await identityAccessApi.createUser(
            organizationId,
            UserAssembler.toResourceFromEntity(user),
            password,
        );
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
        const response = await identityAccessApi.updateUser(
            updatedUser.organizationId,
            UserAssembler.toResourceFromEntity(updatedUser),
        );
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
            if (await userWasDeletedRemotely(user.organizationId, user.id)) {
                return {status: 'success'};
            }

            users.value = previousUsers;
            throw error;
        }
    }

    /**
     * Handles user was deleted remotely behavior in the identity access context.
     *
     * @param {number|string} organizationId
     * @param {number|string} userId
     * @returns {Promise<*>}
     */
    async function userWasDeletedRemotely(organizationId, userId) {
        try {
            const response = await identityAccessApi.getUsers(organizationId);
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
     * Maps backend social sign-in errors to UI feedback.
     *
     * @param {*} error
     * @returns {string}
     */
    function socialSignInFeedbackFromError(error) {
        const code = error?.response?.data?.code ?? error?.response?.data?.Code;

        if (error?.response?.status === 401 || code === 'PROVIDER_VALIDATION_FAILED') {
            return 'social-validation-failed';
        }

        if (error?.response?.status === 422 || code === 'SOCIAL_IDENTITY_REQUIRES_ONBOARDING') {
            return 'onboarding-required';
        }

        if (error?.response?.status === 503 || code === 'SOCIAL_PROVIDER_CONFIGURATION_MISSING') {
            return 'social-unavailable';
        }

        return 'server-error';
    }

    /**
     * Maps backend social sign-up errors to UI feedback.
     *
     * @param {*} error
     * @returns {string}
     */
    function socialSignUpFeedbackFromError(error) {
        const code = error?.response?.data?.code ?? error?.response?.data?.Code;

        if (error?.response?.status === 409 || code?.endsWith('_CONFLICT')) {
            return 'duplicate-email';
        }

        if (error?.response?.status === 401 || code === 'PROVIDER_VALIDATION_FAILED') {
            return 'social-invalid';
        }

        if (error?.response?.status === 503 || code === 'SOCIAL_PROVIDER_CONFIGURATION_MISSING') {
            return 'social-unavailable';
        }

        return 'server-error';
    }

    /**
     * Reads a value from a resource using possible keys.
     *
     * @param {*} source
     * @param {string[]} keys
     * @param {*} fallback
     * @returns {*}
     */
    function read(source, keys, fallback = undefined) {
        if (!source || typeof source !== 'object') return fallback;

        for (const key of keys) {
            if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
        }

        return fallback;
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
        sessionToken,
        currentUser,
        currentOrganization,
        currentRole,
        rolePermissionKeysByRoleId,
        userCount,
        availablePermissionKeys,
        fetchAccessData,
        signIn,
        requestPasswordReset,
        signInWithSocialProvider,
        previewSocialIdentityProfile,
        createAccount,
        createSocialAccount,
        createOrganizationUser,
        updateUserRole,
        deleteUser,
        toggleRolePermission,
        setAuthenticatedSession,
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
