import {Incident} from '@/alerts/domain/model/incident-entity.js';

/**
 * @typedef {Object} IncidentApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [assetId]
 * @property {*} [assetName]
 * @property {*} [type]
 * @property {*} [severity]
 * @property {*} [value]
 * @property {*} [detectedAt]
 * @property {*} [status]
 * @property {*} [recognizedBy]
 * @property {*} [recognizedAt]
 * @property {*} [acknowledgedBy]
 * @property {*} [acknowledgedAt]
 * @property {*} [conditionStable]
 * @property {*} [correctiveAction]
 * @property {*} [closureEvidence]
 * @property {*} [closedBy]
 * @property {*} [closedAt]
 * @property {*} [resolvedBy]
 * @property {*} [resolvedAt]
 * @property {*} [resolutionNotes]
 * @property {*} [conditionKey]
 * @property {*} [source]
 * @property {*} [sourceReadingId]
 * @property {*} [reviewStatus]
 * @property {*} [escalationStatus]
 * @property {*} [escalationLevel]
 * @property {*} [escalationPolicyMinutes]
 * @property {*} [escalatedAt]
 * @property {*} [escalatedTo]
 * @property {*} [escalatedBy]
 * @property {*} [escalationReviewedBy]
 * @property {*} [escalationReviewedAt]
 */

/**
 * Maps incident resources between API payloads and domain entities.
 */
export class IncidentAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {IncidentApiResource} resource
     * @returns {Incident}
     */
    static toEntityFromResource(resource) {
        return new Incident(this.normalizedResource(resource));
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<IncidentApiResource[]|Object>} response
     * @returns {Incident[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.incidents;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Normalizes backend incident fields into the frontend incident contract.
     *
     * @param {IncidentApiResource} resource
     * @returns {IncidentApiResource}
     */
    static normalizedResource(resource) {
        const status = String(resource.status ?? '').toLowerCase();
        const normalizedStatus = status === 'resolved' ? 'closed' : status === 'acknowledged' ? 'recognized' : status || 'open';

        return {
            ...resource,
            status: normalizedStatus,
            recognizedBy: resource.recognizedBy ?? resource.acknowledgedBy ?? null,
            recognizedAt: resource.recognizedAt ?? resource.acknowledgedAt ?? null,
            source: resource.source ?? (resource.readingId ? 'sensor-reading' : 'manual'),
            sourceReadingId: resource.sourceReadingId ?? resource.readingId ?? null,
            closedAt: resource.closedAt ?? resource.resolvedAt ?? null,
            closedBy: resource.closedBy ?? resource.resolvedBy ?? null,
            correctiveAction: resource.correctiveAction ?? null,
            closureEvidence: resource.closureEvidence ?? resource.resolutionNotes ?? null,
            escalationStatus: resource.escalationStatus || (resource.escalatedAt ? 'escalated' : 'none'),
            escalatedTo: resource.escalatedTo ?? resource.escalatedBy ?? null,
        };
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {Incident} entity
     * @returns {IncidentApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            assetId: entity.assetId,
            assetName: entity.assetName,
            type: entity.type,
            severity: entity.severity,
            value: entity.value,
            detectedAt: entity.detectedAt,
            status: entity.status,
            recognizedBy: entity.recognizedBy,
            recognizedAt: entity.recognizedAt,
            conditionStable: entity.conditionStable,
            correctiveAction: entity.correctiveAction,
            closureEvidence: entity.closureEvidence,
            closedBy: entity.closedBy,
            closedAt: entity.closedAt,
            conditionKey: entity.conditionKey,
            source: entity.source,
            sourceReadingId: entity.sourceReadingId,
            reviewStatus: entity.reviewStatus,
            escalationStatus: entity.escalationStatus,
            escalationLevel: entity.escalationLevel,
            escalationPolicyMinutes: entity.escalationPolicyMinutes,
            escalatedAt: entity.escalatedAt,
            escalatedTo: entity.escalatedTo,
            escalationReviewedBy: entity.escalationReviewedBy,
            escalationReviewedAt: entity.escalationReviewedAt,
        };
    }
}
