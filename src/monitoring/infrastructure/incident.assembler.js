import {Incident} from '@/monitoring/domain/model/incident-entity.js';

export class IncidentAssembler {
    static toEntityFromResource(resource) {
        return new Incident({...resource});
    }

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

    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.incidents;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }
}
