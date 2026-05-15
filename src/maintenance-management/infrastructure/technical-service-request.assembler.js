import {TechnicalServiceRequest} from '@/maintenance-management/domain/model/technical-service-request-entity.js';

export class TechnicalServiceRequestAssembler {
    static toEntityFromResource(resource) {
        return new TechnicalServiceRequest({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.technicalServiceRequests;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            uuid: entity.uuid,
            assetId: entity.assetId,
            priority: entity.priority,
            issueDescription: entity.issueDescription,
            requestedDate: entity.requestedDate,
            status: entity.status,
            interventionNotes: entity.interventionNotes,
            resultNotes: entity.resultNotes,
            functionalTestPassed: entity.functionalTestPassed,
            closedAt: entity.closedAt,
        };
    }
}
