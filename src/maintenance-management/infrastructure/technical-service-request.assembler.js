import {TechnicalServiceRequest} from '@/maintenance-management/domain/model/technical-service-request-entity.js';

/**
 * @typedef {Object} TechnicalServiceRequestApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [uuid]
 * @property {*} [assetId]
 * @property {*} [priority]
 * @property {*} [issueDescription]
 * @property {*} [requestedDate]
 * @property {*} [status]
 * @property {*} [interventionNotes]
 * @property {*} [resultNotes]
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
            interventionNotes: resource.interventionNotes ?? resource.closureSummary ?? null,
            resultNotes: resource.resultNotes ?? resource.evidence ?? null,
            functionalTestPassed: resource.functionalTestPassed ?? (resource.status === 'closed' ? true : null),
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
