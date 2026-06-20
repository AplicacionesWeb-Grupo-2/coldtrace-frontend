import {MaintenanceSchedule} from '@/monitoring/domain/model/maintenance-schedule-entity.js';

/**
 * @typedef {Object} MaintenanceScheduleApiResource
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [uuid]
 * @property {number|null} [assetId]
 * @property {number|null} [iotDeviceId]
 * @property {string} [scheduledDate]
 * @property {string} [period]
 * @property {string} [observations]
 * @property {string} [status]
 * @property {string} [createdAt]
 */

/**
 * Maps maintenance schedule resources between API payloads and domain entities.
 */
export class MaintenanceScheduleAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {MaintenanceScheduleApiResource} resource
     * @returns {MaintenanceSchedule}
     */
    static toEntityFromResource(resource) {
        return new MaintenanceSchedule({
            ...resource,
            period: resource.period ?? dateKeyFrom(resource.scheduledDate),
            createdAt: resource.createdAt ?? '',
        });
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<MaintenanceScheduleApiResource[]|Object>} response
     * @returns {MaintenanceSchedule[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.maintenanceSchedules;
        return (resources ?? []).map(resource => this.toEntityFromResource(resource));
    }
}

/**
 * Extracts a date key suitable for period display.
 *
 * @param {string} value
 * @returns {string}
 */
function dateKeyFrom(value) {
    return value ? String(value).slice(0, 7) : '';
}
