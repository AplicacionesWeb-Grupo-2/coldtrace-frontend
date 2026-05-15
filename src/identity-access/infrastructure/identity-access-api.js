import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const usersEndpointPath = import.meta.env.VITE_USERS_ENDPOINT_PATH ?? '/users';
const organizationsEndpointPath = import.meta.env.VITE_ORGANIZATIONS_ENDPOINT_PATH ?? '/organizations';
const rolesEndpointPath = import.meta.env.VITE_ROLES_ENDPOINT_PATH ?? '/roles';

/**
 * HTTP facade for identity access resources.
 */
export class IdentityAccessApi extends BaseApi {
    #usersEndpoint;
    #organizationsEndpoint;
    #rolesEndpoint;

    /**
     * Initializes identity access api endpoint helpers.
     */
    constructor() {
        super();
        this.#usersEndpoint = new BaseEndpoint(this, usersEndpointPath);
        this.#organizationsEndpoint = new BaseEndpoint(this, organizationsEndpointPath);
        this.#rolesEndpoint = new BaseEndpoint(this, rolesEndpointPath);
    }

    /**
     * Requests users from the API.
     *
     * @returns {Promise<*>}
     */
    getUsers() {
        return this.#usersEndpoint.getAll();
    }

    /**
     * Creates user in the identity access context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createUser(resource) {
        return this.#usersEndpoint.create(resource);
    }

    /**
     * Updates user in the identity access context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateUser(resource) {
        return this.#usersEndpoint.update(resource.id, resource);
    }

    /**
     * Deletes user from the identity access context.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    deleteUser(id) {
        return this.#usersEndpoint.delete(id);
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
        return this.#rolesEndpoint.update(resource.id, resource);
    }
}
