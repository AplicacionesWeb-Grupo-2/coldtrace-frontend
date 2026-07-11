import {Asset} from '@/asset-management/domain/model/asset-entity.js';

/**
 * @typedef {Object} AssetApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [uuid]
 * @property {*} [type]
 * @property {*} [locationId]
 * @property {*} [gatewayId]
 * @property {*} [name]
 * @property {*} [location]
 * @property {*} [capacity]
 * @property {*} [description]
 * @property {*} [status]
 * @property {*} [lastIncident]
 * @property {*} [currentTemperature]
 * @property {*} [entryDate]
 * @property {*} [createdAt]
 * @property {*} [connectivity]
 */

/**
 * Maps asset resources between API payloads and domain entities.
 */
export class AssetAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {AssetApiResource} resource
     * @returns {Asset}
     */
    static toEntityFromResource(resource) {
        return new Asset({...resource});
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<AssetApiResource[]|Object>} response
     * @returns {Asset[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.assets;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {Asset} entity
     * @returns {AssetApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            locationId: entity.locationId,
            uuid: entity.uuid,
            type: entity.type,
            gatewayId: entity.gatewayId,
            name: entity.name,
            location: entity.location,
            capacity: entity.capacity,
            description: entity.description,
            status: entity.status,
            lastIncident: entity.lastIncident,
            currentTemperature: entity.currentTemperature,
            entryDate: entity.entryDate,
            connectivity: entity.connectivity,
        };
    }
}
