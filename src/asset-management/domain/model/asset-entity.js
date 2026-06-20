import {AssetStatus} from '@/asset-management/domain/model/asset-status.js';
import {AssetType} from '@/asset-management/domain/model/asset-type.js';
import {ConnectivityStatus} from '@/asset-management/domain/model/connectivity-status.js';

/**
 * @typedef {Object} AssetProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [uuid]
 * @property {*} [type]
 * @property {number|null} [locationId]
 * @property {number|null} [gatewayId]
 * @property {string} [name]
 * @property {string} [location]
 * @property {number} [capacity]
 * @property {string} [description]
 * @property {string} [status]
 * @property {string} [lastIncident]
 * @property {string} [currentTemperature]
 * @property {string} [entryDate]
 * @property {*} [connectivity]
 */

/**
 * Domain entity representing asset.
 */
export class Asset {
    /**
     * @param {AssetProps} [props]
     */
    constructor({
        id = null,
        organizationId = null,
        uuid = '',
        type = AssetType.ColdRoom,
        locationId = null,
        gatewayId = null,
        name = '',
        location = '',
        capacity = 0,
        description = '',
        status = AssetStatus.Active,
        lastIncident = 'none',
        currentTemperature = '—',
        entryDate = '',
        connectivity = ConnectivityStatus.Online,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.uuid = uuid;
        this.type = type;
        this.locationId = locationId === null || locationId === undefined ? null : Number(locationId);
        this.gatewayId = gatewayId === null || gatewayId === undefined ? null : Number(gatewayId);
        this.name = name;
        this.location = location;
        this.capacity = Number(capacity);
        this.description = description;
        this.status = status;
        this.lastIncident = lastIncident;
        this.currentTemperature = currentTemperature;
        this.entryDate = entryDate;
        this.connectivity = connectivity;
    }
}
