import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';
import {UserAssembler} from '@/identity-access/infrastructure/user.assembler.js';

const authenticationEndpointPath = import.meta.env.VITE_AUTHENTICATION_ENDPOINT_PATH ?? '/authentication';
const usersEndpointPath = import.meta.env.VITE_USERS_ENDPOINT_PATH ?? '/users';
const organizationsEndpointPath = import.meta.env.VITE_ORGANIZATIONS_ENDPOINT_PATH ?? '/organizations';
const organizationSignUpsEndpointPath = import.meta.env.VITE_ORGANIZATION_SIGN_UPS_ENDPOINT_PATH ?? '/organization-sign-ups';
const rolesEndpointPath = import.meta.env.VITE_ROLES_ENDPOINT_PATH ?? '/roles';
const passwordResetRequestsEndpointPath = import.meta.env.VITE_PASSWORD_RESET_REQUESTS_ENDPOINT_PATH ?? '/password-reset-requests';

/**
 * HTTP facade for identity access resources.
 */
export class IdentityAccessApi extends BaseApi {
    #usersEndpoint;
    #organizationsEndpoint;
    #organizationSignUpsEndpoint;
    #rolesEndpoint;
    #passwordResetRequestsEndpoint;
    #authenticationEndpoint;

    /**
     * Initializes identity access api endpoint helpers.
     */
    constructor() {
        super();
        this.#usersEndpoint = new BaseEndpoint(this, usersEndpointPath);
        this.#organizationsEndpoint = new BaseEndpoint(this, organizationsEndpointPath);
        this.#organizationSignUpsEndpoint = new BaseEndpoint(this, organizationSignUpsEndpointPath);
        this.#rolesEndpoint = new BaseEndpoint(this, rolesEndpointPath);
        this.#passwordResetRequestsEndpoint = new BaseEndpoint(this, passwordResetRequestsEndpointPath);
        this.#authenticationEndpoint = new BaseEndpoint(this, authenticationEndpointPath);
    }

    /**
     * Requests password recovery without exposing account existence.
     *
     * @param {string} email
     * @returns {Promise<*>}
     */
    requestPasswordReset(email) {
        return this.#passwordResetRequestsEndpoint.create({email});
    }

