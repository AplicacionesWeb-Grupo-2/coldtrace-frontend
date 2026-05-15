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
        return this.#reportsEndpoint.getAll();
    }

    /**
     * Creates report in the reports context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createReport(resource) {
        return this.#reportsEndpoint.create(resource);
    }
}
