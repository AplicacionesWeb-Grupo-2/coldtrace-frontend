import {ReportType} from '@/reports/domain/model/report-type.js';

/**
 * @typedef {Object} ReportProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [uuid]
 * @property {*} [type]
 * @property {string} [title]
 * @property {string} [periodDate]
 * @property {string} [generatedAt]
 * @property {number|null} [assetCount]
 * @property {number|null} [compliancePercentage]
 * @property {number|null} [incidentCount]
 * @property {number|null} [openIncidentCount]
 * @property {number|null} [outOfRangeReadingCount]
 */

/**
 * Domain entity representing report.
 */
export class Report {
    /**
     * @param {ReportProps} [props]
     */
    constructor({
        id = null,
        organizationId = null,
        uuid = '',
        type = ReportType.DailyLog,
        title = '',
        periodDate = '',
        generatedAt = '',
        assetCount = null,
        compliancePercentage = null,
        incidentCount = null,
        openIncidentCount = null,
        outOfRangeReadingCount = null,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.uuid = uuid;
        this.type = type;
        this.title = title;
        this.periodDate = periodDate;
        this.generatedAt = generatedAt;
        this.assetCount = nullableNumber(assetCount);
        this.compliancePercentage = nullableNumber(compliancePercentage);
        this.incidentCount = nullableNumber(incidentCount);
        this.openIncidentCount = nullableNumber(openIncidentCount);
        this.outOfRangeReadingCount = nullableNumber(outOfRangeReadingCount);
    }
}

/**
 * Normalizes optional numeric metrics.
 *
 * @param {*} value
 * @returns {number|null}
 */
function nullableNumber(value) {
    return value === null || value === undefined ? null : Number(value);
}
