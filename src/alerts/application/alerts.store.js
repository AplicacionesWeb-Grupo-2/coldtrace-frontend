import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import useIdentityAccessStore from '@/identity-access/application/identity-access.store.js';
import {AssetManagementApi} from '@/asset-management/infrastructure/asset-management-api.js';
import {AssetAssembler} from '@/asset-management/infrastructure/asset.assembler.js';
import {AssetSettingsAssembler} from '@/asset-management/infrastructure/asset-settings.assembler.js';
import {IoTDeviceAssembler} from '@/asset-management/infrastructure/iot-device.assembler.js';
import {IoTDeviceStatus} from '@/asset-management/domain/model/iot-device-status.js';
import {MonitoringApi} from '@/monitoring/infrastructure/monitoring-api.js';
import {SensorReadingAssembler} from '@/monitoring/infrastructure/sensor-reading.assembler.js';
import {SensorReading} from '@/monitoring/domain/model/sensor-reading-entity.js';
import {AlertsApi} from '@/alerts/infrastructure/alerts-api.js';
import {IncidentAssembler} from '@/alerts/infrastructure/incident.assembler.js';
import {NotificationAssembler} from '@/alerts/infrastructure/notification.assembler.js';
import {Incident} from '@/alerts/domain/model/incident-entity.js';
import {Notification} from '@/alerts/domain/model/notification-entity.js';
import {NotificationChannel} from '@/alerts/domain/model/notification-channel.js';
import {NotificationStatus} from '@/alerts/domain/model/notification-status.js';
import {EscalationPolicy} from '@/alerts/domain/model/escalation-policy-entity.js';

const alertsApi = new AlertsApi();
const monitoringApi = new MonitoringApi();
const assetManagementApi = new AssetManagementApi();
const escalationPolicies = [
    new EscalationPolicy('critical', 30, 2, 'operations-manager'),
    new EscalationPolicy('warning', 720, 1, 'shift-supervisor'),
];

/**
 * Pinia store that coordinates alerts application state and use cases.
 *
 * @returns {import('pinia').StoreDefinition}
 */
