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
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.uuid = uuid;
        this.type = type;
        this.title = title;
        this.periodDate = periodDate;
        this.generatedAt = generatedAt;
    }
}
