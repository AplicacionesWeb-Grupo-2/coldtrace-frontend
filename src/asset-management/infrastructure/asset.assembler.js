import {Asset} from '@/asset-management/domain/model/asset-entity.js';

export class AssetAssembler {
    static toEntityFromResource(resource) {
        return new Asset({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.assets;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
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
