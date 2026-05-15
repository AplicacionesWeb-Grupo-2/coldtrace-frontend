import {AssetStatus} from '@/asset-management/domain/model/asset-status.js';
import {AssetType} from '@/asset-management/domain/model/asset-type.js';
import {ConnectivityStatus} from '@/asset-management/domain/model/connectivity-status.js';

export class Asset {
    constructor({
        id = null,
        organizationId = null,
        uuid = '',
        type = AssetType.ColdRoom,
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
