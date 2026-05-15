/**
 * @typedef {Object} AuditEvidenceProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {Object} [filters]
 * @property {string} [generatedAt]
 * @property {Array<*>} [items]
 * @property {number} [readingsCount]
 * @property {number} [expectedReadings]
 * @property {number} [incidentCount]
 * @property {number} [correctiveActionsCount]
 * @property {Array<*>} [reports]
 * @property {Array<*>} [findings]
 */

/**
 * Domain entity representing audit evidence.
 */
export class AuditEvidence {
    /**
     * @param {AuditEvidenceProps} [props]
     */
    constructor({
        id = null,
        organizationId = null,
        filters = {},
        generatedAt = '',
        items = [],
        readingsCount = 0,
        expectedReadings = 0,
        incidentCount = 0,
        correctiveActionsCount = 0,
        reports = [],
        findings = [],
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.filters = filters;
        this.generatedAt = generatedAt;
        this.items = items;
        this.readingsCount = Number(readingsCount);
        this.expectedReadings = Number(expectedReadings);
        this.incidentCount = Number(incidentCount);
        this.correctiveActionsCount = Number(correctiveActionsCount);
        this.reports = reports;
        this.findings = findings;
    }

    /**
     * Returns the complete items value for this entity.
     *
     * @returns {*}
     */
    get completeItems() {
        return this.items.filter(item => item.isComplete).length;
    }

    /**
     * Returns the incomplete items value for this entity.
     *
     * @returns {*}
     */
    get incompleteItems() {
        return this.items.length - this.completeItems;
    }

    /**
     * Returns the completeness rate value for this entity.
     *
     * @returns {number}
     */
    get completenessRate() {
        if (!this.items.length) return 0;
        return Math.round((this.completeItems / this.items.length) * 100);
    }

    /**
     * Returns the is complete value for this entity.
     *
     * @returns {boolean}
     */
    get isComplete() {
        return this.items.length > 0 && this.incompleteItems === 0;
    }

    /**
     * Returns the has evidence value for this entity.
     *
     * @returns {boolean}
     */
    get hasEvidence() {
        return this.readingsCount > 0 || this.reports.length > 0 || this.findings.length > 0;
    }
}
