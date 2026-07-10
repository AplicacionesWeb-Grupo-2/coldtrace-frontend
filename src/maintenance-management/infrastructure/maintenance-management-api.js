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
     * Creates maintenance schedule in the maintenance management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createMaintenanceSchedule(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, maintenanceSchedulesEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create a maintenance schedule.'));

        return endpoint.create(this.#maintenanceScheduleRequestFrom(resource));
    }

    /**
     * Updates maintenance schedule in the maintenance management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateMaintenanceSchedule(organizationId, resource) {
        const endpointPath = this.organizationScopedPath(organizationId, `${maintenanceSchedulesEndpointPath}/${resource.id}`);
        if (!endpointPath) return Promise.reject(new Error('Organization is required to update a maintenance schedule.'));

        return this.http.patch(endpointPath, {status: resource.status});
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
     * Creates technical service request in the maintenance management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createTechnicalServiceRequest(organizationId, resource) {
        const endpoint = this.#endpointForOrganization(organizationId, technicalServiceRequestsEndpointPath);
        if (!endpoint) return Promise.reject(new Error('Organization is required to create a technical service request.'));

        return endpoint.create(this.#technicalServiceRequestFrom(resource));
    }

    /**
     * Updates technical service request in the maintenance management context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateTechnicalServiceRequest(organizationId, resource) {
        const endpointPath = this.organizationScopedPath(organizationId, `${technicalServiceRequestsEndpointPath}/${resource.id}`);
        if (!endpointPath) return Promise.reject(new Error('Organization is required to update a technical service request.'));

        return this.http.patch(endpointPath, this.#technicalServiceStatusRequestFrom(resource));
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
     * Maps schedule data to backend create request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #maintenanceScheduleRequestFrom(resource) {
        return {
            assetId: resource.assetId,
            scheduledDate: this.#dateTimeFrom(resource.scheduledDate),
            observations: resource.observations,
            status: resource.status,
        };
    }

    /**
     * Converts a date input value to the API DateTimeOffset contract.
     *
     * @param {string} value
     * @returns {string}
     */
    #dateTimeFrom(value) {
        return value.includes('T') ? value : `${value}T00:00:00Z`;
    }

    /**
     * Maps technical service data to backend create request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #technicalServiceRequestFrom(resource) {
        return {
            assetId: resource.assetId,
            incidentId: resource.incidentId ?? null,
            issueDescription: resource.issueDescription,
            priority: resource.priority,
            requestedBy: resource.requestedBy ?? null,
        };
    }

    /**
     * Maps technical service lifecycle data to backend patch request.
     *
     * @param {*} resource
     * @returns {*}
     */
    #technicalServiceStatusRequestFrom(resource) {
        return {
            status: resource.status,
            closureSummary: resource.resultNotes ?? null,
            evidence: resource.interventionNotes ?? null,
            closedBy: resource.closedBy ?? null,
        };
    }
}
