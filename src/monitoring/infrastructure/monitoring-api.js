import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const sensorReadingsEndpointPath = import.meta.env.VITE_SENSOR_READINGS_ENDPOINT_PATH ?? '/sensor-readings';
const incidentsEndpointPath = import.meta.env.VITE_INCIDENTS_ENDPOINT_PATH ?? '/incidents';
const maintenanceSchedulesEndpointPath = import.meta.env.VITE_MAINTENANCE_SCHEDULES_ENDPOINT_PATH ?? '/maintenance-schedules';
const technicalServiceRequestsEndpointPath = import.meta.env.VITE_TECHNICAL_SERVICE_REQUESTS_ENDPOINT_PATH ?? '/technical-service-requests';

/**
 * HTTP facade for monitoring resources.
 */
export class MonitoringApi extends BaseApi {
    #sensorReadingsEndpoint;
    #incidentsEndpoint;
    #maintenanceSchedulesEndpoint;
    #technicalServiceRequestsEndpoint;

    /**
     * Initializes monitoring api endpoint helpers.
     */
    constructor() {
        super();
        this.#sensorReadingsEndpoint = new BaseEndpoint(this, sensorReadingsEndpointPath);
        this.#incidentsEndpoint = new BaseEndpoint(this, incidentsEndpointPath);
        this.#maintenanceSchedulesEndpoint = new BaseEndpoint(this, maintenanceSchedulesEndpointPath);
        this.#technicalServiceRequestsEndpoint = new BaseEndpoint(this, technicalServiceRequestsEndpointPath);
    }

    /**
     * Requests sensor readings from the API.
     *
     * @returns {Promise<*>}
     */
    getSensorReadings() {
        return this.#sensorReadingsEndpoint.getAll();
    }

    /**
     * Creates sensor reading in the monitoring context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createSensorReading(resource) {
        const {id: _temporaryId, ...resourceWithoutId} = resource;
        return this.#sensorReadingsEndpoint.create(resourceWithoutId);
    }

    /**
     * Requests incidents from the API.
     *
     * @returns {Promise<*>}
     */
    getIncidents() {
        return this.#incidentsEndpoint.getAll();
    }

    /**
     * Creates incident in the monitoring context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createIncident(resource) {
        const {id: _temporaryId, ...resourceWithoutId} = resource;
        return this.#incidentsEndpoint.create(resourceWithoutId);
    }

    /**
     * Updates incident in the monitoring context.
     *
     * @param {number|string} id
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateIncident(id, resource) {
        return this.#incidentsEndpoint.update(id, resource);
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
     * Requests technical service requests from the API.
     *
     * @returns {Promise<*>}
     */
    getTechnicalServiceRequests() {
        return this.#technicalServiceRequestsEndpoint.getAll();
    }
}
