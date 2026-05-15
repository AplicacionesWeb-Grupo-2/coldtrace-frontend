import {GatewayStatus} from '@/asset-management/domain/model/gateway-status.js';

/**
 * @typedef {Object} GatewayProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [uuid]
 * @property {string} [name]
 * @property {string} [location]
 * @property {string} [network]
 * @property {string} [status]
 */

/**
 * Domain entity representing gateway.
 */
export class Gateway {
    /**
     * @param {GatewayProps} [props]
     */
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
