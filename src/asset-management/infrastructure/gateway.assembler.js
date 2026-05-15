import {Gateway} from '@/asset-management/domain/model/gateway-entity.js';

export class GatewayAssembler {
    static toEntityFromResource(resource) {
        return new Gateway({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.gateways;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            uuid: entity.uuid,
            name: entity.name,
            location: entity.location,
            network: entity.network,
            status: entity.status,
        };
    }
}
