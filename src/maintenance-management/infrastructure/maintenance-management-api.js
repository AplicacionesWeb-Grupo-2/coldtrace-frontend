import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const maintenanceSchedulesEndpointPath = import.meta.env.VITE_MAINTENANCE_SCHEDULES_ENDPOINT_PATH ?? '/maintenance-schedules';
const technicalServiceRequestsEndpointPath = import.meta.env.VITE_TECHNICAL_SERVICE_REQUESTS_ENDPOINT_PATH ?? '/technical-service-requests';

/**
 * HTTP facade for maintenance management resources.
 */
export class MaintenanceManagementApi extends BaseApi {
    #maintenanceSchedulesEndpoint;
    #technicalServiceRequestsEndpoint;

    /**
     * Initializes maintenance management api endpoint helpers.
     */
    constructor() {
        super();
        this.#maintenanceSchedulesEndpoint = new BaseEndpoint(this, maintenanceSchedulesEndpointPath);
        this.#technicalServiceRequestsEndpoint = new BaseEndpoint(this, technicalServiceRequestsEndpointPath);
    }

    /**
     * Requests maintenance schedules from the API.
     *
     * @returns {Promise<*>}
     */
    getMaintenanceSchedules() {
        return this.#maintenanceSchedulesEndpoint.getAll();
    }

    /**
     * Creates maintenance schedule in the maintenance management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createMaintenanceSchedule(resource) {
        return this.#maintenanceSchedulesEndpoint.create(resource);
    }

    /**
     * Updates maintenance schedule in the maintenance management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateMaintenanceSchedule(resource) {
        return this.#maintenanceSchedulesEndpoint.update(resource.id, resource);
    }

    /**
     * Requests technical service requests from the API.
     *
     * @returns {Promise<*>}
     */
    getTechnicalServiceRequests() {
        return this.#technicalServiceRequestsEndpoint.getAll();
    }

    /**
     * Creates technical service request in the maintenance management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createTechnicalServiceRequest(resource) {
        return this.#technicalServiceRequestsEndpoint.create(resource);
    }

    /**
     * Updates technical service request in the maintenance management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateTechnicalServiceRequest(resource) {
        return this.#technicalServiceRequestsEndpoint.update(resource.id, resource);
    }
}
