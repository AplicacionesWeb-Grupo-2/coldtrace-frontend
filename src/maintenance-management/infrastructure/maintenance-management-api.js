import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const maintenanceSchedulesEndpointPath = import.meta.env.VITE_MAINTENANCE_SCHEDULES_ENDPOINT_PATH ?? '/maintenance-schedules';
const technicalServiceRequestsEndpointPath = import.meta.env.VITE_TECHNICAL_SERVICE_REQUESTS_ENDPOINT_PATH ?? '/technical-service-requests';

export class MaintenanceManagementApi extends BaseApi {
    #maintenanceSchedulesEndpoint;
    #technicalServiceRequestsEndpoint;

    constructor() {
        super();
        this.#maintenanceSchedulesEndpoint = new BaseEndpoint(this, maintenanceSchedulesEndpointPath);
        this.#technicalServiceRequestsEndpoint = new BaseEndpoint(this, technicalServiceRequestsEndpointPath);
    }

    getMaintenanceSchedules() {
        return this.#maintenanceSchedulesEndpoint.getAll();
    }

    createMaintenanceSchedule(resource) {
        return this.#maintenanceSchedulesEndpoint.create(resource);
    }

    updateMaintenanceSchedule(resource) {
        return this.#maintenanceSchedulesEndpoint.update(resource.id, resource);
    }

    getTechnicalServiceRequests() {
        return this.#technicalServiceRequestsEndpoint.getAll();
    }

    createTechnicalServiceRequest(resource) {
        return this.#technicalServiceRequestsEndpoint.create(resource);
    }

    updateTechnicalServiceRequest(resource) {
        return this.#technicalServiceRequestsEndpoint.update(resource.id, resource);
    }
}
