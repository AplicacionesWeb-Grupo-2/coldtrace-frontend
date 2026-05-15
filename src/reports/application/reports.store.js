import {defineStore} from 'pinia';
import {computed, ref} from 'vue';
import useAssetManagementStore from '@/asset-management/application/asset-management.store.js';
import useMonitoringStore from '@/monitoring/application/monitoring.store.js';
import {CalibrationStatus} from '@/asset-management/domain/model/calibration-status.js';
import {ConnectivityStatus} from '@/asset-management/domain/model/connectivity-status.js';
import {ReportsApi} from '@/reports/infrastructure/reports-api.js';
import {ReportAssembler} from '@/reports/infrastructure/report.assembler.js';
import {Report} from '@/reports/domain/model/report-entity.js';
import {ReportType} from '@/reports/domain/model/report-type.js';
import {DailyLog} from '@/reports/domain/model/daily-log-entity.js';
import {MonthlyReport} from '@/reports/domain/model/monthly-report-entity.js';
import {OperationalHistory} from '@/reports/domain/model/operational-history-entity.js';
import {SanitaryComplianceReport} from '@/reports/domain/model/sanitary-compliance-report-entity.js';
import {ComplianceFinding} from '@/reports/domain/model/compliance-finding-entity.js';
import {ComplianceReport} from '@/reports/domain/model/compliance-report-entity.js';
import {FindingStatus} from '@/reports/domain/model/finding-status.js';
import {EvidenceItem} from '@/reports/domain/model/evidence-item-entity.js';
import {AuditEvidence} from '@/reports/domain/model/audit-evidence-entity.js';

const reportsApi = new ReportsApi();

/**
 * Pinia store that coordinates reports application state and use cases.
 *
 * @returns {import('pinia').StoreDefinition}
 */
