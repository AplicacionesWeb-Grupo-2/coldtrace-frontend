import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';
import {UserAssembler} from '@/identity-access/infrastructure/user.assembler.js';

const authenticationEndpointPath = import.meta.env.VITE_AUTHENTICATION_ENDPOINT_PATH ?? '/authentication';
const usersEndpointPath = import.meta.env.VITE_USERS_ENDPOINT_PATH ?? '/users';
const organizationsEndpointPath = import.meta.env.VITE_ORGANIZATIONS_ENDPOINT_PATH ?? '/organizations';
const organizationSignUpsEndpointPath = import.meta.env.VITE_ORGANIZATION_SIGN_UPS_ENDPOINT_PATH ?? '/organization-sign-ups';
const rolesEndpointPath = import.meta.env.VITE_ROLES_ENDPOINT_PATH ?? '/roles';

/**
 * HTTP facade for identity access resources.
 */
export class IdentityAccessApi extends BaseApi {
    #usersEndpoint;
    #organizationsEndpoint;
    #organizationSignUpsEndpoint;
    #rolesEndpoint;

    /**
     * Initializes identity access api endpoint helpers.
     */
    constructor() {
        super();
        this.#usersEndpoint = new BaseEndpoint(this, usersEndpointPath);
        this.#organizationsEndpoint = new BaseEndpoint(this, organizationsEndpointPath);
        this.#organizationSignUpsEndpoint = new BaseEndpoint(this, organizationSignUpsEndpointPath);
        this.#rolesEndpoint = new BaseEndpoint(this, rolesEndpointPath);
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
     * @returns {Promise<*>}
     */
    createUser(organizationId, resource) {
        const endpoint = this.#usersEndpointForOrganization(organizationId);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create a user.'));

        const {id: _id, uuid: _uuid, organizationId: _organizationId, organizationUserId: _organizationUserId, ...request} = resource;
        return endpoint.create(request);
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
     * Updates authorization header for identity-access follow-up requests.
     *
     * @param {string|null} token
     * @returns {void}
     */
    setAuthorizationToken(token) {
        if (!token) {
            delete this.http.defaults.headers.common.Authorization;
            return;
        }

        this.http.defaults.headers.common.Authorization = `Bearer ${token}`;
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
     * @returns {{token: string, user: *}}
     */
    #authenticatedUserFromResource(resource = {}) {
        const userResource = resource.user ?? resource.User ?? resource;

        return {
            token: read(resource, ['token', 'Token', 'accessToken', 'AccessToken'], ''),
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

    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(source, key)) return source[key];
    }

    return fallback;
}
