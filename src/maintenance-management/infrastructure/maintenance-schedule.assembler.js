import {MaintenanceSchedule} from '@/maintenance-management/domain/model/maintenance-schedule-entity.js';
import {MaintenanceScheduleStatus} from '@/maintenance-management/domain/model/maintenance-schedule-status.js';

/**
 * @typedef {Object} MaintenanceScheduleApiResource
 * @property {*} [id]
 * @property {*} [organizationId]
 * @property {*} [uuid]
 * @property {*} [assetId]
 * @property {*} [iotDeviceId]
 * @property {*} [scheduledDate]
 * @property {*} [period]
 * @property {*} [observations]
 * @property {*} [status]
 * @property {*} [createdAt]
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
            status: maintenanceScheduleStatusForUi(resource.status),
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

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {MaintenanceSchedule} entity
     * @returns {MaintenanceScheduleApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            organizationId: entity.organizationId,
            uuid: entity.uuid,
            assetId: entity.assetId,
            iotDeviceId: entity.iotDeviceId,
            scheduledDate: entity.scheduledDate,
            period: entity.period,
            observations: entity.observations,
            status: entity.status,
            createdAt: entity.createdAt,
        };
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

/**
 * Maps backend schedule lifecycle values to UI status values.
 *
 * @param {string} status
 * @returns {string}
 */
function maintenanceScheduleStatusForUi(status) {
    return status === 'in_progress' ? MaintenanceScheduleStatus.Pending : status;
}
