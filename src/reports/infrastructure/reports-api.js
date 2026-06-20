import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const reportsEndpointPath = import.meta.env.VITE_REPORTS_ENDPOINT_PATH ?? '/reports';

/**
 * HTTP facade for reports resources.
 */
export class ReportsApi extends BaseApi {
    #reportsEndpoint;

    /**
     * Initializes reports api endpoint helpers.
     */
    constructor() {
        super();
        this.#reportsEndpoint = new BaseEndpoint(this, reportsEndpointPath);
    }

    /**
     * Requests reports from the API.
     *
     * @returns {Promise<*>}
     */
    getReports() {
        return this.emptyCollectionResponse();
    }

    /**
     * Requests reports from the API.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    getReportsForOrganization(organizationId) {
        return this.#endpointForOrganization(organizationId)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Creates report in the reports context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createReport(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create a report.'));

        return endpoint.create(this.#reportRequestFrom(resource));
    }

    /**
     * Builds an endpoint helper for an organization-scoped resource.
     *
     * @param {number|string} organizationId
     * @returns {BaseEndpoint|null}
     */
    #endpointForOrganization(organizationId) {
        const scopedPath = this.organizationScopedPath(organizationId, reportsEndpointPath);
        return scopedPath ? new BaseEndpoint(this, scopedPath) : null;
    }

    /**
     * Maps report data to backend generation request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #reportRequestFrom(resource) {
        const period = periodRangeFrom(resource.periodDate);
        return {
            type: resource.type,
            title: resource.title,
            periodStart: period.start,
            periodEnd: period.end,
        };
    }
}

/**
 * Maps a UI period label to backend date-time bounds.
 *
 * @param {string} periodDate
 * @returns {{start: string, end: string}}
 */
function periodRangeFrom(periodDate) {
    const value = periodDate || new Date().toISOString().slice(0, 10);
    if (value.includes(' - ')) {
        const [start, end] = value.split(' - ');
        return {start: startOfDay(start), end: endOfDay(end)};
    }

    if (/^\d{4}-\d{2}$/.test(value)) {
        const start = `${value}-01`;
        const endDate = new Date(`${start}T00:00:00.000Z`);
        endDate.setUTCMonth(endDate.getUTCMonth() + 1);
        endDate.setUTCDate(0);
        return {start: startOfDay(start), end: endOfDay(endDate.toISOString().slice(0, 10))};
    }

    return {start: startOfDay(value.slice(0, 10)), end: endOfDay(value.slice(0, 10))};
}

/**
 * Builds an ISO start-of-day timestamp.
 *
 * @param {string} date
 * @returns {string}
 */
function startOfDay(date) {
    return `${date}T00:00:00.000Z`;
}

/**
 * Builds an ISO end-of-day timestamp.
 *
 * @param {string} date
 * @returns {string}
 */
function endOfDay(date) {
    return `${date}T23:59:59.999Z`;
}
