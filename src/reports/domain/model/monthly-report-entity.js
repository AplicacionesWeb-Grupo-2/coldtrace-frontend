export class MonthlyReport {
    constructor({id = null, organizationId = null, month = '', fromDate = '', toDate = '', generatedAt = '', rows = []}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.month = month;
        this.fromDate = fromDate;
        this.toDate = toDate;
        this.generatedAt = generatedAt;
        this.rows = rows;
    }

    get totalAssets() {
        return this.rows.length;
    }

    get totalReadings() {
        return this.rows.reduce((total, row) => total + row.totalReadings, 0);
    }

    get validReadings() {
        return this.rows.reduce((total, row) => total + row.validReadings, 0);
    }

    get outOfRangeCount() {
        return this.rows.reduce((total, row) => total + row.outOfRangeCount, 0);
    }

    get incidentCount() {
        return this.rows.reduce((total, row) => total + row.incidentCount, 0);
    }

    get attentionAssets() {
        return this.rows.filter(row => row.status !== 'complete').length;
    }

    get complianceRate() {
        if (!this.totalReadings) return 0;
        return Math.round((this.validReadings / this.totalReadings) * 100);
    }

    get canDownload() {
        return this.totalReadings > 0;
    }
}
