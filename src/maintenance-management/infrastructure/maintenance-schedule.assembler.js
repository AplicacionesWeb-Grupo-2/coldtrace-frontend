import {MaintenanceSchedule} from '@/maintenance-management/domain/model/maintenance-schedule-entity.js';

export class MaintenanceScheduleAssembler {
    static toEntityFromResource(resource) {
        return new MaintenanceSchedule({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.maintenanceSchedules;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            uuid: entity.uuid,
            assetId: entity.assetId,
            iotDeviceId: entity.iotDeviceId,
            scheduledDate: entity.scheduledDate,
            period: entity.period,
            observations: entity.observations,
            status: entity.status,
            createdAt: entity.createdAt,
        };
    }
}
