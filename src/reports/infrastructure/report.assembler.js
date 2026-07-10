import {Report} from '@/reports/domain/model/report-entity.js';
import {ReportType} from '@/reports/domain/model/report-type.js';

/**
 * @typedef {Object} ReportApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [uuid]
 * @property {*} [type]
 * @property {*} [title]
 * @property {*} [periodDate]
 * @property {*} [periodStart]
 * @property {*} [periodEnd]
 * @property {*} [generatedAt]
 * @property {*} [assetCount]
 * @property {*} [readingCount]
 * @property {*} [outOfRangeReadingCount]
 * @property {*} [incidentCount]
 * @property {*} [openIncidentCount]
 * @property {*} [averageTemperature]
 * @property {*} [averageHumidity]
 * @property {*} [compliancePercentage]
 */

/**
 * Maps report resources between API payloads and domain entities.
 */
export class ReportAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {ReportApiResource} resource
     * @returns {Report}
     */
    static toEntityFromResource(resource) {
        return new Report({
            ...resource,
            type: reportTypeFrom(resource.type),
            periodDate: periodDateFrom(resource),
        });
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<ReportApiResource[]|Object>} response
     * @returns {Report[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.reports;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {Report} entity
     * @returns {ReportApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            uuid: entity.uuid,
            type: entity.type,
            title: entity.title,
            periodDate: entity.periodDate,
            generatedAt: entity.generatedAt,
            assetCount: entity.assetCount,
            readingCount: entity.readingCount,
            outOfRangeReadingCount: entity.outOfRangeReadingCount,
            incidentCount: entity.incidentCount,
            openIncidentCount: entity.openIncidentCount,
            averageTemperature: entity.averageTemperature,
            averageHumidity: entity.averageHumidity,
            compliancePercentage: entity.compliancePercentage,
        };
    }
}

/**
 * Maps backend report type values to the presentation contract.
 *
 * @param {string} type
 * @returns {string}
 */
function reportTypeFrom(type) {
    return {
        DAILY_LOG: ReportType.DailyLog,
        COMPLIANCE: ReportType.Compliance,
        MONTHLY_SUMMARY: ReportType.MonthlySummary,
        daily_log: ReportType.DailyLog,
        compliance: ReportType.Compliance,
        monthly_summary: ReportType.MonthlySummary,
        'daily-log': ReportType.DailyLog,
        'monthly-summary': ReportType.MonthlySummary,
    }[type] ?? ReportType.DailyLog;
}

/**
 * Normalizes backend report period labels to the UI range format.
 *
 * @param {*} resource
 * @returns {string}
 */
function periodDateFrom(resource) {
    const periodDate = resource.periodDate ?? '';
    if (periodDate.includes('/')) {
        const [fromDate, toDate] = periodDate.split('/');
        return fromDate === toDate ? fromDate : `${fromDate} - ${toDate}`;
    }
    if (periodDate) return periodDate;
    if (resource.periodStart && resource.periodEnd) {
        const fromDate = String(resource.periodStart).slice(0, 10);
        const toDate = String(resource.periodEnd).slice(0, 10);
        return fromDate === toDate ? fromDate : `${fromDate} - ${toDate}`;
    }
    return '';
}
