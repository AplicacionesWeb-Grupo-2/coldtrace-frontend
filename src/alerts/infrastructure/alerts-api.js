import {BaseApi} from '@/shared/infrastructure/base-api.js';
import {BaseEndpoint} from '@/shared/infrastructure/base-endpoint.js';

const incidentsEndpointPath = import.meta.env.VITE_INCIDENTS_ENDPOINT_PATH ?? '/incidents';
const notificationsEndpointPath = import.meta.env.VITE_NOTIFICATIONS_ENDPOINT_PATH ?? '/notifications';

export class AlertsApi extends BaseApi {
    #incidentsEndpoint;
    #notificationsEndpoint;

    constructor() {
        super();
        this.#incidentsEndpoint = new BaseEndpoint(this, incidentsEndpointPath);
        this.#notificationsEndpoint = new BaseEndpoint(this, notificationsEndpointPath);
    }

    getIncidents() {
        return this.#incidentsEndpoint.getAll();
    }

    createIncident(resource) {
        return this.#incidentsEndpoint.create(resource);
    }

    updateIncident(resource) {
        return this.#incidentsEndpoint.update(resource.id, resource);
    }

    getNotifications() {
        return this.#notificationsEndpoint.getAll();
    }

    createNotification(resource) {
        return this.#notificationsEndpoint.create(resource);
    }
}
