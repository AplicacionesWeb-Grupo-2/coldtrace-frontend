import {MaintenanceSchedule} from '@/monitoring/domain/model/maintenance-schedule-entity.js';

export class MaintenanceScheduleAssembler {
    static toEntityFromResource(resource) {
        return new MaintenanceSchedule({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.maintenanceSchedules;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }
}
