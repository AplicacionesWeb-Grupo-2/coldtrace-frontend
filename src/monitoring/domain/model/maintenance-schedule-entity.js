/**
 * Allowed maintenance schedule status values.
 *
 * @readonly
 * @enum {string}
 */
export const MaintenanceScheduleStatus = {
    Scheduled: 'scheduled',
    Pending: 'pending',
    Completed: 'completed',
    Canceled: 'canceled',
};

/**
 * @typedef {Object} MaintenanceScheduleProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [uuid]
 * @property {number|null} [assetId]
 * @property {number|null} [iotDeviceId]
 * @property {string} [scheduledDate]
 * @property {string} [period]
 * @property {string} [observations]
 * @property {string} [status]
 * @property {string} [createdAt]
 */

/**
 * Domain entity representing maintenance schedule.
 */
export class MaintenanceSchedule {
    /**
     * @param {MaintenanceScheduleProps} [props]
     */
    constructor({
        id = null,
        organizationId = null,
        uuid = '',
        assetId = null,
        iotDeviceId = null,
        scheduledDate = '',
        period = '',
        observations = '',
        status = MaintenanceScheduleStatus.Scheduled,
        createdAt = '',
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.uuid = uuid;
        this.assetId = Number(assetId);
        this.iotDeviceId = iotDeviceId === null || iotDeviceId === undefined ? null : Number(iotDeviceId);
        this.scheduledDate = scheduledDate;
        this.period = period;
        this.observations = observations;
        this.status = status;
        this.createdAt = createdAt;
    }
}
