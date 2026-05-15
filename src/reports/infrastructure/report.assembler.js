import {Report} from '@/reports/domain/model/report-entity.js';

export class ReportAssembler {
    static toEntityFromResource(resource) {
        return new Report({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.reports;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            uuid: entity.uuid,
            type: entity.type,
            title: entity.title,
            periodDate: entity.periodDate,
            generatedAt: entity.generatedAt,
        };
    }
}
