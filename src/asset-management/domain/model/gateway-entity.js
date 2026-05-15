import {GatewayStatus} from '@/asset-management/domain/model/gateway-status.js';

export class Gateway {
    constructor({
        id = null,
        organizationId = null,
        uuid = '',
        name = '',
        location = '',
        network = '',
        status = GatewayStatus.Active,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.uuid = uuid;
        this.name = name;
        this.location = location;
        this.network = network;
        this.status = status;
    }
}
