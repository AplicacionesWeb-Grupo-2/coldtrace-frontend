import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const sensorReadingsEndpointPath = import.meta.env.VITE_SENSOR_READINGS_ENDPOINT_PATH ?? '/sensor-readings';
const incidentsEndpointPath = import.meta.env.VITE_INCIDENTS_ENDPOINT_PATH ?? '/incidents';
const maintenanceSchedulesEndpointPath = import.meta.env.VITE_MAINTENANCE_SCHEDULES_ENDPOINT_PATH ?? '/maintenance-schedules';
const technicalServiceRequestsEndpointPath = import.meta.env.VITE_TECHNICAL_SERVICE_REQUESTS_ENDPOINT_PATH ?? '/technical-service-requests';
const dashboardAiInterpretationEndpointPath = import.meta.env.VITE_DASHBOARD_AI_INTERPRETATION_ENDPOINT_PATH ?? '/dashboard/ai-interpretation';

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
     * Generates an AI interpretation for the active organization's dashboard.
     *
     * @param {number|string} organizationId
     * @param {{question?: string, preferredLanguage?: string}} request
     * @returns {Promise<*>}
     */
    generateDashboardAiInterpretation(organizationId, request = {}) {
        const endpointPath = this.organizationScopedPath(organizationId, dashboardAiInterpretationEndpointPath);
        if (!endpointPath) return Promise.reject(new Error('organization-scope-required'));

        return this.http.post(endpointPath, request);
    }

    /**
     * Requests sensor readings from the API.
     *
     * @returns {Promise<*>}
     */
    getSensorReadings() {
        return this.emptyCollectionResponse();
    }

    /**
     * Requests sensor readings from the API.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    getSensorReadingsForOrganization(organizationId) {
        return this.#endpointForOrganization(organizationId, sensorReadingsEndpointPath)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Creates sensor reading in the monitoring context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createSensorReading(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, sensorReadingsEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create a sensor reading.'));

        return endpoint.create(this.#sensorReadingRequestFrom(resource));
    }

    /**
     * Requests incidents from the API.
     *
     * @returns {Promise<*>}
     */
    getIncidents() {
        return this.emptyCollectionResponse();
    }

    /**
     * Requests incidents from the API.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    getIncidentsForOrganization(organizationId) {
        return this.#endpointForOrganization(organizationId, incidentsEndpointPath)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Creates incident in the monitoring context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createIncident(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, incidentsEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create an incident.'));

        return endpoint.create(this.#incidentRequestFrom(resource));
    }

    /**
     * Updates incident in the monitoring context.
     *
     * @param {number|string} id
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateIncident(organizationId, id, resource) {
        const basePath = this.organizationScopedPath(organizationId, `${incidentsEndpointPath}/${id}`);
        if (!basePath) return Promise.reject(new Error('Organization is required to update an incident.'));

        if (resource.status === 'recognized' && resource.recognizedBy) {
            return this.http.post(`${basePath}/acknowledgements`, {acknowledgedBy: resource.recognizedBy});
        }

        if (resource.status === 'closed' && resource.closedBy) {
            return this.http.post(`${basePath}/resolutions`, {
                resolvedBy: resource.closedBy,
                resolutionNotes: resource.closureEvidence ?? resource.correctiveAction ?? 'Resolved from ColdTrace.',
            });
        }

        if (resource.escalationStatus === 'escalated') {
            return this.http.patch(`${basePath}/escalation`, {
                escalatedBy: resource.escalatedTo ?? 'ColdTrace',
                escalationReason: resource.conditionKey ?? resource.type ?? 'Incident escalation threshold reached.',
            });
        }

        if (resource.correctiveAction) {
            return this.http.patch(`${basePath}/corrective-action`, {
                correctiveAction: resource.correctiveAction,
                registeredBy: resource.recognizedBy ?? resource.closedBy ?? 'ColdTrace',
            });
        }

        return Promise.resolve({status: 200, data: resource});
    }

    /**
     * Requests maintenance schedules from the API.
     *
     * @returns {Promise<*>}
     */
    getMaintenanceSchedules() {
        return this.emptyCollectionResponse();
    }

    /**
     * Requests maintenance schedules from the API.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    getMaintenanceSchedulesForOrganization(organizationId) {
        return this.#endpointForOrganization(organizationId, maintenanceSchedulesEndpointPath)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Requests technical service requests from the API.
     *
     * @returns {Promise<*>}
     */
    getTechnicalServiceRequests() {
        return this.emptyCollectionResponse();
    }

    /**
     * Requests technical service requests from the API.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    getTechnicalServiceRequestsForOrganization(organizationId) {
        return this.#endpointForOrganization(organizationId, technicalServiceRequestsEndpointPath)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Builds an endpoint helper for an organization-scoped resource.
     *
     * @param {number|string} organizationId
     * @param {string} endpointPath
     * @returns {BaseEndpoint|null}
     */
    #endpointForOrganization(organizationId, endpointPath) {
        const scopedPath = this.organizationScopedPath(organizationId, endpointPath);
        return scopedPath ? new BaseEndpoint(this, scopedPath) : null;
    }

    /**
     * Maps sensor reading data to backend create request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #sensorReadingRequestFrom(resource) {
        return {
            assetId: resource.assetId,
            iotDeviceId: resource.iotDeviceId,
            temperature: resource.temperature,
            humidity: resource.humidity,
            recordedAt: resource.recordedAt,
            motionDetected: resource.motionDetected,
            imageCaptured: resource.imageCaptured,
            batteryLevel: resource.batteryLevel,
            signalStrength: resource.signalStrength,
        };
    }

    /**
     * Maps incident data to backend create request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #incidentRequestFrom(resource) {
        return {
            assetId: resource.assetId,
            deviceId: resource.deviceId ?? resource.iotDeviceId ?? null,
            readingId: resource.readingId ?? resource.sourceReadingId ?? null,
            assetName: resource.assetName,
            deviceName: resource.deviceName ?? null,
            type: resource.type,
            severity: resource.severity,
            value: resource.value,
        };
    }
}
