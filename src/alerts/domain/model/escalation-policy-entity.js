/**
 * Domain entity representing escalation policy.
 */
export class EscalationPolicy {
    /**
     * Creates a new domain value object.
     *
     * @param {*} severity
     * @param {*} waitingMinutes
     * @param {*} level
     * @param {string} targetKey
     */
    constructor(severity, waitingMinutes, level, targetKey) {
        this.severity = severity;
        this.waitingMinutes = Number(waitingMinutes);
        this.level = Number(level);
        this.targetKey = targetKey;
    }

    /**
     * Handles applies to behavior in the alerts context.
     *
     * @param {*} incident
     * @returns {*}
     */
    appliesTo(incident) {
        return incident.severity === this.severity && incident.type !== 'other';
    }
}
