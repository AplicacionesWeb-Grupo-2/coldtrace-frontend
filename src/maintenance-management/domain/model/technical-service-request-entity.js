import {TechnicalServiceStatus} from '@/maintenance-management/domain/model/technical-service-status.js';

export class TechnicalServiceRequest {
    constructor({
        id = null,
        organizationId = null,
        uuid = '',
        assetId = null,
        priority = 'medium',
        issueDescription = '',
        requestedDate = '',
        status = TechnicalServiceStatus.Open,
        interventionNotes = null,
        resultNotes = null,
        functionalTestPassed = null,
        closedAt = null,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.uuid = uuid;
        this.assetId = Number(assetId);
        this.priority = priority;
        this.issueDescription = issueDescription;
        this.requestedDate = requestedDate;
        this.status = status;
        this.interventionNotes = interventionNotes;
        this.resultNotes = resultNotes;
        this.functionalTestPassed = functionalTestPassed;
        this.closedAt = closedAt;
    }
}
