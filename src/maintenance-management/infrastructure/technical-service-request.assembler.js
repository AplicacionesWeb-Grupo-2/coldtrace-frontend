import {TechnicalServiceRequest} from '@/maintenance-management/domain/model/technical-service-request-entity.js';

/**
 * @typedef {Object} TechnicalServiceRequestApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [uuid]
 * @property {*} [assetId]
 * @property {*} [assetLocationId]
 * @property {*} [assetName]
 * @property {*} [incidentId]
 * @property {*} [priority]
 * @property {*} [issueDescription]
 * @property {*} [requestedDate]
 * @property {*} [requestedAt]
 * @property {*} [requestedBy]
 * @property {*} [status]
 * @property {*} [interventionNotes]
 * @property {*} [resultNotes]
 * @property {*} [closureSummary]
 * @property {*} [evidence]
 * @property {*} [closedBy]
 * @property {*} [functionalTestPassed]
 * @property {*} [closedAt]
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
        return new TechnicalServiceRequest({
            ...resource,
            uuid: resource.uuid ?? resource.code ?? '',
            requestedDate: resource.requestedDate ?? dateKeyFrom(resource.requestedAt),
            interventionNotes: resource.interventionNotes ?? resource.evidence ?? null,
            resultNotes: resource.resultNotes ?? resource.closureSummary ?? null,
            functionalTestPassed: resource.functionalTestPassed ?? functionalTestStatusFrom(resource),
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

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {TechnicalServiceRequest} entity
     * @returns {TechnicalServiceRequestApiResource}
     */
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
            assetLocationId: entity.assetLocationId,
            assetName: entity.assetName,
            incidentId: entity.incidentId,
            requestedBy: entity.requestedBy,
            closureSummary: entity.resultNotes,
            evidence: entity.interventionNotes,
            closedBy: entity.closedBy,
        };
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
 * @returns {boolean|null}
 */
function functionalTestStatusFrom(resource) {
    if (resource.status === 'closed') return true;
    if (resource.status === 'pending-review' && (resource.closureSummary || resource.evidence)) return false;
    return null;
}
