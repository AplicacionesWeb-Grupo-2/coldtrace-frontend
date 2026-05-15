import {User} from '@/identity-access/domain/model/user-entity.js';

export class UserAssembler {
    static toEntityFromResource(resource) {
        return new User({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.users;
        return resources.map(resource => this.toEntityFromResource(resource));
    }

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
