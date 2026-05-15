import {SyncStatus} from '@/monitoring/domain/model/sync-status.js';

/**
 * @typedef {Object} OfflineReadingProps
 * @property {number|null} [id]
 * @property {number|null} [assetId]
 * @property {number|null} [iotDeviceId]
 * @property {number} [temperature]
 * @property {number} [humidity]
 * @property {string} [recordedAt]
 * @property {string} [syncStatus]
 */

/**
 * Domain entity representing offline reading.
 */
export class OfflineReading {
    /**
     * @param {OfflineReadingProps} [props]
     */
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

    /**
     * Returns the is pending value for this entity.
     *
     * @returns {boolean}
     */
    get isPending() {
        return this.syncStatus === SyncStatus.Pending;
    }

    /**
     * Returns the is synced value for this entity.
     *
     * @returns {boolean}
     */
    get isSynced() {
        return this.syncStatus === SyncStatus.Synced;
    }

    /**
     * Returns the is failed value for this entity.
     *
     * @returns {boolean}
     */
    get isFailed() {
        return this.syncStatus === SyncStatus.Failed;
    }

    /**
     * Handles with sync status behavior in the monitoring context.
     *
     * @param {string} syncStatus
     * @returns {string}
     */
    withSyncStatus(syncStatus) {
        return new OfflineReading({...this, syncStatus});
    }
}
