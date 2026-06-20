import {Location} from '@/asset-management/domain/model/location-entity.js';

/**
 * @typedef {Object} LocationApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [name]
 * @property {*} [type]
 * @property {*} [address]
 * @property {*} [description]
 * @property {*} [status]
 */

/**
 * Maps location resources between API payloads and domain entities.
 */
export class LocationAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {LocationApiResource} resource
     * @returns {Location}
     */
    static toEntityFromResource(resource) {
        return new Location({...resource});
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<LocationApiResource[]|Object>} response
     * @returns {Location[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.locations;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {Location} entity
     * @returns {LocationApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            name: entity.name,
            type: entity.type,
            address: entity.address,
            description: entity.description,
            status: entity.status,
        };
    }
}
