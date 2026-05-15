import {User} from '@/identity-access/domain/model/user-entity.js';

/**
 * @typedef {Object} UserApiResource
 * @property {*} [id]
 * @property {*} [uuid]
 * @property {*} [organizationUserId]
 * @property {*} [firstName]
 * @property {*} [lastName]
 * @property {*} [email]
 * @property {*} [organizationId]
 * @property {*} [roleId]
 */

/**
 * Maps user resources between API payloads and domain entities.
 */
export class UserAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {UserApiResource} resource
     * @returns {User}
     */
    static toEntityFromResource(resource) {
        return new User({...resource});
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<UserApiResource[]|Object>} response
     * @returns {User[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.users;
        return resources.map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {User} entity
     * @returns {UserApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            uuid: entity.uuid,
            organizationUserId: entity.organizationUserId,
            firstName: entity.firstName,
            lastName: entity.lastName,
            email: entity.email,
            organizationId: entity.organizationId,
            roleId: entity.roleId,
        };
    }
}
