import {Notification} from '@/alerts/domain/model/notification-entity.js';

export class NotificationAssembler {
    static toEntityFromResource(resource) {
        return new Notification({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.notifications;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            incidentId: entity.incidentId,
            assetName: entity.assetName,
            channel: entity.channel,
            recipient: entity.recipient,
            message: entity.message,
            status: entity.status,
            createdAt: entity.createdAt,
            deliveredAt: entity.deliveredAt,
            failureReason: entity.failureReason,
        };
    }
}
