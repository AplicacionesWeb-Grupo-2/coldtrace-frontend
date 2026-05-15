import {Permission} from '@/identity-access/domain/model/permission-entity.js';
import {Role} from '@/identity-access/domain/model/role-entity.js';

/**
 * @typedef {Object} RoleApiResource
 * @property {*} [id]
 * @property {*} [name]
 * @property {*} [label]
 * @property {*} [permissions]
 */

/**
 * Maps role resources between API payloads and domain entities.
 */
export class RoleAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {RoleApiResource} resource
     * @returns {Role}
     */
    static toEntityFromResource(resource) {
        return new Role({
            ...resource,
            permissions: (resource.permissions ?? []).map(permission => new Permission({...permission})),
        });
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<RoleApiResource[]|Object>} response
     * @returns {Role[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.roles;
        return resources.map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {Role} entity
     * @returns {RoleApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            name: entity.name,
            label: entity.label,
            permissions: entity.permissions,
        };
    }
}
