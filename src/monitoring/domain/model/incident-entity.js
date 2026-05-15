/**
 * @typedef {Object} IncidentProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {number|null} [assetId]
 * @property {string} [assetName]
 * @property {string} [type]
 * @property {string} [severity]
 * @property {string} [value]
 * @property {string} [detectedAt]
 * @property {string} [status]
 * @property {*|null} [recognizedBy]
 * @property {*|null} [recognizedAt]
 * @property {boolean} [conditionStable]
 * @property {*|null} [correctiveAction]
 * @property {*|null} [closureEvidence]
 * @property {*|null} [closedBy]
 * @property {*|null} [closedAt]
 * @property {*|null} [conditionKey]
 * @property {string} [source]
 * @property {number|null} [sourceReadingId]
 * @property {string} [reviewStatus]
 * @property {string} [escalationStatus]
 * @property {number} [escalationLevel]
 * @property {*|null} [escalationPolicyMinutes]
 * @property {*|null} [escalatedAt]
 * @property {*|null} [escalatedTo]
 * @property {*|null} [escalationReviewedBy]
 * @property {*|null} [escalationReviewedAt]
 */

/**
 * Domain entity representing incident.
 */
export class Incident {
    /**
     * @param {IncidentProps} [props]
     */
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

    /**
     * Returns the is open value for this entity.
     *
     * @returns {boolean}
     */
    get isOpen() {
        return this.status === 'open';
    }

    /**
     * Returns the is recognized value for this entity.
     *
     * @returns {boolean}
     */
    get isRecognized() {
        return this.status === 'recognized';
    }

    /**
     * Returns the is closed value for this entity.
     *
     * @returns {boolean}
     */
    get isClosed() {
        return this.status === 'closed';
    }

    /**
     * Returns the is generated value for this entity.
     *
     * @returns {boolean}
     */
    get isGenerated() {
        return this.source === 'sensor-reading';
    }

    /**
     * Returns the is pending review value for this entity.
     *
     * @returns {boolean}
     */
    get isPendingReview() {
        return this.reviewStatus === 'pending-review';
    }

    /**
     * Returns the is escalated value for this entity.
     *
     * @returns {boolean}
     */
    get isEscalated() {
        return this.escalationStatus === 'escalated';
    }

    /**
     * Returns the is pending escalation configuration value for this entity.
     *
     * @returns {boolean}
     */
    get isPendingEscalationConfiguration() {
        return this.escalationStatus === 'pending-configuration';
    }
}
