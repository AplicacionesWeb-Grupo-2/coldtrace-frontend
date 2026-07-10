import {TechnicalServiceRequest} from '@/monitoring/domain/model/technical-service-request-entity.js';
import {TechnicalServiceStatus} from '@/monitoring/domain/model/technical-service-request-entity.js';

/**
 * @typedef {Object} TechnicalServiceRequestApiResource
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [uuid]
 * @property {number|null} [assetId]
 * @property {number|null} [assetLocationId]
 * @property {string|null} [assetName]
 * @property {number|null} [incidentId]
 * @property {string} [priority]
 * @property {string} [issueDescription]
 * @property {string} [requestedDate]
 * @property {string} [requestedAt]
 * @property {string|null} [requestedBy]
 * @property {string} [status]
 * @property {*|null} [interventionNotes]
 * @property {*|null} [resultNotes]
 * @property {*|null} [closureSummary]
 * @property {*|null} [evidence]
 * @property {*|null} [closedBy]
 * @property {*|null} [functionalTestPassed]
 * @property {*|null} [closedAt]
 */

/**
 * Maps technical service request resources between API payloads and domain entities.
 */
export class TechnicalServiceRequestAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {TechnicalServiceRequestApiResource} resource
     * @returns {TechnicalServiceRequest}
     */
    static toEntityFromResource(resource) {
        const status = technicalServiceStatusForUi(resource.status);
        return new TechnicalServiceRequest({
            ...resource,
            uuid: resource.uuid ?? resource.code ?? '',
            requestedDate: resource.requestedDate ?? dateKeyFrom(resource.requestedAt),
            status,
            interventionNotes: resource.interventionNotes ?? resource.evidence ?? null,
            resultNotes: resource.resultNotes ?? resource.closureSummary ?? null,
            functionalTestPassed: resource.functionalTestPassed ?? functionalTestStatusFrom(resource, status),
            assetLocationId: resource.assetLocationId ?? null,
            assetName: resource.assetName ?? null,
            incidentId: resource.incidentId ?? null,
            requestedBy: resource.requestedBy ?? null,
            closedBy: resource.closedBy ?? null,
        });
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<TechnicalServiceRequestApiResource[]|Object>} response
     * @returns {TechnicalServiceRequest[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.technicalServiceRequests;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }
}

/**
 * Extracts a date key suitable for table display.
 *
 * @param {string} value
 * @returns {string}
 */
function dateKeyFrom(value) {
    return value ? String(value).slice(0, 10) : '';
}

/**
 * Derives the functional test result from the backend lifecycle fields.
 *
 * @param {*} resource
 * @param {string} status
 * @returns {boolean|null}
 */
function functionalTestStatusFrom(resource, status) {
    if (status === TechnicalServiceStatus.Closed) return true;
    if (status === TechnicalServiceStatus.PendingReview && (resource.closureSummary || resource.evidence)) return false;
    return null;
}

/**
 * Maps backend technical service lifecycle values to UI status values.
 *
 * @param {string} status
 * @returns {string}
 */
function technicalServiceStatusForUi(status) {
    return status === 'in_progress' ? TechnicalServiceStatus.PendingReview : status;
}
