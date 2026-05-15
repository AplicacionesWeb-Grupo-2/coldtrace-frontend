import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

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
        return this.#incidentsEndpoint.getAll();
    }

    /**
     * Creates incident in the alerts context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createIncident(resource) {
        return this.#incidentsEndpoint.create(resource);
    }

    /**
     * Updates incident in the alerts context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    updateIncident(resource) {
        return this.#incidentsEndpoint.update(resource.id, resource);
    }

    /**
     * Requests notifications from the API.
     *
     * @returns {Promise<*>}
     */
    getNotifications() {
        return this.#notificationsEndpoint.getAll();
    }

    /**
     * Creates notification in the alerts context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    createNotification(resource) {
        return this.#notificationsEndpoint.create(resource);
    }
}
