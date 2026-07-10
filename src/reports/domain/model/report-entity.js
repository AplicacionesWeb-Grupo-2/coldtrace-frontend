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
 * @property {number|null} [readingCount]
 * @property {number|null} [outOfRangeReadingCount]
 * @property {number|null} [incidentCount]
 * @property {number|null} [openIncidentCount]
 * @property {number|null} [averageTemperature]
 * @property {number|null} [averageHumidity]
 * @property {number|null} [compliancePercentage]
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
        readingCount = null,
        outOfRangeReadingCount = null,
        incidentCount = null,
        openIncidentCount = null,
        averageTemperature = null,
        averageHumidity = null,
        compliancePercentage = null,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.uuid = uuid;
        this.type = type;
        this.title = title;
        this.periodDate = periodDate;
        this.generatedAt = generatedAt;
        this.assetCount = numberOrNull(assetCount);
        this.readingCount = numberOrNull(readingCount);
        this.outOfRangeReadingCount = numberOrNull(outOfRangeReadingCount);
        this.incidentCount = numberOrNull(incidentCount);
        this.openIncidentCount = numberOrNull(openIncidentCount);
        this.averageTemperature = numberOrNull(averageTemperature);
        this.averageHumidity = numberOrNull(averageHumidity);
        this.compliancePercentage = numberOrNull(compliancePercentage);
    }
}

/**
 * Preserves nullable numeric report metrics.
 *
 * @param {*} value
 * @returns {number|null}
 */
function numberOrNull(value) {
    return value === null || value === undefined ? null : Number(value);
}
