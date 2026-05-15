/**
 * @typedef {Object} MonthlyReportProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [month]
 * @property {string} [fromDate]
 * @property {string} [toDate]
 * @property {string} [generatedAt]
 * @property {Array<*>} [rows]
 */

/**
 * Domain entity representing monthly report.
 */
export class MonthlyReport {
    /**
     * @param {MonthlyReportProps} [props]
     */
    constructor({id = null, organizationId = null, month = '', fromDate = '', toDate = '', generatedAt = '', rows = []}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.month = month;
        this.fromDate = fromDate;
        this.toDate = toDate;
        this.generatedAt = generatedAt;
        this.rows = rows;
    }

    /**
     * Returns the total assets value for this entity.
     *
     * @returns {number}
     */
    get totalAssets() {
        return this.rows.length;
    }

    /**
     * Returns the total readings value for this entity.
     *
     * @returns {number}
     */
    get totalReadings() {
        return this.rows.reduce((total, row) => total + row.totalReadings, 0);
    }

    /**
     * Returns the valid readings value for this entity.
     *
     * @returns {*}
     */
    get validReadings() {
        return this.rows.reduce((total, row) => total + row.validReadings, 0);
    }

    /**
     * Returns the out of range count value for this entity.
     *
     * @returns {number}
     */
    get outOfRangeCount() {
        return this.rows.reduce((total, row) => total + row.outOfRangeCount, 0);
    }

    /**
     * Returns the incident count value for this entity.
     *
     * @returns {number}
     */
    get incidentCount() {
        return this.rows.reduce((total, row) => total + row.incidentCount, 0);
    }

    /**
     * Returns the attention assets value for this entity.
     *
     * @returns {*}
     */
    get attentionAssets() {
        return this.rows.filter(row => row.status !== 'complete').length;
    }

    /**
     * Returns the compliance rate value for this entity.
     *
     * @returns {number}
     */
    get complianceRate() {
        if (!this.totalReadings) return 0;
        return Math.round((this.validReadings / this.totalReadings) * 100);
    }

    /**
     * Returns the can download value for this entity.
     *
     * @returns {boolean}
     */
    get canDownload() {
        return this.totalReadings > 0;
    }
}
