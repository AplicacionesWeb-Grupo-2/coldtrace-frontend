import {NotificationStatus} from '@/alerts/domain/model/notification-status.js';

/**
 * @typedef {Object} NotificationProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {number|null} [incidentId]
 * @property {string} [assetName]
 * @property {string} [channel]
 * @property {string} [recipient]
 * @property {string} [message]
 * @property {string} [status]
 * @property {string} [createdAt]
 * @property {*|null} [deliveredAt]
 * @property {*|null} [failureReason]
 */

/**
 * Domain entity representing notification.
 */
export class Notification {
    /**
     * @param {NotificationProps} [props]
     */
    constructor({
        id = null,
        organizationId = null,
        incidentId = null,
        assetName = '',
        channel = 'app',
        recipient = '',
        message = '',
        status = NotificationStatus.Pending,
        createdAt = '',
        deliveredAt = null,
        failureReason = null,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.incidentId = Number(incidentId);
        this.assetName = assetName;
        this.channel = channel;
        this.recipient = recipient;
        this.message = message;
        this.status = status;
        this.createdAt = createdAt;
        this.deliveredAt = deliveredAt;
        this.failureReason = failureReason;
    }

    /**
     * Returns the is pending value for this entity.
     *
     * @returns {boolean}
     */
    get isPending() {
        return this.status === NotificationStatus.Pending;
    }

    /**
     * Returns the is sent value for this entity.
     *
     * @returns {boolean}
     */
    get isSent() {
        return this.status === NotificationStatus.Sent;
    }

    /**
     * Returns the is failed value for this entity.
     *
     * @returns {boolean}
     */
    get isFailed() {
        return this.status === NotificationStatus.Failed;
    }
}
