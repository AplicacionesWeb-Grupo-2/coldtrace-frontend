import {TechnicalServiceStatus} from '@/maintenance-management/domain/model/technical-service-status.js';

/**
 * @typedef {Object} TechnicalServiceRequestProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [uuid]
 * @property {number|null} [assetId]
 * @property {string} [priority]
 * @property {string} [issueDescription]
 * @property {string} [requestedDate]
 * @property {string} [status]
 * @property {*|null} [interventionNotes]
 * @property {*|null} [resultNotes]
 * @property {*|null} [functionalTestPassed]
 * @property {*|null} [closedAt]
 * @property {number|null} [assetLocationId]
 * @property {string|null} [assetName]
 * @property {number|null} [incidentId]
 * @property {string|null} [requestedBy]
 * @property {string|null} [closedBy]
 */

/**
 * Domain entity representing technical service request.
 */
export class TechnicalServiceRequest {
    /**
     * @param {TechnicalServiceRequestProps} [props]
     */
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
        assetLocationId = null,
        assetName = null,
        incidentId = null,
        requestedBy = null,
        closedBy = null,
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
        this.assetLocationId = assetLocationId === null || assetLocationId === undefined ? null : Number(assetLocationId);
        this.assetName = assetName;
        this.incidentId = incidentId === null || incidentId === undefined ? null : Number(incidentId);
        this.requestedBy = requestedBy;
        this.closedBy = closedBy;
    }
}
