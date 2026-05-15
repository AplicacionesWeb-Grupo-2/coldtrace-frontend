import {NotificationStatus} from '@/alerts/domain/model/notification-status.js';

export class Notification {
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

    get isPending() {
        return this.status === NotificationStatus.Pending;
    }

    get isSent() {
        return this.status === NotificationStatus.Sent;
    }

    get isFailed() {
        return this.status === NotificationStatus.Failed;
    }
}
