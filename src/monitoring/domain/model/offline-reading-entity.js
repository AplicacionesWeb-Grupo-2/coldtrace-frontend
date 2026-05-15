import {SyncStatus} from '@/monitoring/domain/model/sync-status.js';

export class OfflineReading {
    constructor({
        id = null,
        assetId = null,
        iotDeviceId = null,
        temperature = 0,
        humidity = 0,
        recordedAt = '',
        syncStatus = SyncStatus.Pending,
    }) {
        this.id = Number(id);
        this.assetId = Number(assetId);
        this.iotDeviceId = Number(iotDeviceId);
        this.temperature = Number(temperature);
        this.humidity = Number(humidity);
        this.recordedAt = recordedAt;
        this.syncStatus = syncStatus;
    }

    get isPending() {
        return this.syncStatus === SyncStatus.Pending;
    }

    get isSynced() {
        return this.syncStatus === SyncStatus.Synced;
    }

    get isFailed() {
        return this.syncStatus === SyncStatus.Failed;
    }

    withSyncStatus(syncStatus) {
        return new OfflineReading({...this, syncStatus});
    }
}
