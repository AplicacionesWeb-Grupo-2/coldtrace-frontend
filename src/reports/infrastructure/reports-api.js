import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const reportsEndpointPath = import.meta.env.VITE_REPORTS_ENDPOINT_PATH ?? '/reports';

export class ReportsApi extends BaseApi {
    #reportsEndpoint;

    constructor() {
        super();
        this.#reportsEndpoint = new BaseEndpoint(this, reportsEndpointPath);
    }

    getReports() {
        return this.#reportsEndpoint.getAll();
    }

    createReport(resource) {
        return this.#reportsEndpoint.create(resource);
    }
}
