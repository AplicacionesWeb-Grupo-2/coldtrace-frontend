import {Report} from '@/reports/domain/model/report-entity.js';

/**
 * @typedef {Object} ReportApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [uuid]
 * @property {*} [type]
 * @property {*} [title]
 * @property {*} [periodDate]
 * @property {*} [generatedAt]
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
        };
    }
}

/**
 * Normalizes backend report period labels to the UI range format.
 *
 * @param {*} resource
 * @returns {string}
 */
function periodDateFrom(resource) {
    const periodDate = resource.periodDate ?? '';
    if (periodDate.includes('/')) return periodDate.replace('/', ' - ');
    if (periodDate) return periodDate;
    if (resource.periodStart && resource.periodEnd) {
        return `${String(resource.periodStart).slice(0, 10)} - ${String(resource.periodEnd).slice(0, 10)}`;
    }
    return '';
}
