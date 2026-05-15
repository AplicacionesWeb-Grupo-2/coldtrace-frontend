export class AuditEvidence {
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

    get completeItems() {
        return this.items.filter(item => item.isComplete).length;
    }

    get incompleteItems() {
        return this.items.length - this.completeItems;
    }

    get completenessRate() {
        if (!this.items.length) return 0;
        return Math.round((this.completeItems / this.items.length) * 100);
    }

    get isComplete() {
        return this.items.length > 0 && this.incompleteItems === 0;
    }

    get hasEvidence() {
        return this.readingsCount > 0 || this.reports.length > 0 || this.findings.length > 0;
    }
}
