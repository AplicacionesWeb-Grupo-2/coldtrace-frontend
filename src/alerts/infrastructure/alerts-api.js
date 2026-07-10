import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';
import {IncidentLifecycleApiEndpoint} from '@/alerts/infrastructure/incident-lifecycle-api-endpoint.js';

const incidentsEndpointPath = import.meta.env.VITE_INCIDENTS_ENDPOINT_PATH ?? '/incidents';
const notificationsEndpointPath = import.meta.env.VITE_NOTIFICATIONS_ENDPOINT_PATH ?? '/notifications';

/**
 * HTTP facade for alerts resources.
 */
export class AlertsApi extends BaseApi {
    #incidentsEndpoint;
    #notificationsEndpoint;

    /**
     * Initializes alerts api endpoint helpers.
     */
    constructor() {
        super();
        this.#incidentsEndpoint = new BaseEndpoint(this, incidentsEndpointPath);
        this.#notificationsEndpoint = new BaseEndpoint(this, notificationsEndpointPath);
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
     * Creates incident in the alerts context.
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
     * Updates incident in the alerts context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateIncident(organizationId, resource) {
        const endpointPath = this.organizationScopedPath(organizationId, incidentsEndpointPath);
        if (!endpointPath) return Promise.reject(new Error('Organization is required to update an incident.'));

        return new IncidentLifecycleApiEndpoint(this, endpointPath).updateLifecycle(resource);
    }

    /**
     * Requests notifications from the API.
     *
     * @returns {Promise<*>}
     */
    getNotifications() {
        return this.emptyCollectionResponse();
    }

    /**
     * Requests notifications from the API.
     *
     * @param {number|string} organizationId
     * @returns {Promise<*>}
     */
    getNotificationsForOrganization(organizationId) {
        return this.#endpointForOrganization(organizationId, notificationsEndpointPath)?.getAll() ?? this.emptyCollectionResponse();
    }

    /**
     * Creates notification in the alerts context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createNotification(resource) {
        return Promise.resolve({status: 201, data: resource});
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
