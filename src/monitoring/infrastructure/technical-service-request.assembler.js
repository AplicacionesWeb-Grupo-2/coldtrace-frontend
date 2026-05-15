import {TechnicalServiceRequest} from '@/monitoring/domain/model/technical-service-request-entity.js';

export class TechnicalServiceRequestAssembler {
    static toEntityFromResource(resource) {
        return new TechnicalServiceRequest({...resource});
    }

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.technicalServiceRequests;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }
}
