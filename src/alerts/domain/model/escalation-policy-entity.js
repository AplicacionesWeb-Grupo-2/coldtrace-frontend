export class EscalationPolicy {
    constructor(severity, waitingMinutes, level, targetKey) {
        this.severity = severity;
        this.waitingMinutes = Number(waitingMinutes);
        this.level = Number(level);
        this.targetKey = targetKey;
    }

    appliesTo(incident) {
        return incident.severity === this.severity && incident.type !== 'other';
    }
}