const useAlertsStore = defineStore('alerts', () => {
    const incidents = ref([]);
    const notifications = ref([]);
    const loading = ref(false);
    const errors = ref([]);
    const recognizingId = ref(null);
    const closingId = ref(null);
    const stabilizingId = ref(null);
    const reviewingEscalationId = ref(null);
    const feedback = ref(null);
    const incidentsLoaded = ref(false);
    const notificationsLoaded = ref(false);
    let incidentsRequestInFlight = false;

    const identityStore = useIdentityAccessStore();
    const organizationIncidents = computed(() => {
        const organizationId = identityStore.currentOrganizationIdFrom();
        return organizationId
            ? incidents.value.filter(incident => incident.organizationId === Number(organizationId))
            : [];
    });
    const organizationNotifications = computed(() => {
        const organizationId = identityStore.currentOrganizationIdFrom();
        return organizationId
            ? notifications.value.filter(notification => notification.organizationId === Number(organizationId))
            : [];
    });
    const openIncidents = computed(() => organizationIncidents.value.filter(incident => incident.isOpen));
    const openIncidentsCount = computed(() => openIncidents.value.length);
    const activeNotifications = computed(() =>
        organizationNotifications.value.filter(notification => isNotificationForOpenIncident(notification)),
    );
    const pendingNotificationsCount = computed(() =>
        activeNotifications.value.filter(notification => notification.isPending).length,
    );
    const failedNotificationsCount = computed(() =>
        activeNotifications.value.filter(notification => notification.isFailed).length,
    );
    const escalatedIncidentsCount = computed(() =>
        organizationIncidents.value.filter(incident => incident.isEscalated).length,
    );
    const pendingEscalationConfigurationCount = computed(() =>
        organizationIncidents.value.filter(incident => incident.isPendingEscalationConfiguration).length,
    );

    /**
     * Loads incidents only from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchIncidentsOnly() {
        const response = await alertsApi.getIncidents();
        incidents.value = IncidentAssembler.toEntitiesFromResponse(response);
        incidentsLoaded.value = true;
        return incidents.value;
    }

    /**
     * Loads notifications only from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchNotificationsOnly() {
        const response = await alertsApi.getNotifications();
        notifications.value = NotificationAssembler.toEntitiesFromResponse(response);
        notificationsLoaded.value = true;
        return notifications.value;
    }

    /**
     * Loads incidents data for the current view or use case.
     *
     * @param {Object} options
     * @returns {Promise<*>}
     */
    async function loadIncidents({silent = false} = {}) {
        if (incidentsRequestInFlight) return {incidents: incidents.value, notifications: notifications.value};

        incidentsRequestInFlight = true;
        if (!silent) {
            loading.value = true;
            errors.value = [];
        }

        try {
            if (!identityStore.usersLoaded || !identityStore.rolesLoaded || !identityStore.organizationsLoaded) {
                await identityStore.fetchAccessData();
            }

            const [incidentResponse, notificationResponse, readingsResponse, assetsResponse, settingsResponse] = await Promise.all([
                alertsApi.getIncidents(),
                alertsApi.getNotifications(),
                monitoringApi.getSensorReadings(),
                assetManagementApi.getAssets(),
                assetManagementApi.getAssetSettings(),
            ]);
            let currentIncidents = IncidentAssembler.toEntitiesFromResponse(incidentResponse);
            let currentNotifications = NotificationAssembler.toEntitiesFromResponse(notificationResponse);
            const readings = SensorReadingAssembler.toEntitiesFromResponse(readingsResponse);
            const assets = AssetAssembler.toEntitiesFromResponse(assetsResponse);
            const settings = AssetSettingsAssembler.toEntitiesFromResponse(settingsResponse);

            const generatedIncidents = generatedParameterIncidentsFrom(currentIncidents, readings, assets, settings);
            if (generatedIncidents.length) {
                const createdIncidents = await Promise.all(generatedIncidents.map(incident => createIncidentWithRetry(incident)));
                currentIncidents = [...currentIncidents, ...createdIncidents.filter(Boolean)];
            }

            currentIncidents = await applyEscalationPolicies(currentIncidents);

            const generatedNotifications = generatedNotificationsFrom(currentIncidents, currentNotifications);
            if (generatedNotifications.length) {
                const createdNotifications = await Promise.all(generatedNotifications.map(notification => createNotificationWithRetry(notification)));
                currentNotifications = [...currentNotifications, ...createdNotifications.filter(Boolean)];
            }

            incidents.value = currentIncidents;
            notifications.value = currentNotifications;
            incidentsLoaded.value = true;
            notificationsLoaded.value = true;
            return {incidents: incidents.value, notifications: notifications.value};
        } catch (error) {
            if (!silent) errors.value.push(error);
            throw error;
        } finally {
            if (!silent) loading.value = false;
            incidentsRequestInFlight = false;
        }
    }

    /**
     * Handles recognize incident behavior in the alerts context.
     *
     * @param {*} incident
     * @param {*} responsibleUserName
     * @returns {Promise<*>}
     */
    async function recognizeIncident(incident, responsibleUserName) {
        if (!incident.isOpen) return incident;

        const recognized = incidentWith(incident, {
            status: 'recognized',
            recognizedBy: responsibleUserName,
            recognizedAt: new Date().toISOString(),
        });
        recognizingId.value = incident.id;
        feedback.value = null;

        try {
            const updated = await updateIncidentWithRetry(recognized);
            incidents.value = incidents.value.map(current => current.id === updated.id ? updated : current);
            feedback.value = 'alerts.incident-list.feedback-recognized';
            return updated;
        } catch (error) {
            feedback.value = 'alerts.incident-list.feedback-error';
            throw error;
        } finally {
            recognizingId.value = null;
        }
    }

    /**
     * Handles close incident behavior in the alerts context.
     *
     * @param {*} incident
     * @param {*} correctiveAction
     * @param {*} closureEvidence
     * @param {*} responsibleUserName
     * @returns {Promise<*>}
     */
    async function closeIncident(incident, correctiveAction, closureEvidence, responsibleUserName) {
        const now = new Date().toISOString();
        const closed = incidentWith(incident, {
            status: 'closed',
            recognizedBy: incident.recognizedBy ?? responsibleUserName,
            recognizedAt: incident.recognizedAt ?? now,
            correctiveAction,
            closureEvidence,
            closedBy: responsibleUserName,
            closedAt: now,
            escalationStatus: incident.isEscalated ? 'reviewed' : incident.escalationStatus,
            escalationReviewedBy: incident.isEscalated ? responsibleUserName : incident.escalationReviewedBy,
            escalationReviewedAt: incident.isEscalated ? now : incident.escalationReviewedAt,
        });
        closingId.value = incident.id;
        feedback.value = null;

        try {
            const updated = await updateIncidentWithRetry(closed);
            incidents.value = incidents.value.map(current => current.id === updated.id ? updated : current);
            feedback.value = 'alerts.incident-list.feedback-closed';
            return updated;
        } catch (error) {
            feedback.value = 'alerts.incident-list.feedback-error';
            throw error;
        } finally {
            closingId.value = null;
        }
    }

    /**
     * Handles stabilize incident behavior in the alerts context.
     *
     * @param {*} incident
     * @returns {Promise<*>}
     */
    async function stabilizeIncident(incident) {
        stabilizingId.value = incident.id;
        feedback.value = null;

        try {
            const [assetsResponse, iotDevicesResponse, settingsResponse, readingsResponse] = await Promise.all([
                assetManagementApi.getAssets(),
                assetManagementApi.getIoTDevices(),
                assetManagementApi.getAssetSettings(),
                monitoringApi.getSensorReadings(),
            ]);
            const assets = AssetAssembler.toEntitiesFromResponse(assetsResponse);
            const iotDevices = IoTDeviceAssembler.toEntitiesFromResponse(iotDevicesResponse);
            const settings = AssetSettingsAssembler.toEntitiesFromResponse(settingsResponse);
            const readings = SensorReadingAssembler.toEntitiesFromResponse(readingsResponse);
            const reading = stableReadingForIncident(incident, assets, iotDevices, settings, readings);

            if (!reading) throw new Error('missing-stabilization-context');

            await monitoringApi.createSensorReading(SensorReadingAssembler.toResourceFromEntity(reading));
            const updated = await updateIncidentWithRetry(incidentWith(incident, {conditionStable: true}));
            incidents.value = incidents.value.map(current => current.id === updated.id ? updated : current);
            feedback.value = 'alerts.incident-list.feedback-stabilized';
            return updated;
        } catch (error) {
            feedback.value = error instanceof Error && error.message === 'missing-stabilization-context'
                ? 'alerts.incident-list.feedback-stabilize-missing-device'
                : 'alerts.incident-list.feedback-stabilize-error';
            throw error;
        } finally {
            stabilizingId.value = null;
        }
    }

    /**
     * Handles review escalation behavior in the alerts context.
     *
     * @param {*} incident
     * @param {*} responsibleUserName
     * @returns {Promise<*>}
     */
    async function reviewEscalation(incident, responsibleUserName) {
        const reviewed = incidentWith(incident, {
            escalationStatus: 'reviewed',
            escalationReviewedBy: responsibleUserName,
            escalationReviewedAt: new Date().toISOString(),
        });
        reviewingEscalationId.value = incident.id;
        feedback.value = null;

        try {
            const updated = await updateIncidentWithRetry(reviewed);
            incidents.value = incidents.value.map(current => current.id === updated.id ? updated : current);
            feedback.value = 'alerts.incident-list.feedback-escalation-reviewed';
            return updated;
        } catch (error) {
            feedback.value = 'alerts.incident-list.feedback-error';
            throw error;
        } finally {
            reviewingEscalationId.value = null;
        }
    }

    /**
     * Determines whether resolve alerts is available.
     *
     * @returns {boolean}
     */
    function canResolveAlerts() {
        const role = identityStore.currentRoleFrom();
        return identityStore.permissionKeysForRole(role).includes('roles-permissions.permissions.resolve-alerts');
    }

    /**
     * Handles clear feedback behavior in the alerts context.
     *
     * @returns {void}
     */
    function clearFeedback() {
        feedback.value = null;
    }

    /**
     * Handles set feedback behavior in the alerts context.
     *
     * @param {*} nextFeedback
     * @returns {void}
     */
    function setFeedback(nextFeedback) {
        feedback.value = nextFeedback;
    }

    /**
     * Handles incident with behavior in the alerts context.
     *
     * @param {*} incident
     * @param {*} changes
     * @returns {*}
     */
    function incidentWith(incident, changes) {
        return new Incident({
            id: incident.id,
            organizationId: incident.organizationId,
            assetId: incident.assetId,
            assetName: incident.assetName,
            type: incident.type,
            severity: incident.severity,
            value: incident.value,
            detectedAt: incident.detectedAt,
            status: incident.status,
            recognizedBy: incident.recognizedBy,
            recognizedAt: incident.recognizedAt,
            conditionStable: incident.conditionStable,
            correctiveAction: incident.correctiveAction,
            closureEvidence: incident.closureEvidence,
            closedBy: incident.closedBy,
            closedAt: incident.closedAt,
            conditionKey: incident.conditionKey,
            source: incident.source,
            sourceReadingId: incident.sourceReadingId,
            reviewStatus: incident.reviewStatus,
            escalationStatus: incident.escalationStatus,
            escalationLevel: incident.escalationLevel,
            escalationPolicyMinutes: incident.escalationPolicyMinutes,
            escalatedAt: incident.escalatedAt,
            escalatedTo: incident.escalatedTo,
            escalationReviewedBy: incident.escalationReviewedBy,
            escalationReviewedAt: incident.escalationReviewedAt,
            ...changes,
        });
    }

    /**
     * Creates incident with retry in the alerts context.
     *
     * @param {*} incident
     * @returns {Promise<*>}
     */
    async function createIncidentWithRetry(incident) {
        return retryRequest(async () => {
            const response = await alertsApi.createIncident(IncidentAssembler.toResourceFromEntity(incident));
            return IncidentAssembler.toEntityFromResource(response.data);
        });
    }

    /**
     * Updates incident with retry in the alerts context.
     *
     * @param {*} incident
     * @returns {Promise<*>}
     */
    async function updateIncidentWithRetry(incident) {
        return retryRequest(async () => {
            const response = await alertsApi.updateIncident(IncidentAssembler.toResourceFromEntity(incident));
            return IncidentAssembler.toEntityFromResource(response.data);
        });
    }

    /**
     * Creates notification with retry in the alerts context.
     *
     * @param {*} notification
     * @returns {Promise<*>}
     */
    async function createNotificationWithRetry(notification) {
        return retryRequest(async () => {
            const response = await alertsApi.createNotification(NotificationAssembler.toResourceFromEntity(notification));
            return NotificationAssembler.toEntityFromResource(response.data);
        });
    }

    /**
     * Handles retry request behavior in the alerts context.
     *
     * @param {*} request
     * @param {*} attempts
     * @returns {Promise<*>}
     */
    async function retryRequest(request, attempts = 3) {
        let lastError = null;
        for (let attempt = 0; attempt < attempts; attempt += 1) {
            try {
                return await request();
            } catch (error) {
                lastError = error;
                if (attempt < attempts - 1) await delay(250);
            }
        }
        throw lastError;
    }

    /**
     * Handles delay behavior in the alerts context.
     *
     * @param {*} milliseconds
     * @returns {*}
     */
    function delay(milliseconds) {
        return new Promise(resolve => window.setTimeout(resolve, milliseconds));
    }

    /**
     * Determines whether notification for open incident is true.
     *
     * @param {*} notification
     * @returns {boolean}
     */
    function isNotificationForOpenIncident(notification) {
        return incidents.value.find(incident => incident.id === notification.incidentId)?.isOpen ?? false;
    }

    /**
     * Handles stable reading for incident behavior in the alerts context.
     *
     * @param {*} incident
     * @param {Array<*>} assets
     * @param {*} iotDevices
     * @param {*} settings
     * @param {Array<*>} readings
     * @returns {*}
     */
    function stableReadingForIncident(incident, assets, iotDevices, settings, readings) {
        const asset = assets.find(currentAsset => currentAsset.id === incident.assetId);
        if (!asset) return null;

        const device = monitoringDeviceForIncident(incident, iotDevices);
        const assetSettings = settingsForAsset(asset, settings);
        if (!device || !assetSettings) return null;

        const parameters = device.measurementParameters;
        return new SensorReading({
            id: Math.max(...readings.map(reading => reading.id), 0) + 1,
            assetId: asset.id,
            iotDeviceId: device.id,
            temperature: parameters.includes('temperature') ? stableTemperatureFor(assetSettings) : null,
            humidity: parameters.includes('humidity') ? stableHumidityFor(assetSettings) : null,
            isOutOfRange: false,
            recordedAt: new Date().toISOString(),
            motionDetected: parameters.includes('motion') ? false : null,
            imageCaptured: parameters.includes('image') ? false : null,
            batteryLevel: parameters.includes('battery') ? 80 : null,
            signalStrength: parameters.includes('signal') ? 85 : null,
        });
    }

    /**
     * Handles monitoring device for incident behavior in the alerts context.
     *
     * @param {*} incident
     * @param {*} iotDevices
     * @returns {*}
     */
    function monitoringDeviceForIncident(incident, iotDevices) {
        const devices = iotDevices.filter(device =>
            device.assetId === incident.assetId && device.status !== IoTDeviceStatus.Offline,
        );
        const preferredParameter = preferredParameterForIncident(incident);
        return devices.find(device =>
            preferredParameter !== null && device.measurementParameters.includes(preferredParameter),
        ) ?? devices[0] ?? null;
    }

    /**
     * Handles preferred parameter for incident behavior in the alerts context.
     *
     * @param {*} incident
     * @returns {*}
     */
    function preferredParameterForIncident(incident) {
        if (incident.type === 'temperature') return 'temperature';
        if (incident.type === 'humidity') return 'humidity';
        if (incident.type === 'connectivity' || incident.conditionKey === 'low-signal') return 'signal';
        if (incident.conditionKey === 'low-battery') return 'battery';
        return null;
    }

    /**
     * Handles stable temperature for behavior in the alerts context.
     *
     * @param {*} settings
     * @returns {*}
     */
    function stableTemperatureFor(settings) {
        return Number(((settings.minimumTemperature + settings.maximumTemperature) / 2).toFixed(1));
    }

    /**
     * Handles stable humidity for behavior in the alerts context.
     *
     * @param {*} settings
     * @returns {*}
     */
    function stableHumidityFor(settings) {
        return Math.max(0, Math.min(settings.maximumHumidity - 5, 65));
    }

    /**
     * Handles apply escalation policies behavior in the alerts context.
     *
     * @param {Array<*>} currentIncidents
     * @returns {Promise<*>}
     */
    async function applyEscalationPolicies(currentIncidents) {
        const updates = escalationUpdatesFrom(currentIncidents);
        if (!updates.length) return currentIncidents;

        const updatedIncidents = await Promise.all(updates.map(incident => updateIncidentWithRetry(incident)));
        return currentIncidents.map(incident =>
            updatedIncidents.find(updated => updated.id === incident.id) ?? incident,
        );
    }

    /**
     * Handles escalation updates from behavior in the alerts context.
     *
     * @param {Array<*>} currentIncidents
     * @returns {string}
     */
    function escalationUpdatesFrom(currentIncidents) {
        const now = new Date();
        return currentIncidents
            .map(incident => incidentWithCurrentEscalation(incident, now))
            .filter(Boolean)
            .filter(updated => {
                const current = currentIncidents.find(incident => incident.id === updated.id);
                return current && hasEscalationChanges(current, updated);
            });
    }

    /**
     * Handles incident with current escalation behavior in the alerts context.
     *
     * @param {*} incident
     * @param {*} now
     * @returns {*}
     */
    function incidentWithCurrentEscalation(incident, now) {
        if (incident.isClosed || incident.escalationStatus === 'reviewed') return null;

        if (!incident.isOpen) {
            return incident.escalationStatus === 'pending-configuration'
                ? incidentWith(incident, {
                    escalationStatus: 'none',
                    escalationLevel: 0,
                    escalationPolicyMinutes: escalationPolicyFor(incident)?.waitingMinutes ?? null,
                    escalatedAt: null,
                    escalatedTo: null,
                })
                : null;
        }

        const policy = escalationPolicyFor(incident);
        if (!policy) {
            return incidentWith(incident, {
                escalationStatus: 'pending-configuration',
                escalationLevel: 0,
                escalationPolicyMinutes: null,
                escalatedAt: null,
                escalatedTo: null,
            });
        }

        if (!hasExceededEscalationThreshold(incident, policy, now)) {
            return incidentWith(incident, {
                escalationStatus: 'none',
                escalationLevel: 0,
                escalationPolicyMinutes: policy.waitingMinutes,
                escalatedAt: null,
                escalatedTo: null,
            });
        }

        return incidentWith(incident, {
            escalationStatus: 'escalated',
            escalationLevel: policy.level,
            escalationPolicyMinutes: policy.waitingMinutes,
            escalatedAt: incident.escalatedAt ?? now.toISOString(),
            escalatedTo: policy.targetKey,
        });
    }

    /**
     * Handles escalation policy for behavior in the alerts context.
     *
     * @param {*} incident
     * @returns {*}
     */
    function escalationPolicyFor(incident) {
        return escalationPolicies.find(policy => policy.appliesTo(incident));
    }

    /**
     * Determines whether exceeded escalation threshold exists.
     *
     * @param {*} incident
     * @param {*} policy
     * @param {*} now
     * @returns {boolean}
     */
    function hasExceededEscalationThreshold(incident, policy, now) {
        const detectedAt = new Date(incident.detectedAt);
        if (Number.isNaN(detectedAt.getTime())) return false;

        const elapsedMinutes = (now.getTime() - detectedAt.getTime()) / 60000;
        return elapsedMinutes >= policy.waitingMinutes;
    }

    /**
     * Determines whether escalation changes exists.
     *
     * @param {*} current
     * @param {string} updated
     * @returns {boolean}
     */
    function hasEscalationChanges(current, updated) {
        return current.escalationStatus !== updated.escalationStatus ||
            current.escalationLevel !== updated.escalationLevel ||
            current.escalationPolicyMinutes !== updated.escalationPolicyMinutes ||
            current.escalatedAt !== updated.escalatedAt ||
            current.escalatedTo !== updated.escalatedTo ||
            current.escalationReviewedBy !== updated.escalationReviewedBy ||
            current.escalationReviewedAt !== updated.escalationReviewedAt;
    }

    /**
     * Generates d parameter incidents from for the current workflow.
     *
     * @param {Array<*>} currentIncidents
     * @param {Array<*>} readings
     * @param {Array<*>} assets
     * @param {*} settings
     * @returns {number}
     */
    function generatedParameterIncidentsFrom(currentIncidents, readings, assets, settings) {
        const candidates = [
            ...latestParameterCandidates(readings, assets, settings),
            ...pendingReviewCandidates(readings, assets, settings),
        ];
        let nextId = Math.max(...currentIncidents.map(incident => incident.id), 0) + 1;
        const now = new Date();
        const generatedIncidents = [];

        candidates.forEach(candidate => {
            if (hasActiveEquivalentIncident(
                [...currentIncidents, ...generatedIncidents],
                candidate.asset.organizationId,
                candidate.asset.id,
                candidate.type,
            )) {
                return;
            }

            const incident = new Incident({
                id: nextId,
                organizationId: candidate.asset.organizationId,
                assetId: candidate.asset.id,
                assetName: candidate.asset.name,
                type: candidate.type,
                severity: candidate.severity,
                value: candidate.value,
                detectedAt: candidate.reading.recordedAt,
                status: 'open',
                recognizedBy: null,
                recognizedAt: null,
                conditionStable: false,
                correctiveAction: null,
                closureEvidence: null,
                closedBy: null,
                closedAt: null,
                conditionKey: candidate.conditionKey,
                source: 'sensor-reading',
                sourceReadingId: candidate.reading.id,
                reviewStatus: candidate.reviewStatus,
                escalationStatus: 'none',
                escalationLevel: 0,
                escalationPolicyMinutes: null,
                escalatedAt: null,
                escalatedTo: null,
                escalationReviewedBy: null,
                escalationReviewedAt: null,
            });
            nextId += 1;
            generatedIncidents.push(incidentWithCurrentEscalation(incident, now) ?? incident);
        });

        return generatedIncidents;
    }

    /**
     * Generates d notifications from for the current workflow.
     *
     * @param {Array<*>} currentIncidents
     * @param {*} currentNotifications
     * @returns {number}
     */
    function generatedNotificationsFrom(currentIncidents, currentNotifications) {
        let nextId = Math.max(...currentNotifications.map(notification => notification.id), 0) + 1;
        return currentIncidents
            .filter(incident => incident.isOpen)
            .flatMap(incident =>
                notificationChannelsForIncident(incident)
                    .filter(channel => !currentNotifications.some(notification =>
                        notification.incidentId === incident.id && notification.channel === channel,
                    ))
                    .map(channel => {
                        const notification = notificationForIncident(incident, channel, nextId);
                        nextId += 1;
                        return notification;
                    }),
            );
    }

    /**
     * Handles notification for incident behavior in the alerts context.
     *
     * @param {*} incident
     * @param {*} channel
     * @param {number|string} id
     * @returns {*}
     */
    function notificationForIncident(incident, channel, id) {
        const status = notificationStatusFor(channel);
        const createdAt = new Date(incident.detectedAt).toISOString();
        return new Notification({
            id,
            organizationId: incident.organizationId,
            incidentId: incident.id,
            assetName: incident.assetName,
            channel,
            recipient: notificationRecipientFor(channel),
            message: notificationMessageFor(incident),
            status,
            createdAt,
            deliveredAt: status === NotificationStatus.Sent ? plusMinutes(createdAt, 2) : null,
            failureReason: status === NotificationStatus.Failed
                ? 'Recipient phone is not configured for SMS alerts.'
                : null,
        });
    }

    /**
     * Handles notification channels for incident behavior in the alerts context.
     *
     * @param {*} incident
     * @returns {*}
     */
    function notificationChannelsForIncident(incident) {
        return incident.severity === 'critical'
            ? [NotificationChannel.App, NotificationChannel.Email, NotificationChannel.Sms]
            : [NotificationChannel.App];
    }

    /**
     * Handles notification message for behavior in the alerts context.
     *
     * @param {*} incident
     * @returns {*}
     */
    function notificationMessageFor(incident) {
        const severity = incident.severity === 'critical' ? 'Critical alert' : 'Warning alert';
        return `${severity}: ${incident.assetName} reported ${incident.value} and requires attention.`;
    }

    /**
     * Handles notification status for behavior in the alerts context.
     *
     * @param {*} channel
     * @returns {string}
     */
    function notificationStatusFor(channel) {
        if (channel === NotificationChannel.App) return NotificationStatus.Sent;
        if (channel === NotificationChannel.Email) return NotificationStatus.Pending;
        return NotificationStatus.Failed;
    }

    /**
     * Handles notification recipient for behavior in the alerts context.
     *
     * @param {*} channel
     * @returns {*}
     */
    function notificationRecipientFor(channel) {
        const currentUser = identityStore.currentUserFrom();
        if (channel === NotificationChannel.Email) return currentUser?.email ?? 'operations@coldtrace.local';
        if (channel === NotificationChannel.Sms) return 'No phone configured';
        return identityStore.currentUserNameFrom();
    }

    /**
     * Handles plus minutes behavior in the alerts context.
     *
     * @param {boolean} isoDate
     * @param {*} minutes
     * @returns {*}
     */
    function plusMinutes(isoDate, minutes) {
        const date = new Date(isoDate);
        date.setMinutes(date.getMinutes() + minutes);
        return date.toISOString();
    }

    /**
     * Handles latest parameter candidates behavior in the alerts context.
     *
     * @param {Array<*>} readings
     * @param {Array<*>} assets
     * @param {*} settings
     * @returns {string}
     */
    function latestParameterCandidates(readings, assets, settings) {
        const latestByAsset = new Map();
        readings
            .filter(reading => reading.isOutOfRange)
            .forEach(reading => {
                const asset = assets.find(currentAsset => currentAsset.id === reading.assetId);
                if (!asset) return;

                const previous = latestByAsset.get(asset.id);
                if (!previous || isNewerReading(reading, previous.reading)) {
                    latestByAsset.set(asset.id, {reading, asset});
                }
            });

        return [...latestByAsset.values()]
            .flatMap(({reading, asset}) => {
                const assetSettings = settingsForAsset(asset, settings);
                return conditionCandidatesForReading(reading, asset, assetSettings);
            })
            .sort((left, right) => String(right.reading.recordedAt).localeCompare(String(left.reading.recordedAt)));
    }

    /**
     * Handles condition candidates for reading behavior in the alerts context.
     *
     * @param {*} reading
     * @param {*} asset
     * @param {Array<*>} assetSettings
     * @returns {string}
     */
    function conditionCandidatesForReading(reading, asset, assetSettings) {
        const candidates = [];

        if (assetSettings && reading.temperature !== null) {
            const conditionKey = temperatureConditionKey(reading.temperature, assetSettings);
            if (conditionKey) {
                candidates.push({
                    reading,
                    asset,
                    type: 'temperature',
                    conditionKey,
                    severity: thermalSeverity(reading.temperature, assetSettings),
                    value: `${reading.temperature}${assetSettings.temperatureUnit}`,
                    reviewStatus: 'complete',
                });
            }
        }

        if (assetSettings && reading.humidity !== null && reading.humidity > assetSettings.maximumHumidity) {
            candidates.push({
                reading,
                asset,
                type: 'humidity',
                conditionKey: 'high-humidity',
                severity: humiditySeverity(reading.humidity, assetSettings),
                value: `${reading.humidity}${assetSettings.humidityUnit}`,
                reviewStatus: 'complete',
            });
        }

        if (reading.batteryLevel !== null && reading.batteryLevel < 15) {
            candidates.push({
                reading,
                asset,
                type: 'other',
                conditionKey: 'low-battery',
                severity: reading.batteryLevel < 10 ? 'critical' : 'warning',
                value: `${reading.batteryLevel}% battery`,
                reviewStatus: 'complete',
            });
        }

        if (reading.signalStrength !== null && reading.signalStrength < 35) {
            candidates.push({
                reading,
                asset,
                type: 'connectivity',
                conditionKey: 'low-signal',
                severity: reading.signalStrength < 30 ? 'critical' : 'warning',
                value: `${reading.signalStrength}% signal`,
                reviewStatus: 'complete',
            });
        }

        return candidates;
    }

    /**
     * Handles pending review candidates behavior in the alerts context.
     *
     * @param {Array<*>} readings
     * @param {Array<*>} assets
     * @param {*} settings
     * @returns {string}
     */
    function pendingReviewCandidates(readings, assets, settings) {
        const latestByAsset = new Map();
        readings
            .filter(reading => reading.isOutOfRange && (reading.temperature !== null || reading.humidity !== null))
            .forEach(reading => {
                const asset = assets.find(currentAsset => currentAsset.id === reading.assetId);
                if (!asset || settingsForAsset(asset, settings)) return;

                const previous = latestByAsset.get(asset.id);
                if (!previous || isNewerReading(reading, previous.reading)) {
                    latestByAsset.set(asset.id, {reading, asset});
                }
            });

        return [...latestByAsset.values()].map(({reading, asset}) => ({
            reading,
            asset,
            type: 'other',
            conditionKey: 'thermal-configuration-pending',
            severity: 'warning',
            value: 'Pending safety range',
            reviewStatus: 'pending-review',
        }));
    }

    /**
     * Determines whether active equivalent incident exists.
     *
     * @param {Array<*>} currentIncidents
     * @param {number|string} organizationId
     * @param {number|string} assetId
     * @param {string} type
     * @returns {boolean}
     */
    function hasActiveEquivalentIncident(currentIncidents, organizationId, assetId, type) {
        return currentIncidents.some(incident => {
            if (incident.isClosed || incident.organizationId !== organizationId || incident.assetId !== assetId) return false;
            return incident.type === type;
        });
    }

    /**
     * Handles settings for asset behavior in the alerts context.
     *
     * @param {*} asset
     * @param {*} settings
     * @returns {void}
     */
    function settingsForAsset(asset, settings) {
        return settings.find(setting => setting.assetId === asset.id) ??
            settings.find(setting => setting.organizationId === asset.organizationId && setting.assetId === null);
    }

    /**
     * Handles temperature condition key behavior in the alerts context.
     *
     * @param {*} temperature
     * @param {*} settings
     * @returns {string}
     */
    function temperatureConditionKey(temperature, settings) {
        if (temperature > settings.maximumTemperature) return 'high-temperature';
        if (temperature < settings.minimumTemperature) return 'low-temperature';
        return null;
    }

    /**
     * Handles thermal severity behavior in the alerts context.
     *
     * @param {*} temperature
     * @param {*} settings
     * @returns {*}
     */
    function thermalSeverity(temperature, settings) {
        const upperDelta = temperature - settings.maximumTemperature;
        const lowerDelta = settings.minimumTemperature - temperature;
        return Math.max(upperDelta, lowerDelta) >= 2 ? 'critical' : 'warning';
    }

    /**
     * Handles humidity severity behavior in the alerts context.
     *
     * @param {*} humidity
     * @param {*} settings
     * @returns {*}
     */
    function humiditySeverity(humidity, settings) {
        return humidity - settings.maximumHumidity >= 5 ? 'critical' : 'warning';
    }

    /**
     * Determines whether newer reading is true.
     *
     * @param {*} current
     * @param {*} previous
     * @returns {boolean}
     */
    function isNewerReading(current, previous) {
        return new Date(current.recordedAt).getTime() > new Date(previous.recordedAt).getTime();
    }

    return {
        incidents,
        notifications,
        organizationIncidents,
        organizationNotifications,
        loading,
        errors,
        recognizingId,
        closingId,
        stabilizingId,
        reviewingEscalationId,
        feedback,
        incidentsLoaded,
        notificationsLoaded,
        openIncidents,
        openIncidentsCount,
        activeNotifications,
        pendingNotificationsCount,
        failedNotificationsCount,
        escalatedIncidentsCount,
        pendingEscalationConfigurationCount,
        fetchIncidentsOnly,
        fetchNotificationsOnly,
        loadIncidents,
        recognizeIncident,
        closeIncident,
        stabilizeIncident,
        reviewEscalation,
        canResolveAlerts,
        clearFeedback,
        setFeedback,
    };
});

export default useAlertsStore;
