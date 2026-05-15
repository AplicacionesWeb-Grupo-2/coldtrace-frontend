import {Organization} from '@/identity-access/domain/model/organization-entity.js';

export class OrganizationAssembler {
    static toEntityFromResource(resource) {
        return new Organization({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.organizations;
        return resources.map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            legalName: entity.legalName,
            commercialName: entity.commercialName,
            taxId: entity.taxId,
            contactEmail: entity.contactEmail,
        };
    }
}
