export class SanitaryComplianceReport {
    constructor({id = null, organizationId = null, filters = {}, generatedAt = '', rows = []}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.filters = filters;
        this.generatedAt = generatedAt;
        this.rows = rows;
    }

    get totalAssets() {
        return this.rows.length;
    }

    get totalReadings() {
        return this.rows.reduce((total, row) => total + row.totalReadings, 0);
    }

    get expectedReadings() {
        return this.rows.reduce((total, row) => total + row.expectedReadings, 0);
    }

    get validReadings() {
        return this.rows.reduce((total, row) => total + row.validReadings, 0);
    }

    get missingReadings() {
        return this.rows.reduce((total, row) => total + row.missingReadings, 0);
    }

    get outOfRangeCount() {
        return this.rows.reduce((total, row) => total + row.outOfRangeCount, 0);
    }

    get incidentCount() {
        return this.rows.reduce((total, row) => total + row.incidentCount, 0);
    }

    get observationsCount() {
        return this.rows.filter(row => row.status !== 'compliant').length;
    }

    get complianceRate() {
        const denominator = this.expectedReadings || this.totalReadings;
        if (!denominator) return 0;
        return Math.round((this.validReadings / denominator) * 100);
    }

    get canExport() {
        return this.totalReadings > 0;
    }
}
