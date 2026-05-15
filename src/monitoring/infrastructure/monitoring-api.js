import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const sensorReadingsEndpointPath = import.meta.env.VITE_SENSOR_READINGS_ENDPOINT_PATH ?? '/sensor-readings';
const incidentsEndpointPath = import.meta.env.VITE_INCIDENTS_ENDPOINT_PATH ?? '/incidents';
const maintenanceSchedulesEndpointPath = import.meta.env.VITE_MAINTENANCE_SCHEDULES_ENDPOINT_PATH ?? '/maintenance-schedules';
const technicalServiceRequestsEndpointPath = import.meta.env.VITE_TECHNICAL_SERVICE_REQUESTS_ENDPOINT_PATH ?? '/technical-service-requests';

export class MonitoringApi extends BaseApi {
    #sensorReadingsEndpoint;
    #incidentsEndpoint;
    #maintenanceSchedulesEndpoint;
    #technicalServiceRequestsEndpoint;

    constructor() {
        super();
        this.#sensorReadingsEndpoint = new BaseEndpoint(this, sensorReadingsEndpointPath);
        this.#incidentsEndpoint = new BaseEndpoint(this, incidentsEndpointPath);
        this.#maintenanceSchedulesEndpoint = new BaseEndpoint(this, maintenanceSchedulesEndpointPath);
        this.#technicalServiceRequestsEndpoint = new BaseEndpoint(this, technicalServiceRequestsEndpointPath);
    }

    getSensorReadings() {
        return this.#sensorReadingsEndpoint.getAll();
    }

    createSensorReading(resource) {
        const {id: _temporaryId, ...resourceWithoutId} = resource;
        return this.#sensorReadingsEndpoint.create(resourceWithoutId);
    }

    getIncidents() {
        return this.#incidentsEndpoint.getAll();
    }

    createIncident(resource) {
        const {id: _temporaryId, ...resourceWithoutId} = resource;
        return this.#incidentsEndpoint.create(resourceWithoutId);
    }

    updateIncident(id, resource) {
        return this.#incidentsEndpoint.update(id, resource);
    }

    getMaintenanceSchedules() {
        return this.#maintenanceSchedulesEndpoint.getAll();
    }

    getTechnicalServiceRequests() {
        return this.#technicalServiceRequestsEndpoint.getAll();
    }
}
