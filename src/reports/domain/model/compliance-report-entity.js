import {FindingStatus} from '@/reports/domain/model/finding-status.js';

/**
 * @typedef {Object} ComplianceReportProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {Object} [filters]
 * @property {string} [generatedAt]
 * @property {Array<*>} [findings]
 */

/**
 * Domain entity representing compliance report.
 */
export class ComplianceReport {
    /**
     * @param {ComplianceReportProps} [props]
     */
    constructor({id = null, organizationId = null, filters = {}, generatedAt = '', findings = []}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.filters = filters;
        this.generatedAt = generatedAt;
        this.findings = findings;
    }

    /**
     * Returns the total findings value for this entity.
     *
     * @returns {number}
     */
    get totalFindings() {
        return this.findings.length;
    }

    /**
     * Returns the open findings value for this entity.
     *
     * @returns {*}
     */
    get openFindings() {
        return this.findings.filter(finding => finding.status === FindingStatus.Open).length;
    }

    /**
     * Returns the closed findings value for this entity.
     *
     * @returns {*}
     */
    get closedFindings() {
        return this.findings.filter(finding => finding.status === FindingStatus.Closed).length;
    }

    /**
     * Returns the affected assets value for this entity.
     *
     * @returns {*}
     */
    get affectedAssets() {
        return new Set(this.findings.map(finding => finding.assetId)).size;
    }

    /**
     * Returns the potential non compliance value for this entity.
     *
     * @returns {*}
     */
    get potentialNonCompliance() {
        return this.findings.filter(finding => finding.severity === 'potential-non-compliance').length;
    }

    /**
     * Returns the limitations value for this entity.
     *
     * @returns {*}
     */
    get limitations() {
        return this.findings.filter(finding => finding.severity === 'limitation').length;
    }

    /**
     * Returns the has findings value for this entity.
     *
     * @returns {boolean}
     */
    get hasFindings() {
        return this.totalFindings > 0;
    }
}
