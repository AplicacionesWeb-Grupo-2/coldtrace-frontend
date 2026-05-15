export const MaintenanceScheduleStatus = {
    Scheduled: 'scheduled',
    Pending: 'pending',
    Completed: 'completed',
    Canceled: 'canceled',
};

export class MaintenanceSchedule {
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
