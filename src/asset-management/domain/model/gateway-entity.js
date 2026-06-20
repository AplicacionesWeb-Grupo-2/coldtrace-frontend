import {GatewayStatus} from '@/asset-management/domain/model/gateway-status.js';

/**
 * @typedef {Object} GatewayProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {number|null} [locationId]
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
        locationId = null,
        uuid = '',
        name = '',
        location = '',
        network = '',
        status = GatewayStatus.Active,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.locationId = locationId === null || locationId === undefined ? null : Number(locationId);
        this.uuid = uuid;
        this.name = name;
        this.location = location;
        this.network = network;
        this.status = status;
    }
}
