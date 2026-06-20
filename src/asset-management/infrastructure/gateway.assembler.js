import {Gateway} from '@/asset-management/domain/model/gateway-entity.js';

/**
 * @typedef {Object} GatewayApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [locationId]
 * @property {*} [uuid]
 * @property {*} [name]
 * @property {*} [location]
 * @property {*} [network]
 * @property {*} [status]
 */

/**
 * Maps gateway resources between API payloads and domain entities.
 */
export class GatewayAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {GatewayApiResource} resource
     * @returns {Gateway}
     */
    static toEntityFromResource(resource) {
        return new Gateway({...resource});
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<GatewayApiResource[]|Object>} response
     * @returns {Gateway[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.gateways;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {Gateway} entity
     * @returns {GatewayApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            locationId: entity.locationId,
            uuid: entity.uuid,
            name: entity.name,
            location: entity.location,
            network: entity.network,
            status: entity.status,
        };
    }
}