const useReportsStore = defineStore('reports', () => {
    const reports = ref([]);
    const loading = ref(false);
    const errors = ref([]);
    const reportsLoaded = ref(false);
    const closedComplianceFindingIds = ref(new Set());

    const error = computed(() => errors.value[0]?.message ?? null);
    const assetManagementStore = useAssetManagementStore();
    const monitoringStore = useMonitoringStore();

    /**
     * Loads reports from the API and updates application state.
     *
     * @returns {Promise<*>}
     */
    async function fetchReports() {
        loading.value = true;
        errors.value = [];

        try {
            const response = await reportsApi.getReports();
            reports.value = ReportAssembler.toEntitiesFromResponse(response);
            reportsLoaded.value = true;
            return reports.value;
        } catch (requestError) {
            reports.value = [];
            reportsLoaded.value = true;
            return reports.value;
        } finally {
            loading.value = false;
        }
    }

    /**
     * Handles reports for organization behavior in the reports context.
     *
     * @param {number|string} organizationId
     * @returns {*}
     */
    function reportsForOrganization(organizationId) {
        if (!organizationId) return [];
        return reports.value.filter(report => report.organizationId === Number(organizationId));
    }

    /**
     * Handles current date behavior in the reports context.
     *
     * @returns {string}
     */
    function currentDate() {
        return today();
    }

    /**
     * Builds daily log for presentation or reporting.
     *
     * @param {number|string} organizationId
     * @param {string} date
     * @returns {*}
     */
    function buildDailyLog(organizationId, date) {
        const safeOrganizationId = organizationId ?? 0;
        const assets = assetManagementStore.assetsForOrganization(organizationId);
        const iotDevices = assetManagementStore.iotDevicesForOrganization(organizationId);
        const monitoredAssetIds = new Set(iotDevices.filter(device => device.assetId !== null).map(device => device.assetId));
        const readings = monitoringStore
            .readingsForAssetIds(assets.map(asset => asset.id))
            .filter(reading => dateKeyFor(reading.recordedAt) === date);
        const assetsWithReadings = new Set(readings.map(reading => reading.assetId));
        const reportAssets = assets.filter(asset => monitoredAssetIds.has(asset.id) || assetsWithReadings.has(asset.id));
        const entries = reportAssets
            .map(asset => buildDailyLogEntry(asset, readings, iotDevices))
            .sort((left, right) => right.totalReadings - left.totalReadings || left.assetName.localeCompare(right.assetName));
        const expectedReadings = entries.reduce((total, entry) => total + entry.expectedReadings, 0);

        return new DailyLog({
            id: Number(date.replaceAll('-', '')) + safeOrganizationId,
            organizationId: safeOrganizationId,
            date,
            generatedAt: new Date().toISOString(),
            expectedReadings,
            entries,
        });
    }

    /**
     * Builds operational history for presentation or reporting.
     *
     * @param {number|string} organizationId
     * @param {Object} filters
     * @returns {*}
     */
    function buildOperationalHistory(organizationId, filters) {
        const assets = assetManagementStore.assetsForOrganization(organizationId);
        const assetIds = assets.map(asset => asset.id);
        const readings = monitoringStore
            .readingsForAssetIds(assetIds)
            .filter(reading => isInDateRange(reading.recordedAt, filters.fromDate, filters.toDate))
            .filter(reading => !filters.assetId || reading.assetId === Number(filters.assetId));
        const readingEvents = readings.map(reading =>
            historyReadingEvent(reading, assets, assetManagementStore.settingsForAsset(organizationId, reading.assetId)),
        );
        const alertEvents = readings
            .filter(reading => reading.isOutOfRange)
            .map(reading => historyAlertEvent(
                reading,
                assets,
                assetManagementStore.settingsForAsset(organizationId, reading.assetId),
            ));
        const incidentEvents = assets
            .filter(asset => !filters.assetId || asset.id === Number(filters.assetId))
            .flatMap(asset => historyIncidentEvents(asset, filters, readings));
        const events = [...readingEvents, ...alertEvents, ...incidentEvents]
            .filter(event => filters.eventType === 'all' || event.eventType === filters.eventType)
            .sort((left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime());

        return new OperationalHistory({filters, events});
    }

    /**
     * Builds sanitary compliance report for presentation or reporting.
     *
     * @param {number|string} organizationId
     * @param {Object} filters
     * @returns {*}
     */
    function buildSanitaryComplianceReport(organizationId, filters) {
        const safeOrganizationId = organizationId ?? 0;
        const assets = assetManagementStore.assetsForOrganization(organizationId);
        const iotDevices = assetManagementStore.iotDevicesForOrganization(organizationId);
        const monitoredAssetIds = new Set(iotDevices.filter(device => device.assetId !== null).map(device => device.assetId));
        const selectedAssets = assets.filter(asset => !filters.assetId || asset.id === Number(filters.assetId));
        const readings = monitoringStore
            .readingsForAssetIds(selectedAssets.map(asset => asset.id))
            .filter(reading => isInDateRange(reading.recordedAt, filters.fromDate, filters.toDate));
        const assetsWithReadings = new Set(readings.map(reading => reading.assetId));
        const reportAssets = selectedAssets.filter(asset =>
            filters.assetId || monitoredAssetIds.has(asset.id) || assetsWithReadings.has(asset.id),
        );
        const daysCount = daysInRange(filters.fromDate, filters.toDate);
        const rows = reportAssets
            .map(asset => buildSanitaryComplianceRow(
                asset,
                readings,
                iotDevices,
                assetManagementStore.settingsForAsset(organizationId, asset.id),
                daysCount,
            ))
            .sort((left, right) =>
                right.totalReadings - left.totalReadings ||
                right.complianceRate - left.complianceRate ||
                left.assetName.localeCompare(right.assetName),
            );

        return new SanitaryComplianceReport({
            id: Number(`${filters.fromDate.replaceAll('-', '')}${safeOrganizationId}`),
            organizationId: safeOrganizationId,
            filters,
            generatedAt: new Date().toISOString(),
            rows,
        });
    }

    /**
     * Builds compliance report for presentation or reporting.
     *
     * @param {number|string} organizationId
     * @param {Object} filters
     * @returns {*}
     */
    function buildComplianceReport(organizationId, filters) {
        const safeOrganizationId = organizationId ?? 0;
        const assets = assetManagementStore.assetsForOrganization(organizationId);
        const iotDevices = assetManagementStore.iotDevicesForOrganization(organizationId);
        const selectedAssets = assets.filter(asset => !filters.assetId || asset.id === Number(filters.assetId));
        const readings = monitoringStore
            .readingsForAssetIds(selectedAssets.map(asset => asset.id))
            .filter(reading => isInDateRange(reading.recordedAt, filters.fromDate, filters.toDate));
        const daysCount = daysInRange(filters.fromDate, filters.toDate);
        const findings = selectedAssets
            .flatMap(asset => buildComplianceFindings(
                safeOrganizationId,
                asset,
                readings,
                iotDevices,
                assetManagementStore.settingsForAsset(organizationId, asset.id),
                filters,
                daysCount,
            ))
            .filter(finding => filters.status === 'all' || finding.status === filters.status)
            .sort((left, right) =>
                severityWeight(right.severity) - severityWeight(left.severity) ||
                left.assetName.localeCompare(right.assetName) ||
                left.type.localeCompare(right.type),
            );

        return new ComplianceReport({
            id: Number(`${filters.fromDate.replaceAll('-', '')}${safeOrganizationId}`),
            organizationId: safeOrganizationId,
            filters,
            generatedAt: new Date().toISOString(),
            findings,
        });
    }

    /**
     * Builds audit evidence for presentation or reporting.
     *
     * @param {number|string} organizationId
     * @param {Object} filters
     * @returns {*}
     */
    function buildAuditEvidence(organizationId, filters) {
        const safeOrganizationId = organizationId ?? 0;
        const assets = assetManagementStore.assetsForOrganization(organizationId);
        const iotDevices = assetManagementStore.iotDevicesForOrganization(organizationId);
        const selectedAssets = assets.filter(asset => !filters.assetId || asset.id === Number(filters.assetId));
        const readings = monitoringStore
            .readingsForAssetIds(selectedAssets.map(asset => asset.id))
            .filter(reading => isInDateRange(reading.recordedAt, filters.fromDate, filters.toDate));
        const daysCount = daysInRange(filters.fromDate, filters.toDate);
        const expectedReadings = selectedAssets.reduce((total, asset) => {
            const assetDevices = iotDevices.filter(device => device.assetId === asset.id);
            return total + expectedDailyReadingsFor(assetDevices, 0) * daysCount;
        }, 0);
        const complianceReview = buildComplianceReport(organizationId, {
            assetId: filters.assetId,
            fromDate: filters.fromDate,
            toDate: filters.toDate,
            status: 'all',
        });
        const findings = complianceReview.findings;
        const incidentCount = findings.filter(finding => finding.type === 'open-incident').length;
        const correctiveActionsCount = findings.filter(finding => finding.status === FindingStatus.Closed).length;
        const openFindingsCount = findings.filter(finding => finding.status === FindingStatus.Open).length;
        const limitationsCount = findings.filter(finding => finding.severity === 'limitation').length;
        const periodReports = reportsForOrganization(organizationId).filter(report => reportOverlapsPeriod(report, filters));
        const items = [
            new EvidenceItem({
                id: 'monitoring-readings',
                status: readings.length ? 'complete' : 'incomplete',
                quantity: readings.length,
                requiredQuantity: 1,
                messageKey: readings.length
                    ? 'reports.audit.items.monitoring-readings-complete'
                    : 'reports.audit.items.monitoring-readings-incomplete',
                messageParams: {count: readings.length},
            }),
            new EvidenceItem({
                id: 'generated-reports',
                status: periodReports.length ? 'complete' : 'incomplete',
                quantity: periodReports.length,
                requiredQuantity: 1,
                messageKey: periodReports.length
                    ? 'reports.audit.items.generated-reports-complete'
                    : 'reports.audit.items.generated-reports-incomplete',
                messageParams: {count: periodReports.length},
            }),
            new EvidenceItem({
                id: 'compliance-findings',
                status: limitationsCount ? 'incomplete' : 'complete',
                quantity: findings.length,
                requiredQuantity: 0,
                messageKey: limitationsCount
                    ? 'reports.audit.items.compliance-findings-incomplete'
                    : 'reports.audit.items.compliance-findings-complete',
                messageParams: {count: findings.length, limitations: limitationsCount},
            }),
            new EvidenceItem({
                id: 'incident-records',
                status: 'complete',
                quantity: incidentCount,
                requiredQuantity: 0,
                messageKey: 'reports.audit.items.incident-records-complete',
                messageParams: {count: incidentCount},
            }),
            new EvidenceItem({
                id: 'corrective-actions',
                status: openFindingsCount ? 'incomplete' : 'complete',
                quantity: correctiveActionsCount,
                requiredQuantity: openFindingsCount,
                messageKey: openFindingsCount
                    ? 'reports.audit.items.corrective-actions-incomplete'
                    : 'reports.audit.items.corrective-actions-complete',
                messageParams: {closed: correctiveActionsCount, open: openFindingsCount},
            }),
        ];

        return new AuditEvidence({
            id: Number(`${filters.fromDate.replaceAll('-', '')}${safeOrganizationId}`),
            organizationId: safeOrganizationId,
            filters,
            generatedAt: new Date().toISOString(),
            items,
            readingsCount: readings.length,
            expectedReadings,
            incidentCount,
            correctiveActionsCount,
            reports: periodReports,
            findings,
        });
    }

    /**
     * Builds monthly report for presentation or reporting.
     *
     * @param {number|string} organizationId
     * @param {*} month
     * @returns {*}
     */
    function buildMonthlyReport(organizationId, month) {
        const safeOrganizationId = organizationId ?? 0;
        const range = monthDateRange(month);
        const assets = assetManagementStore.assetsForOrganization(organizationId);
        const iotDevices = assetManagementStore.iotDevicesForOrganization(organizationId);
        const monitoredAssetIds = new Set(iotDevices.filter(device => device.assetId !== null).map(device => device.assetId));
        const readings = monitoringStore
            .readingsForAssetIds(assets.map(asset => asset.id))
            .filter(reading => isInDateRange(reading.recordedAt, range.fromDate, range.toDate));
        const assetsWithReadings = new Set(readings.map(reading => reading.assetId));
        const reportAssets = assets.filter(asset => monitoredAssetIds.has(asset.id) || assetsWithReadings.has(asset.id));
        const rows = reportAssets
            .map(asset => buildMonthlyReportRow(asset, readings))
            .sort((left, right) =>
                right.totalReadings - left.totalReadings ||
                right.incidentCount - left.incidentCount ||
                left.assetName.localeCompare(right.assetName),
            );

        return new MonthlyReport({
            id: Number(month.replace('-', '')) + safeOrganizationId,
            organizationId: safeOrganizationId,
            month,
            fromDate: range.fromDate,
            toDate: range.toDate,
            generatedAt: new Date().toISOString(),
            rows,
        });
    }

    /**
     * Creates daily log report in the reports context.
     *
     * @param {number|string} organizationId
     * @param {*} dailyLog
     * @returns {Promise<*>}
     */
    async function createDailyLogReport(organizationId, dailyLog) {
        if (!organizationId) return reportFromDailyLog(0, dailyLog);
        const existingReport = reports.value.find(report =>
            report.organizationId === organizationId &&
            report.type === ReportType.DailyLog &&
            report.periodDate === dailyLog.date,
        );
        if (existingReport) return existingReport;
        return createReport(reportFromDailyLog(organizationId, dailyLog));
    }

    /**
     * Creates sanitary compliance report in the reports context.
     *
     * @param {number|string} organizationId
     * @param {*} complianceReport
     * @returns {Promise<*>}
     */
    async function createSanitaryComplianceReport(organizationId, complianceReport) {
        if (!organizationId) return reportFromSanitaryCompliance(0, complianceReport);
        const uuid = sanitaryComplianceUuid(organizationId, complianceReport.filters);
        const existingReport = reports.value.find(report =>
            report.organizationId === organizationId &&
            report.type === ReportType.Compliance &&
            report.uuid === uuid,
        );
        if (existingReport) return existingReport;
        return createReport(reportFromSanitaryCompliance(organizationId, complianceReport));
    }

    /**
     * Creates monthly summary report in the reports context.
     *
     * @param {number|string} organizationId
     * @param {*} monthlyReport
     * @returns {Promise<*>}
     */
    async function createMonthlySummaryReport(organizationId, monthlyReport) {
        if (!organizationId) return reportFromMonthlyReport(0, monthlyReport);
        const uuid = monthlyReportUuid(organizationId, monthlyReport.month);
        const existingReport = reports.value.find(report =>
            report.organizationId === organizationId &&
            report.type === ReportType.MonthlySummary &&
            report.uuid === uuid,
        );
        if (existingReport) return existingReport;
        return createReport(reportFromMonthlyReport(organizationId, monthlyReport));
    }

    /**
     * Creates report in the reports context.
     *
     * @param {*} report
     * @returns {Promise<*>}
     */
    async function createReport(report) {
        const response = await reportsApi.createReport(ReportAssembler.toResourceFromEntity(report));
        const createdReport = ReportAssembler.toEntityFromResource(response.data);
        reports.value.push(createdReport);
        return createdReport;
    }

    /**
     * Handles close compliance finding behavior in the reports context.
     *
     * @param {number|string} findingId
     * @returns {*}
     */
    function closeComplianceFinding(findingId) {
        const nextFindingIds = new Set(closedComplianceFindingIds.value);
        nextFindingIds.add(findingId);
        closedComplianceFindingIds.value = nextFindingIds;
    }

    /**
     * Handles sanitary compliance csv behavior in the reports context.
     *
     * @param {*} complianceReport
     * @returns {*}
     */
    function sanitaryComplianceCsv(complianceReport) {
        const headers = ['From', 'To', 'Asset', 'Location', 'Readings', 'Expected', 'Valid', 'Out of range', 'Missing', 'Incidents', 'Average temperature', 'Average humidity', 'Compliance', 'Status'];
        const rows = complianceReport.rows.map(row => [
            complianceReport.filters.fromDate,
            complianceReport.filters.toDate,
            row.assetName,
            row.assetLocation,
            row.totalReadings,
            row.expectedReadings,
            row.validReadings,
            row.outOfRangeCount,
            row.missingReadings,
            row.incidentCount,
            row.averageTemperature === null ? 'N/A' : `${row.averageTemperature.toFixed(1)} C`,
            row.averageHumidity === null ? 'N/A' : `${row.averageHumidity.toFixed(0)}%`,
            `${row.complianceRate}%`,
            row.status,
        ]);
        return rowsToCsv([headers, ...rows]);
    }

    /**
     * Handles monthly report csv behavior in the reports context.
     *
     * @param {*} monthlyReport
     * @returns {*}
     */
    function monthlyReportCsv(monthlyReport) {
        const headers = ['Month', 'From', 'To', 'Asset', 'Location', 'Readings', 'Valid', 'Out of range', 'Incidents', 'Average temperature', 'Average humidity', 'Compliance', 'First reading', 'Last reading', 'Status'];
        const rows = monthlyReport.rows.map(row => [
            monthlyReport.month,
            monthlyReport.fromDate,
            monthlyReport.toDate,
            row.assetName,
            row.assetLocation,
            row.totalReadings,
            row.validReadings,
            row.outOfRangeCount,
            row.incidentCount,
            row.averageTemperature === null ? 'N/A' : `${row.averageTemperature.toFixed(1)} C`,
            row.averageHumidity === null ? 'N/A' : `${row.averageHumidity.toFixed(0)}%`,
            `${row.complianceRate}%`,
            row.firstRecordedAt ?? 'N/A',
            row.lastRecordedAt ?? 'N/A',
            row.status,
        ]);
        return rowsToCsv([headers, ...rows]);
    }

    /**
     * Handles audit evidence csv behavior in the reports context.
     *
     * @param {*} auditEvidence
     * @returns {*}
     */
    function auditEvidenceCsv(auditEvidence) {
        const checklistHeaders = ['Section', 'Status', 'Quantity', 'Required', 'Notes'];
        const checklistRows = auditEvidence.items.map(item => [item.id, item.status, item.quantity, item.requiredQuantity, item.messageKey]);
        const reportHeaders = ['Report', 'Type', 'Period', 'Generated at'];
        const reportRows = auditEvidence.reports.map(report => [report.title, report.type, report.periodDate, report.generatedAt]);
        const findingHeaders = ['Asset', 'Type', 'Severity', 'Status', 'Evidence'];
        const findingRows = auditEvidence.findings.map(finding => [finding.assetName, finding.type, finding.severity, finding.status, finding.evidence]);
        return rowsToCsv([
            ['Audit evidence', auditEvidence.filters.fromDate, auditEvidence.filters.toDate],
            [],
            checklistHeaders,
            ...checklistRows,
            [],
            reportHeaders,
            ...reportRows,
            [],
            findingHeaders,
            ...findingRows,
        ]);
    }

    /**
     * Builds compliance findings for presentation or reporting.
     *
     * @param {number|string} organizationId
     * @param {*} asset
     * @param {Array<*>} readings
     * @param {*} iotDevices
     * @param {*} settings
     * @param {Object} filters
     * @param {number|string} daysCount
     * @returns {*}
     */
    function buildComplianceFindings(organizationId, asset, readings, iotDevices, settings, filters, daysCount) {
        const assetReadings = readings.filter(reading => reading.assetId === asset.id);
        const assetDevices = iotDevices.filter(device => device.assetId === asset.id);
        const expectedReadings = assetDevices.length
            ? expectedDailyReadingsFor(assetDevices, assetReadings.length) * daysCount
            : assetReadings.length;
        const missingReadings = Math.max(expectedReadings - assetReadings.length, 0);
        const outOfRangeCount = assetReadings.filter(reading => reading.isOutOfRange).length;
        const incidentKey = normalizeIncident(asset.lastIncident);
        const expiredDevices = assetDevices.filter(device => device.calibrationStatus === CalibrationStatus.Expired);
        const findings = [];

        if (!assetDevices.length) {
            findings.push(complianceFinding(organizationId, asset, filters, 'incomplete-evaluation', 'limitation', 'reports.findings.messages.missing-device', 'No linked monitoring device', {asset: asset.name}));
        }

        if (!settings) {
            findings.push(complianceFinding(organizationId, asset, filters, 'incomplete-evaluation', 'limitation', 'reports.findings.messages.missing-settings', 'No safety range configured', {asset: asset.name}, 'settings'));
        }

        if (missingReadings > 0) {
            findings.push(complianceFinding(
                organizationId,
                asset,
                filters,
                'missing-readings',
                assetReadings.length ? 'observation' : 'potential-non-compliance',
                'reports.findings.messages.missing-readings',
                `${assetReadings.length} / ${expectedReadings} readings`,
                {actual: assetReadings.length, expected: expectedReadings},
            ));
        }

        if (outOfRangeCount > 0) {
            findings.push(complianceFinding(
                organizationId,
                asset,
                filters,
                'out-of-range',
                'potential-non-compliance',
                'reports.findings.messages.out-of-range',
                `${outOfRangeCount} out of range`,
                {count: outOfRangeCount},
            ));
        }

        if (incidentKey !== 'none') {
            findings.push(complianceFinding(
                organizationId,
                asset,
                filters,
                'open-incident',
                'potential-non-compliance',
                `reports.history.incidents.${incidentKey}`,
                asset.currentTemperature,
                {},
                incidentKey,
            ));
        }

        if (asset.connectivity !== ConnectivityStatus.Online) {
            findings.push(complianceFinding(
                organizationId,
                asset,
                filters,
                'open-incident',
                asset.connectivity === ConnectivityStatus.Offline ? 'potential-non-compliance' : 'observation',
                'reports.findings.messages.connectivity',
                asset.connectivity,
                {status: asset.connectivity},
                `connectivity-${asset.connectivity}`,
            ));
        }

        expiredDevices.forEach(device => {
            findings.push(complianceFinding(
                organizationId,
                asset,
                filters,
                'expired-calibration',
                'observation',
                'reports.findings.messages.expired-calibration',
                device.uuid,
                {device: device.uuid, date: device.nextCalibrationDate},
                device.uuid,
            ));
        });

        return findings;
    }

    /**
     * Handles compliance finding behavior in the reports context.
     *
     * @param {number|string} organizationId
     * @param {*} asset
     * @param {Object} filters
     * @param {string} type
     * @param {*} severity
     * @param {string} messageKey
     * @param {*} evidence
     * @param {*} messageParams
     * @param {*} idSuffix
     * @returns {*}
     */
    function complianceFinding(organizationId, asset, filters, type, severity, messageKey, evidence, messageParams = {}, idSuffix = '') {
        const id = [organizationId, asset.id, filters.fromDate, filters.toDate, type, idSuffix]
            .filter(value => value !== '')
            .join('-');
        const status = closedComplianceFindingIds.value.has(id) ? FindingStatus.Closed : FindingStatus.Open;
        return new ComplianceFinding({
            id,
            organizationId,
            assetId: asset.id,
            assetName: asset.name,
            assetLocation: assetLocationFor(asset),
            type,
            severity,
            status,
            periodFrom: filters.fromDate,
            periodTo: filters.toDate,
            detectedAt: new Date().toISOString(),
            evidence,
            messageKey,
            messageParams,
        });
    }

    /**
     * Builds daily log entry for presentation or reporting.
     *
     * @param {*} asset
     * @param {Array<*>} readings
     * @param {*} iotDevices
     * @returns {*}
     */
    function buildDailyLogEntry(asset, readings, iotDevices) {
        const assetDevices = iotDevices.filter(device => device.assetId === asset.id);
        const assetReadings = readings
            .filter(reading => reading.assetId === asset.id)
            .sort((left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime());
        const temperatureReadings = assetReadings.map(reading => reading.temperature).filter(value => value !== null);
        const humidityReadings = assetReadings.map(reading => reading.humidity).filter(value => value !== null);
        const expectedReadings = expectedDailyReadingsFor(assetDevices, assetReadings.length);
        const missingReadings = Math.max(expectedReadings - assetReadings.length, 0);

        return {
            assetId: asset.id,
            assetName: asset.name,
            assetLocation: assetLocationFor(asset),
            totalReadings: assetReadings.length,
            expectedReadings,
            averageTemperature: average(temperatureReadings),
            averageHumidity: average(humidityReadings),
            outOfRangeCount: assetReadings.filter(reading => reading.isOutOfRange).length,
            missingReadings,
            firstRecordedAt: assetReadings[0]?.recordedAt ?? null,
            lastRecordedAt: assetReadings[assetReadings.length - 1]?.recordedAt ?? null,
            status: entryStatus(assetReadings.length, missingReadings),
        };
    }

    /**
     * Builds sanitary compliance row for presentation or reporting.
     *
     * @param {*} asset
     * @param {Array<*>} readings
     * @param {*} iotDevices
     * @param {*} settings
     * @param {number|string} daysCount
     * @returns {*}
     */
    function buildSanitaryComplianceRow(asset, readings, iotDevices, settings, daysCount) {
        const assetDevices = iotDevices.filter(device => device.assetId === asset.id);
        const assetReadings = readings.filter(reading => reading.assetId === asset.id);
        const temperatureReadings = assetReadings.map(reading => reading.temperature).filter(value => value !== null);
        const humidityReadings = assetReadings.map(reading => reading.humidity).filter(value => value !== null);
        const expectedReadings = assetDevices.length
            ? expectedDailyReadingsFor(assetDevices, assetReadings.length) * daysCount
            : assetReadings.length;
        const outOfRangeCount = assetReadings.filter(reading => reading.isOutOfRange).length;
        const validReadings = Math.max(assetReadings.length - outOfRangeCount, 0);
        const missingReadings = Math.max(expectedReadings - assetReadings.length, 0);
        const incidentCount = complianceIncidentCount(asset);
        const complianceDenominator = expectedReadings || assetReadings.length;
        const complianceRate = complianceDenominator ? Math.round((validReadings / complianceDenominator) * 100) : 0;

        return {
            assetId: asset.id,
            assetName: asset.name,
            assetLocation: assetLocationFor(asset),
            totalReadings: assetReadings.length,
            expectedReadings,
            validReadings,
            outOfRangeCount,
            missingReadings,
            incidentCount,
            averageTemperature: average(temperatureReadings),
            averageHumidity: average(humidityReadings),
            complianceRate,
            status: complianceStatus(assetReadings.length, expectedReadings, outOfRangeCount, missingReadings, incidentCount, settings),
        };
    }

    /**
     * Builds monthly report row for presentation or reporting.
     *
     * @param {*} asset
     * @param {Array<*>} readings
     * @returns {*}
     */
    function buildMonthlyReportRow(asset, readings) {
        const assetReadings = readings
            .filter(reading => reading.assetId === asset.id)
            .sort((left, right) => new Date(left.recordedAt).getTime() - new Date(right.recordedAt).getTime());
        const temperatureReadings = assetReadings.map(reading => reading.temperature).filter(value => value !== null);
        const humidityReadings = assetReadings.map(reading => reading.humidity).filter(value => value !== null);
        const outOfRangeCount = assetReadings.filter(reading => reading.isOutOfRange).length;
        const validReadings = Math.max(assetReadings.length - outOfRangeCount, 0);
        const incidentCount = outOfRangeCount + complianceIncidentCount(asset);
        const complianceRate = assetReadings.length ? Math.round((validReadings / assetReadings.length) * 100) : 0;

        return {
            assetId: asset.id,
            assetName: asset.name,
            assetLocation: assetLocationFor(asset),
            totalReadings: assetReadings.length,
            validReadings,
            outOfRangeCount,
            incidentCount,
            averageTemperature: average(temperatureReadings),
            averageHumidity: average(humidityReadings),
            complianceRate,
            firstRecordedAt: assetReadings[0]?.recordedAt ?? null,
            lastRecordedAt: assetReadings[assetReadings.length - 1]?.recordedAt ?? null,
            status: monthlyStatus(assetReadings.length, incidentCount),
        };
    }

    /**
     * Handles entry status behavior in the reports context.
     *
     * @param {Array<*>} totalReadings
     * @param {Array<*>} missingReadings
     * @returns {string}
     */
    function entryStatus(totalReadings, missingReadings) {
        if (!totalReadings) return 'no-data';
        return missingReadings > 0 ? 'incomplete' : 'complete';
    }

    /**
     * Handles compliance status behavior in the reports context.
     *
     * @param {Array<*>} totalReadings
     * @param {Array<*>} expectedReadings
     * @param {number|string} outOfRangeCount
     * @param {Array<*>} missingReadings
     * @param {number|string} incidentCount
     * @param {*} settings
     * @returns {string}
     */
    function complianceStatus(totalReadings, expectedReadings, outOfRangeCount, missingReadings, incidentCount, settings) {
        if (!settings || !totalReadings || !expectedReadings) return 'insufficient';
        return outOfRangeCount || missingReadings || incidentCount ? 'observation' : 'compliant';
    }

    /**
     * Handles compliance incident count behavior in the reports context.
     *
     * @param {*} asset
     * @returns {number}
     */
    function complianceIncidentCount(asset) {
        const currentIncident = normalizeIncident(asset.lastIncident);
        const incidentCount = currentIncident === 'none' ? 0 : 1;
        const connectivityIncident = asset.connectivity === ConnectivityStatus.Online ? 0 : 1;
        return incidentCount + connectivityIncident;
    }

    /**
     * Handles monthly status behavior in the reports context.
     *
     * @param {Array<*>} totalReadings
     * @param {number|string} incidentCount
     * @returns {string}
     */
    function monthlyStatus(totalReadings, incidentCount) {
        if (!totalReadings) return 'insufficient';
        return incidentCount ? 'attention' : 'complete';
    }

    /**
     * Handles severity weight behavior in the reports context.
     *
     * @param {*} severity
     * @returns {number}
     */
    function severityWeight(severity) {
        if (severity === 'potential-non-compliance') return 3;
        return severity === 'observation' ? 2 : 1;
    }

    /**
     * Handles expected daily readings for behavior in the reports context.
     *
     * @param {*} iotDevices
     * @param {Array<*>} fallbackReadings
     * @returns {*}
     */
    function expectedDailyReadingsFor(iotDevices, fallbackReadings) {
        if (!iotDevices.length) return fallbackReadings;
        return iotDevices.reduce((total, device) => total + expectedReadingsForFrequency(device.readingFrequencySeconds), 0);
    }

    /**
     * Handles expected readings for frequency behavior in the reports context.
     *
     * @param {*} readingFrequencySeconds
     * @returns {*}
     */
    function expectedReadingsForFrequency(readingFrequencySeconds) {
        const safeFrequency = readingFrequencySeconds > 0 ? readingFrequencySeconds : 3600;
        return Math.ceil(86400 / safeFrequency);
    }

    /**
     * Handles average behavior in the reports context.
     *
     * @param {string} values
     * @returns {number}
     */
    function average(values) {
        if (!values.length) return null;
        const total = values.reduce((sum, value) => sum + value, 0);
        return Number((total / values.length).toFixed(1));
    }

    /**
     * Handles asset location for behavior in the reports context.
     *
     * @param {*} asset
     * @returns {string}
     */
    function assetLocationFor(asset) {
        return asset ? assetManagementStore.locationForAsset(asset) : 'N/A';
    }

    /**
     * Handles history reading event behavior in the reports context.
     *
     * @param {*} reading
     * @param {Array<*>} assets
     * @param {*} settings
     * @returns {*}
     */
    function historyReadingEvent(reading, assets, settings) {
        const asset = assetForReading(reading, assets);
        return {
            id: reading.id,
            assetId: reading.assetId,
            assetName: asset?.name ?? `#${reading.assetId}`,
            assetLocation: assetLocationFor(asset),
            eventType: 'reading',
            severity: reading.isOutOfRange ? 'warning' : 'normal',
            icon: 'sensors',
            occurredAt: reading.recordedAt,
            value: readingValueLabel(reading),
            messageKey: reading.isOutOfRange
                ? 'reports.history.messages.reading-out-of-range'
                : 'reports.history.messages.reading-in-range',
            messageParams: {range: temperatureRangeLabel(settings)},
        };
    }

    /**
     * Handles history alert event behavior in the reports context.
     *
     * @param {*} reading
     * @param {Array<*>} assets
     * @param {*} settings
     * @returns {*}
     */
    function historyAlertEvent(reading, assets, settings) {
        const asset = assetForReading(reading, assets);
        const severity = readingSeverity(reading, settings);
        return {
            id: 100000 + reading.id,
            assetId: reading.assetId,
            assetName: asset?.name ?? `#${reading.assetId}`,
            assetLocation: assetLocationFor(asset),
            eventType: 'alert',
            severity,
            icon: alertIcon(reading, settings),
            occurredAt: reading.recordedAt,
            value: readingValueLabel(reading),
            messageKey: alertMessageKey(reading, settings),
            messageParams: {range: temperatureRangeLabel(settings)},
        };
    }

    /**
     * Handles history incident events behavior in the reports context.
     *
     * @param {*} asset
     * @param {Object} filters
     * @param {Array<*>} readings
     * @returns {*}
     */
    function historyIncidentEvents(asset, filters, readings) {
        const occurredAt = incidentOccurredAt(asset, filters, readings);
        if (!isInDateRange(occurredAt, filters.fromDate, filters.toDate)) return [];

        const incidents = [];
        const incidentKey = normalizeIncident(asset.lastIncident);
        if (incidentKey !== 'none') {
            incidents.push({
                id: 200000 + asset.id,
                assetId: asset.id,
                assetName: asset.name,
                assetLocation: assetLocationFor(asset),
                eventType: 'incident',
                severity: incidentKey === 'connection-lost' ? 'critical' : 'warning',
                icon: incidentKey === 'connection-lost' ? 'wifi_off' : 'report_problem',
                occurredAt,
                value: asset.currentTemperature,
                messageKey: `reports.history.incidents.${incidentKey}`,
                messageParams: {},
            });
        }

        if (asset.connectivity !== ConnectivityStatus.Online) {
            incidents.push({
                id: 300000 + asset.id,
                assetId: asset.id,
                assetName: asset.name,
                assetLocation: assetLocationFor(asset),
                eventType: 'incident',
                severity: asset.connectivity === ConnectivityStatus.Offline ? 'critical' : 'warning',
                icon: 'wifi_off',
                occurredAt,
                value: asset.connectivity,
                messageKey: 'reports.history.incidents.connectivity',
                messageParams: {status: asset.connectivity},
            });
        }

        return incidents;
    }

    /**
     * Handles asset for reading behavior in the reports context.
     *
     * @param {*} reading
     * @param {Array<*>} assets
     * @returns {*}
     */
    function assetForReading(reading, assets) {
        return assets.find(asset => asset.id === reading.assetId);
    }

    /**
     * Handles reading severity behavior in the reports context.
     *
     * @param {*} reading
     * @param {*} settings
     * @returns {*}
     */
    function readingSeverity(reading, settings) {
        if (
            settings &&
            reading.temperature !== null &&
            (reading.temperature > settings.maximumTemperature + 2 || reading.temperature < settings.minimumTemperature - 2)
        ) {
            return 'critical';
        }

        if (
            (settings && reading.humidity !== null && reading.humidity > settings.maximumHumidity) ||
            (reading.batteryLevel !== null && reading.batteryLevel < 15) ||
            (reading.signalStrength !== null && reading.signalStrength < 35)
        ) {
            return 'warning';
        }

        return reading.isOutOfRange ? 'warning' : 'normal';
    }

    /**
     * Handles alert icon behavior in the reports context.
     *
     * @param {*} reading
     * @param {*} settings
     * @returns {string}
     */
    function alertIcon(reading, settings) {
        if (settings && reading.humidity !== null && reading.humidity > settings.maximumHumidity) return 'water_drop';
        if (reading.batteryLevel !== null && reading.batteryLevel < 15) return 'battery_alert';
        if (reading.signalStrength !== null && reading.signalStrength < 35) return 'signal_cellular_connected_no_internet_0_bar';
        return reading.temperature !== null && settings && reading.temperature < settings.minimumTemperature
            ? 'ac_unit'
            : 'device_thermostat';
    }

    /**
     * Handles alert message key behavior in the reports context.
     *
     * @param {*} reading
     * @param {*} settings
     * @returns {string}
     */
    function alertMessageKey(reading, settings) {
        if (settings && reading.humidity !== null && reading.humidity > settings.maximumHumidity) return 'reports.history.messages.high-humidity';
        if (reading.batteryLevel !== null && reading.batteryLevel < 15) return 'reports.history.messages.low-battery';
        if (reading.signalStrength !== null && reading.signalStrength < 35) return 'reports.history.messages.low-signal';
        return settings && reading.temperature !== null && reading.temperature > settings.maximumTemperature
            ? 'reports.history.messages.high-temperature'
            : 'reports.history.messages.low-temperature';
    }

    /**
     * Handles reading value label behavior in the reports context.
     *
     * @param {*} reading
     * @returns {string}
     */
    function readingValueLabel(reading) {
        const values = [
            reading.temperature !== null ? `${reading.temperature.toFixed(1)} °C` : null,
            reading.humidity !== null ? `${reading.humidity}%` : null,
            reading.batteryLevel !== null ? `${reading.batteryLevel}% battery` : null,
            reading.signalStrength !== null ? `${reading.signalStrength}% signal` : null,
        ].filter(Boolean);
        return values.join(' / ') || 'N/A';
    }

    /**
     * Handles incident occurred at behavior in the reports context.
     *
     * @param {*} asset
     * @param {Object} filters
     * @param {Array<*>} readings
     * @returns {*}
     */
    function incidentOccurredAt(asset, filters, readings) {
        const latestReading = readings
            .filter(reading => reading.assetId === asset.id)
            .sort((left, right) => new Date(right.recordedAt).getTime() - new Date(left.recordedAt).getTime())[0];
        return latestReading?.recordedAt ?? `${filters.toDate}T23:59:00`;
    }

    /**
     * Handles normalize incident behavior in the reports context.
     *
     * @param {*} lastIncident
     * @returns {*}
     */
    function normalizeIncident(lastIncident) {
        const prefix = 'asset-management.incidents.';
        return lastIncident?.startsWith(prefix) ? lastIncident.replace(prefix, '') : lastIncident || 'none';
    }

    /**
     * Handles temperature range label behavior in the reports context.
     *
     * @param {*} settings
     * @returns {string}
     */
    function temperatureRangeLabel(settings) {
        if (!settings) return 'N/A';
        return `${settings.minimumTemperature} °C - ${settings.maximumTemperature} °C`;
    }

    /**
     * Determines whether in date range is true.
     *
     * @param {string} value
     * @param {string} fromDate
     * @param {string} toDate
     * @returns {boolean}
     */
    function isInDateRange(value, fromDate, toDate) {
        const dateKey = dateKeyFor(value);
        return dateKey >= fromDate && dateKey <= toDate;
    }

    /**
     * Handles report overlaps period behavior in the reports context.
     *
     * @param {*} report
     * @param {Object} filters
     * @returns {*}
     */
    function reportOverlapsPeriod(report, filters) {
        const periodDate = report.periodDate;
        if (periodDate.includes(' - ')) {
            const [fromDate, toDate] = periodDate.split(' - ');
            return fromDate <= filters.toDate && toDate >= filters.fromDate;
        }

        if (/^\d{4}-\d{2}$/.test(periodDate)) {
            const range = monthDateRange(periodDate);
            return range.fromDate <= filters.toDate && range.toDate >= filters.fromDate;
        }

        const dateKey = dateKeyFor(periodDate);
        return dateKey >= filters.fromDate && dateKey <= filters.toDate;
    }

    /**
     * Handles report from daily log behavior in the reports context.
     *
     * @param {number|string} organizationId
     * @param {*} dailyLog
     * @returns {*}
     */
    function reportFromDailyLog(organizationId, dailyLog) {
        return new Report({
            id: nextReportId(),
            organizationId,
            uuid: dailyLogUuid(organizationId, dailyLog.date),
            type: ReportType.DailyLog,
            title: 'Daily thermal control log',
            periodDate: dailyLog.date,
            generatedAt: new Date().toISOString(),
        });
    }

    /**
     * Handles report from sanitary compliance behavior in the reports context.
     *
     * @param {number|string} organizationId
     * @param {*} complianceReport
     * @returns {*}
     */
    function reportFromSanitaryCompliance(organizationId, complianceReport) {
        return new Report({
            id: nextReportId(),
            organizationId,
            uuid: sanitaryComplianceUuid(organizationId, complianceReport.filters),
            type: ReportType.Compliance,
            title: 'Sanitary compliance report',
            periodDate: `${complianceReport.filters.fromDate} - ${complianceReport.filters.toDate}`,
            generatedAt: new Date().toISOString(),
        });
    }

    /**
     * Handles report from monthly report behavior in the reports context.
     *
     * @param {number|string} organizationId
     * @param {*} monthlyReport
     * @returns {*}
     */
    function reportFromMonthlyReport(organizationId, monthlyReport) {
        return new Report({
            id: nextReportId(),
            organizationId,
            uuid: monthlyReportUuid(organizationId, monthlyReport.month),
            type: ReportType.MonthlySummary,
            title: 'Monthly monitoring report',
            periodDate: monthlyReport.month,
            generatedAt: new Date().toISOString(),
        });
    }

    /**
     * Handles next report id behavior in the reports context.
     *
     * @returns {*}
     */
    function nextReportId() {
        return Math.max(...reports.value.map(report => report.id), 0) + 1;
    }

    /**
     * Handles daily log uuid behavior in the reports context.
     *
     * @param {number|string} organizationId
     * @param {string} date
     * @returns {string}
     */
    function dailyLogUuid(organizationId, date) {
        return `RPT-DL-${date.replaceAll('-', '')}-${organizationId.toString().padStart(3, '0')}`;
    }

    /**
     * Handles sanitary compliance uuid behavior in the reports context.
     *
     * @param {number|string} organizationId
     * @param {Object} filters
     * @returns {string}
     */
    function sanitaryComplianceUuid(organizationId, filters) {
        const assetKey = filters.assetId ? filters.assetId.toString().padStart(3, '0') : 'ALL';
        return `RPT-SC-${filters.fromDate.replaceAll('-', '')}-${filters.toDate.replaceAll('-', '')}-${assetKey}-${organizationId.toString().padStart(3, '0')}`;
    }

    /**
     * Handles monthly report uuid behavior in the reports context.
     *
     * @param {number|string} organizationId
     * @param {*} month
     * @returns {string}
     */
    function monthlyReportUuid(organizationId, month) {
        return `RPT-MS-${month.replace('-', '')}-${organizationId.toString().padStart(3, '0')}`;
    }

    /**
     * Handles today behavior in the reports context.
     *
     * @returns {*}
     */
    function today() {
        return formatDateKey(new Date());
    }

    /**
     * Handles date key for behavior in the reports context.
     *
     * @param {string} value
     * @returns {string}
     */
    function dateKeyFor(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
        return formatDateKey(date);
    }

    /**
     * Handles days in range behavior in the reports context.
     *
     * @param {string} fromDate
     * @param {string} toDate
     * @returns {*}
     */
    function daysInRange(fromDate, toDate) {
        const from = new Date(`${fromDate}T00:00:00`);
        const to = new Date(`${toDate}T00:00:00`);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 1;
        return Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    }

    /**
     * Handles month date range behavior in the reports context.
     *
     * @param {*} month
     * @returns {string}
     */
    function monthDateRange(month) {
        const currentDate = today();
        const currentMonth = currentDate.slice(0, 7);
        const safeMonth = month && month <= currentMonth ? month : currentMonth;
        const firstDay = `${safeMonth}-01`;
        if (safeMonth === currentMonth) return {fromDate: firstDay, toDate: currentDate};
        const [year, monthNumber] = safeMonth.split('-').map(Number);
        const lastDay = new Date(year, monthNumber, 0).getDate().toString().padStart(2, '0');
        return {fromDate: firstDay, toDate: `${safeMonth}-${lastDay}`};
    }

    /**
     * Handles rows to csv behavior in the reports context.
     *
     * @param {Array<*>} rows
     * @returns {*}
     */
    function rowsToCsv(rows) {
        return rows.map(row => row.map(cell => csvCell(cell)).join(',')).join('\n');
    }

    /**
     * Handles csv cell behavior in the reports context.
     *
     * @param {string} value
     * @returns {*}
     */
    function csvCell(value) {
        const text = String(value).replaceAll('"', '""');
        return `"${text}"`;
    }

    /**
     * Formats date key for display.
     *
     * @param {string} date
     * @returns {string}
     */
    function formatDateKey(date) {
        const year = date.getFullYear();
        const month = `${date.getMonth() + 1}`.padStart(2, '0');
        const day = `${date.getDate()}`.padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return {
        reports,
        loading,
        errors,
        error,
        reportsLoaded,
        fetchReports,
        reportsForOrganization,
        currentDate,
        buildDailyLog,
        buildOperationalHistory,
        buildSanitaryComplianceReport,
        buildComplianceReport,
        buildAuditEvidence,
        buildMonthlyReport,
        createDailyLogReport,
        createSanitaryComplianceReport,
        createMonthlySummaryReport,
        closeComplianceFinding,
        sanitaryComplianceCsv,
        monthlyReportCsv,
        auditEvidenceCsv,
    };
});

export default useReportsStore;
