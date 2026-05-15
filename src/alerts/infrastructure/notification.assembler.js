import {Notification} from '@/alerts/domain/model/notification-entity.js';

/**
 * @typedef {Object} NotificationApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [incidentId]
 * @property {*} [assetName]
 * @property {*} [channel]
 * @property {*} [recipient]
 * @property {*} [message]
 * @property {*} [status]
 * @property {*} [createdAt]
 * @property {*} [deliveredAt]
 * @property {*} [failureReason]
 */

/**
 * Maps notification resources between API payloads and domain entities.
 */
export class NotificationAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {NotificationApiResource} resource
     * @returns {Notification}
     */
    static toEntityFromResource(resource) {
        return new Notification({...resource});
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<NotificationApiResource[]|Object>} response
     * @returns {Notification[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.notifications;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {Notification} entity
     * @returns {NotificationApiResource}
     */
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
