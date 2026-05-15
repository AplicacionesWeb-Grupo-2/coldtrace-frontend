export class Incident {
    constructor({
        id = null,
        organizationId = null,
        assetId = null,
        assetName = '',
        type = 'other',
        severity = 'warning',
        value = '',
        detectedAt = '',
        status = 'open',
        recognizedBy = null,
        recognizedAt = null,
        conditionStable = false,
        correctiveAction = null,
        closureEvidence = null,
        closedBy = null,
        closedAt = null,
        conditionKey = null,
        source = 'initial-data',
        sourceReadingId = null,
        reviewStatus = 'complete',
        escalationStatus = 'none',
        escalationLevel = 0,
        escalationPolicyMinutes = null,
        escalatedAt = null,
        escalatedTo = null,
        escalationReviewedBy = null,
        escalationReviewedAt = null,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.assetId = Number(assetId);
        this.assetName = assetName;
        this.type = type;
        this.severity = severity;
        this.value = value;
        this.detectedAt = detectedAt;
        this.status = status;
        this.recognizedBy = recognizedBy;
        this.recognizedAt = recognizedAt;
        this.conditionStable = Boolean(conditionStable);
        this.correctiveAction = correctiveAction;
        this.closureEvidence = closureEvidence;
        this.closedBy = closedBy;
        this.closedAt = closedAt;
        this.conditionKey = conditionKey;
        this.source = source;
        this.sourceReadingId = sourceReadingId === null || sourceReadingId === undefined ? null : Number(sourceReadingId);
        this.reviewStatus = reviewStatus;
        this.escalationStatus = escalationStatus;
        this.escalationLevel = Number(escalationLevel);
        this.escalationPolicyMinutes = escalationPolicyMinutes === null || escalationPolicyMinutes === undefined ? null : Number(escalationPolicyMinutes);
        this.escalatedAt = escalatedAt;
        this.escalatedTo = escalatedTo;
        this.escalationReviewedBy = escalationReviewedBy;
        this.escalationReviewedAt = escalationReviewedAt;
    }

    get isOpen() {
        return this.status === 'open';
    }

    get isRecognized() {
        return this.status === 'recognized';
    }

    get isClosed() {
        return this.status === 'closed';
    }

    get isGenerated() {
        return this.source === 'sensor-reading';
    }

    get isPendingReview() {
        return this.reviewStatus === 'pending-review';
    }

    get isEscalated() {
        return this.escalationStatus === 'escalated';
    }

    get isPendingEscalationConfiguration() {
        return this.escalationStatus === 'pending-configuration';
    }
}
