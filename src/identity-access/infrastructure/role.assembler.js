import {Permission} from '@/identity-access/domain/model/permission-entity.js';
import {Role} from '@/identity-access/domain/model/role-entity.js';

export class RoleAssembler {
    static toEntityFromResource(resource) {
        return new Role({
            ...resource,
            permissions: (resource.permissions ?? []).map(permission => new Permission({...permission})),
        });
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.roles;
        return resources.map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            name: entity.name,
            label: entity.label,
            permissions: entity.permissions,
        };
    }
}
