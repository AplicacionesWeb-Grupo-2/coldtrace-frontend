import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import {MaintenanceManagementApi} from '@/maintenance-management/infrastructure/maintenance-management-api.js';
import {MaintenanceScheduleAssembler} from '@/maintenance-management/infrastructure/maintenance-schedule.assembler.js';
import {TechnicalServiceRequestAssembler} from '@/maintenance-management/infrastructure/technical-service-request.assembler.js';
import {MaintenanceScheduleStatus} from '@/maintenance-management/domain/model/maintenance-schedule-status.js';
import {TechnicalServiceStatus} from '@/maintenance-management/domain/model/technical-service-status.js';

const maintenanceManagementApi = new MaintenanceManagementApi();

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

    async function fetchMaintenanceSchedules() {
        const response = await maintenanceManagementApi.getMaintenanceSchedules();
        maintenanceSchedules.value = MaintenanceScheduleAssembler.toEntitiesFromResponse(response);
        maintenanceSchedulesLoaded.value = true;
        return maintenanceSchedules.value;
    }

    async function fetchTechnicalServiceRequests() {
        const response = await maintenanceManagementApi.getTechnicalServiceRequests();
        technicalServiceRequests.value = TechnicalServiceRequestAssembler.toEntitiesFromResponse(response);
        technicalServiceRequestsLoaded.value = true;
        return technicalServiceRequests.value;
    }

    async function fetchMaintenanceManagementData() {
        loading.value = true;
        errors.value = [];

        try {
            await Promise.all([
                fetchMaintenanceSchedules(),
                fetchTechnicalServiceRequests(),
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

    async function createMaintenanceSchedule(maintenanceSchedule) {
        const response = await maintenanceManagementApi.createMaintenanceSchedule(
            MaintenanceScheduleAssembler.toResourceFromEntity(maintenanceSchedule),
        );
        const createdSchedule = MaintenanceScheduleAssembler.toEntityFromResource(response.data);
        maintenanceSchedules.value.push(createdSchedule);
        return createdSchedule;
    }

    async function updateMaintenanceSchedule(maintenanceSchedule) {
        const response = await maintenanceManagementApi.updateMaintenanceSchedule(
            MaintenanceScheduleAssembler.toResourceFromEntity(maintenanceSchedule),
        );
        const updatedSchedule = MaintenanceScheduleAssembler.toEntityFromResource(response.data);
        maintenanceSchedules.value = maintenanceSchedules.value.map(schedule =>
            schedule.id === updatedSchedule.id ? updatedSchedule : schedule,
        );
        return updatedSchedule;
    }

    async function createTechnicalServiceRequest(technicalServiceRequest) {
        const response = await maintenanceManagementApi.createTechnicalServiceRequest(
            TechnicalServiceRequestAssembler.toResourceFromEntity(technicalServiceRequest),
        );
        const createdRequest = TechnicalServiceRequestAssembler.toEntityFromResource(response.data);
        technicalServiceRequests.value.push(createdRequest);
        return createdRequest;
    }

    async function updateTechnicalServiceRequest(technicalServiceRequest) {
        const response = await maintenanceManagementApi.updateTechnicalServiceRequest(
            TechnicalServiceRequestAssembler.toResourceFromEntity(technicalServiceRequest),
        );
        const updatedRequest = TechnicalServiceRequestAssembler.toEntityFromResource(response.data);
        technicalServiceRequests.value = technicalServiceRequests.value.map(request =>
            request.id === updatedRequest.id ? updatedRequest : request,
        );
        return updatedRequest;
    }

    function schedulesForOrganization(organizationId, availableSchedules = maintenanceSchedules.value) {
        if (!organizationId) return [];
        return availableSchedules.filter(schedule => schedule.organizationId === Number(organizationId));
    }

    function technicalServicesForOrganization(organizationId, availableRequests = technicalServiceRequests.value) {
        if (!organizationId) return [];
        return availableRequests.filter(request => request.organizationId === Number(organizationId));
    }

    function nextScheduleId() {
        return Math.max(...maintenanceSchedules.value.map(schedule => schedule.id), 0) + 1;
    }

    function nextTechnicalServiceRequestId() {
        return Math.max(...technicalServiceRequests.value.map(request => request.id), 0) + 1;
    }

    function hasOpenScheduleForAssetPeriod(organizationId, assetId, period) {
        return schedulesForOrganization(organizationId).some(schedule =>
            schedule.assetId === Number(assetId) &&
            schedule.period === period &&
            isOpenSchedule(schedule),
        );
    }

    function isOpenSchedule(schedule) {
        return schedule.status === MaintenanceScheduleStatus.Scheduled ||
            schedule.status === MaintenanceScheduleStatus.Pending;
    }

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
