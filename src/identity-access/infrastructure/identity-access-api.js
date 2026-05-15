import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const usersEndpointPath = import.meta.env.VITE_USERS_ENDPOINT_PATH ?? '/users';
const organizationsEndpointPath = import.meta.env.VITE_ORGANIZATIONS_ENDPOINT_PATH ?? '/organizations';
const rolesEndpointPath = import.meta.env.VITE_ROLES_ENDPOINT_PATH ?? '/roles';

export class IdentityAccessApi extends BaseApi {
    #usersEndpoint;
    #organizationsEndpoint;
    #rolesEndpoint;

    constructor() {
        super();
        this.#usersEndpoint = new BaseEndpoint(this, usersEndpointPath);
        this.#organizationsEndpoint = new BaseEndpoint(this, organizationsEndpointPath);
        this.#rolesEndpoint = new BaseEndpoint(this, rolesEndpointPath);
    }

    getUsers() {
        return this.#usersEndpoint.getAll();
    }

    createUser(resource) {
        return this.#usersEndpoint.create(resource);
    }

    updateUser(resource) {
        return this.#usersEndpoint.update(resource.id, resource);
    }

    deleteUser(id) {
        return this.#usersEndpoint.delete(id);
    }

    getOrganizations() {
        return this.#organizationsEndpoint.getAll();
    }

    createOrganization(resource) {
        return this.#organizationsEndpoint.create(resource);
    }

    getRoles() {
        return this.#rolesEndpoint.getAll();
    }

    updateRole(resource) {
        return this.#rolesEndpoint.update(resource.id, resource);
    }
}
