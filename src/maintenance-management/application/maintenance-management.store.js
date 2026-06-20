import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {MaintenanceManagementApi} from '@/maintenance-management/infrastructure/maintenance-management-api.js';
import {MaintenanceScheduleAssembler} from '@/maintenance-management/infrastructure/maintenance-schedule.assembler.js';
import {TechnicalServiceRequestAssembler} from '@/maintenance-management/infrastructure/technical-service-request.assembler.js';
import {MaintenanceScheduleStatus} from '@/maintenance-management/domain/model/maintenance-schedule-status.js';
import {TechnicalServiceStatus} from '@/maintenance-management/domain/model/technical-service-status.js';

const maintenanceManagementApi = new MaintenanceManagementApi();

/**
 * Pinia store that coordinates maintenance management application state and use cases.
 *
 * @returns {import('pinia').StoreDefinition}
 */
const useMaintenanceManagementStore = defineStore('maintenance-management', () => {
    const maintenanceSchedules = ref([]);
    const technicalServiceRequests = ref([]);
    const loading = ref(false);
    const errors = ref([]);
    const maintenanceSchedulesLoaded = ref(false);
    const technicalServiceRequestsLoaded = ref(false);

    const pendingCount = computed(() =>
        maintenanceSchedules.value.filter(schedule => isOpenSchedule(schedule)).length,
    );
    const openTechnicalServiceCount = computed(() =>
        technicalServiceRequests.value.filter(request => isOpenTechnicalService(request)).length,
    );

    /**
     * Loads maintenance schedules from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchMaintenanceSchedules(organizationId) {
        if (!organizationId) {
            maintenanceSchedules.value = [];
            maintenanceSchedulesLoaded.value = false;
            return maintenanceSchedules.value;
        }

        const response = await maintenanceManagementApi.getMaintenanceSchedulesForOrganization(organizationId);
        maintenanceSchedules.value = MaintenanceScheduleAssembler.toEntitiesFromResponse(response);
        maintenanceSchedulesLoaded.value = true;
        return maintenanceSchedules.value;
    }

    /**
     * Loads technical service requests from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchTechnicalServiceRequests(organizationId) {
        if (!organizationId) {
            technicalServiceRequests.value = [];
            technicalServiceRequestsLoaded.value = false;
            return technicalServiceRequests.value;
        }

        const response = await maintenanceManagementApi.getTechnicalServiceRequestsForOrganization(organizationId);
        technicalServiceRequests.value = TechnicalServiceRequestAssembler.toEntitiesFromResponse(response);
        technicalServiceRequestsLoaded.value = true;
        return technicalServiceRequests.value;
    }

    /**
     * Loads maintenance management data from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchMaintenanceManagementData(organizationId) {
        loading.value = true;
        errors.value = [];

        try {
            if (!organizationId) {
                maintenanceSchedules.value = [];
                technicalServiceRequests.value = [];
                return {
                    maintenanceSchedules: maintenanceSchedules.value,
                    technicalServiceRequests: technicalServiceRequests.value,
                };
            }

            await Promise.all([
                fetchMaintenanceSchedules(organizationId),
                fetchTechnicalServiceRequests(organizationId),
            ]);
            return {
                maintenanceSchedules: maintenanceSchedules.value,
                technicalServiceRequests: technicalServiceRequests.value,
            };
        } catch (error) {
            errors.value.push(error);
            throw error;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Creates maintenance schedule in the maintenance management context.
     *
     * @param {*} maintenanceSchedule
     * @returns {Promise<*>}
     */
    async function createMaintenanceSchedule(maintenanceSchedule) {
        const response = await maintenanceManagementApi.createMaintenanceSchedule(
            maintenanceSchedule.organizationId,
            MaintenanceScheduleAssembler.toResourceFromEntity(maintenanceSchedule),
        );
        const createdSchedule = MaintenanceScheduleAssembler.toEntityFromResource(response.data);
        maintenanceSchedules.value.push(createdSchedule);
        return createdSchedule;
    }

    /**
     * Updates maintenance schedule in the maintenance management context.
     *
     * @param {*} maintenanceSchedule
     * @returns {Promise<*>}
     */
    async function updateMaintenanceSchedule(maintenanceSchedule) {
        const response = await maintenanceManagementApi.updateMaintenanceSchedule(
            maintenanceSchedule.organizationId,
            MaintenanceScheduleAssembler.toResourceFromEntity(maintenanceSchedule),
        );
        const updatedSchedule = MaintenanceScheduleAssembler.toEntityFromResource(response.data);
        maintenanceSchedules.value = maintenanceSchedules.value.map(schedule =>
            schedule.id === updatedSchedule.id ? updatedSchedule : schedule,
        );
        return updatedSchedule;
    }

    /**
     * Creates technical service request in the maintenance management context.
     *
     * @param {*} technicalServiceRequest
     * @returns {Promise<*>}
     */
    async function createTechnicalServiceRequest(technicalServiceRequest) {
        const response = await maintenanceManagementApi.createTechnicalServiceRequest(
            technicalServiceRequest.organizationId,
            TechnicalServiceRequestAssembler.toResourceFromEntity(technicalServiceRequest),
        );
        const createdRequest = TechnicalServiceRequestAssembler.toEntityFromResource(response.data);
        technicalServiceRequests.value.push(createdRequest);
        return createdRequest;
    }

    /**
     * Updates technical service request in the maintenance management context.
     *
     * @param {*} technicalServiceRequest
     * @returns {Promise<*>}
     */
    async function updateTechnicalServiceRequest(technicalServiceRequest) {
        const response = await maintenanceManagementApi.updateTechnicalServiceRequest(
            technicalServiceRequest.organizationId,
            TechnicalServiceRequestAssembler.toResourceFromEntity(technicalServiceRequest),
        );
        const updatedRequest = TechnicalServiceRequestAssembler.toEntityFromResource(response.data);
        technicalServiceRequests.value = technicalServiceRequests.value.map(request =>
            request.id === updatedRequest.id ? updatedRequest : request,
        );
        return updatedRequest;
    }

    /**
     * Handles schedules for organization behavior in the maintenance management context.
     *
     * @param {number|string} organizationId
     * @param {Array<*>} availableSchedules
     * @returns {*}
     */
    function schedulesForOrganization(organizationId, availableSchedules = maintenanceSchedules.value) {
        if (!organizationId) return [];
        return availableSchedules.filter(schedule => schedule.organizationId === Number(organizationId));
    }

    /**
     * Handles technical services for organization behavior in the maintenance management context.
     *
     * @param {number|string} organizationId
     * @param {Array<*>} availableRequests
     * @returns {*}
     */
    function technicalServicesForOrganization(organizationId, availableRequests = technicalServiceRequests.value) {
        if (!organizationId) return [];
        return availableRequests.filter(request => request.organizationId === Number(organizationId));
    }

    /**
     * Handles next schedule id behavior in the maintenance management context.
     *
     * @returns {*}
     */
    function nextScheduleId() {
        return Math.max(...maintenanceSchedules.value.map(schedule => schedule.id), 0) + 1;
    }

    /**
     * Handles next technical service request id behavior in the maintenance management context.
     *
     * @returns {*}
     */
    function nextTechnicalServiceRequestId() {
        return Math.max(...technicalServiceRequests.value.map(request => request.id), 0) + 1;
    }

    /**
     * Determines whether open schedule for asset period exists.
     *
     * @param {number|string} organizationId
     * @param {number|string} assetId
     * @param {*} period
     * @returns {boolean}
     */
    function hasOpenScheduleForAssetPeriod(organizationId, assetId, period) {
        return schedulesForOrganization(organizationId).some(schedule =>
            schedule.assetId === Number(assetId) &&
            schedule.period === period &&
            isOpenSchedule(schedule),
        );
    }

    /**
     * Determines whether open schedule is true.
     *
     * @param {*} schedule
     * @returns {boolean}
     */
    function isOpenSchedule(schedule) {
        return schedule.status === MaintenanceScheduleStatus.Scheduled ||
            schedule.status === MaintenanceScheduleStatus.Pending;
    }

    /**
     * Determines whether open technical service is true.
     *
     * @param {*} request
     * @returns {boolean}
     */
    function isOpenTechnicalService(request) {
        return request.status === TechnicalServiceStatus.Open ||
            request.status === TechnicalServiceStatus.PendingReview;
    }

    return {
        maintenanceSchedules,
        technicalServiceRequests,
        loading,
        errors,
        maintenanceSchedulesLoaded,
        technicalServiceRequestsLoaded,
        pendingCount,
        openTechnicalServiceCount,
        fetchMaintenanceSchedules,
        fetchTechnicalServiceRequests,
        fetchMaintenanceManagementData,
        createMaintenanceSchedule,
        updateMaintenanceSchedule,
        createTechnicalServiceRequest,
        updateTechnicalServiceRequest,
        schedulesForOrganization,
        technicalServicesForOrganization,
        nextScheduleId,
        nextTechnicalServiceRequestId,
        hasOpenScheduleForAssetPeriod,
        isOpenSchedule,
        isOpenTechnicalService,
    };
});

export default useMaintenanceManagementStore;
