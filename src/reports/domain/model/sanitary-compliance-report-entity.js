/**
 * @typedef {Object} SanitaryComplianceReportProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {Object} [filters]
 * @property {string} [generatedAt]
 * @property {Array<*>} [rows]
 */

/**
 * Domain entity representing sanitary compliance report.
 */
export class SanitaryComplianceReport {
    /**
     * @param {SanitaryComplianceReportProps} [props]
     */
    constructor({id = null, organizationId = null, filters = {}, generatedAt = '', rows = []}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.filters = filters;
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
     * Returns the expected readings value for this entity.
     *
     * @returns {*}
     */
    get expectedReadings() {
        return this.rows.reduce((total, row) => total + row.expectedReadings, 0);
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
     * Returns the missing readings value for this entity.
     *
     * @returns {*}
     */
    get missingReadings() {
        return this.rows.reduce((total, row) => total + row.missingReadings, 0);
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
     * Returns the observations count value for this entity.
     *
     * @returns {number}
     */
    get observationsCount() {
        return this.rows.filter(row => row.status !== 'compliant').length;
    }

    /**
     * Returns the compliance rate value for this entity.
     *
     * @returns {number}
     */
    get complianceRate() {
        const denominator = this.expectedReadings || this.totalReadings;
        if (!denominator) return 0;
        return Math.round((this.validReadings / denominator) * 100);
    }

    /**
     * Returns the can export value for this entity.
     *
     * @returns {boolean}
     */
    get canExport() {
        return this.totalReadings > 0;
    }
}