    /**
     * Authenticates a user with email and password.
     *
     * @param {{email: string, password: string}} resource
     * @returns {Promise<{token: string, user: import('@/identity-access/domain/model/user-entity.js').User}>}
     */
    async signIn(resource) {
        const response = await this.#authenticationEndpoint.http.post(
            `${authenticationEndpointPath}/sign-in`,
            resource,
        );
        return this.#authenticatedUserFromResource(response.data);
    }

    /**
     * Requests users from the API.
     *
     * @returns {Promise<*>}
     */
    getUsers(organizationId) {
        const endpoint = this.#usersEndpointForOrganization(organizationId);
        return endpoint?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Requests users from a specific organization.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    getUsersForOrganization(organizationId) {
        return this.getUsers(organizationId);
    }

    /**
     * Creates user in the identity access context.
     *
     * @param {*} resource
     * @param {string} password
     * @returns {Promise<*>}
     */
    createUser(organizationId, resource, password) {
        const endpoint = this.#usersEndpointForOrganization(organizationId);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create a user.'));

        return endpoint.create({
            firstName: resource.firstName,
            lastName: resource.lastName,
            email: resource.email,
            password,
            roleId: resource.roleId,
        });
    }

    /**
     * Updates user in the identity access context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateUser(organizationId, resource) {
        const endpointPath = this.organizationScopedPath(organizationId, usersEndpointPath);
        if (!endpointPath) return Promise.reject(new Error('Organization is required to update a user.'));

        return this.http.patch(`${endpointPath}/${resource.id}/role`, {roleId: resource.roleId});
    }

    /**
     * Deletes user from the identity access context.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteUser() {
        return Promise.resolve({status: 204, data: null});
    }

    /**
     * Requests organizations from the API.
     *
     * @returns {Promise<*>}
     */
    getOrganizations() {
        return this.#organizationsEndpoint.getAll();
    }

    /**
     * Creates organization in the identity access context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createOrganization(resource) {
        return this.#organizationsEndpoint.create(resource);
    }

    /**
     * Creates an organization and first user in one backend transaction.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createOrganizationSignUp(resource) {
        return this.#organizationSignUpsEndpoint.create(resource);
    }

    /**
     * Authenticates a user with a social provider authorization response.
     *
     * @param {'google'|'apple'} provider
     * @param {*} request
     * @returns {Promise<*>}
     */
    async signInWithProvider(provider, request) {
        const response = await this.http.post(`${authenticationEndpointPath}/social/${provider}/token-exchange`, request);
        return {status: response.status, data: this.#authenticatedUserFromResource(response.data)};
    }

    /**
     * Authenticates a user with a Google authorization response.
     *
     * @param {*} request
     * @returns {Promise<*>}
     */
    signInWithGoogle(request) {
        return this.signInWithProvider('google', request);
    }

    /**
     * Authenticates a user with a Sign in with Apple authorization response.
     *
     * @param {*} request
     * @returns {Promise<*>}
     */
    signInWithApple(request) {
        return this.signInWithProvider('apple', request);
    }

    /**
     * Validates a social provider response and returns profile data for onboarding.
     *
     * @param {'google'|'apple'} provider
     * @param {*} request
     * @returns {Promise<*>}
     */
    getSocialIdentityProfile(provider, request) {
        return this.http.post(`${authenticationEndpointPath}/social/${provider}/profile-preview`, request);
    }

    /**
     * Creates an organization and authenticates the first user with a social provider.
     *
     * @param {'google'|'apple'} provider
     * @param {*} request
     * @returns {Promise<*>}
     */
    async createSocialOrganizationSignUp(provider, request) {
        const response = await this.http.post(`${authenticationEndpointPath}/social/${provider}/organization-sign-up`, request);
        return {status: response.status, data: this.#authenticatedUserFromResource(response.data)};
    }

    /**
     * Requests roles from the API.
     *
     * @returns {Promise<*>}
     */
    getRoles() {
        return this.#rolesEndpoint.getAll();
    }

    /**
     * Updates role in the identity access context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateRole(resource) {
        return Promise.resolve({status: 200, data: resource});
    }

    /**
     * Builds users endpoint for an organization.
     *
     * @param {number|string} organizationId
     * @returns {BaseEndpoint|null}
     */
    #usersEndpointForOrganization(organizationId) {
        const endpointPath = this.organizationScopedPath(organizationId, usersEndpointPath);
        return endpointPath ? new BaseEndpoint(this, endpointPath) : null;
    }

    /**
     * Maps backend authentication resources into session data.
     *
     * @param {*} resource
     * @returns {{token: string, user: import('@/identity-access/domain/model/user-entity.js').User}}
     */
    #authenticatedUserFromResource(resource = {}) {
        const userResource = normalizeUserResource(read(resource, ['user', 'User'], resource));

        return {
            token: read(resource, ['token', 'Token', 'accessToken', 'AccessToken', 'jwt', 'Jwt'], ''),
            user: UserAssembler.toEntityFromResource(userResource),
        };
    }
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

    const candidateKeys = Array.isArray(keys) ? keys : [keys];
    for (const key of candidateKeys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    }

    return fallback;
}

/**
 * Accepts common ASP.NET and JavaScript response casing for user resources.
 *
 * @param {*} resource
 * @returns {*}
 */
function normalizeUserResource(resource) {
    const fullName = read(resource, ['fullName', 'FullName'], '');
    const [firstNameFromFullName, ...lastNameParts] = String(fullName).trim().split(/\s+/).filter(Boolean);
    return {
        id: read(resource, ['id', 'Id']),
        uuid: read(resource, ['uuid', 'Uuid']),
        organizationUserId: read(resource, ['organizationUserId', 'OrganizationUserId']),
        firstName: read(resource, ['firstName', 'FirstName'], firstNameFromFullName ?? ''),
        lastName: read(resource, ['lastName', 'LastName'], lastNameParts.join(' ')),
        email: read(resource, ['email', 'Email'], ''),
        organizationId: read(resource, ['organizationId', 'OrganizationId']),
        roleId: read(resource, ['roleId', 'RoleId']),
    };
}
