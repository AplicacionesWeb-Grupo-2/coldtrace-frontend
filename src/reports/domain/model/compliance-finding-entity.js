import {FindingStatus} from '@/reports/domain/model/finding-status.js';

/**
 * @typedef {Object} ComplianceFindingProps
 * @property {string} [id]
 * @property {number|null} [organizationId]
 * @property {number|null} [assetId]
 * @property {string} [assetName]
 * @property {string} [assetLocation]
 * @property {string} [type]
 * @property {string} [severity]
 * @property {string} [status]
 * @property {string} [periodFrom]
 * @property {string} [periodTo]
 * @property {string} [detectedAt]
 * @property {string} [evidence]
 * @property {string} [messageKey]
 * @property {Object} [messageParams]
 */

/**
 * Domain entity representing compliance finding.
 */
export class ComplianceFinding {
    /**
     * @param {ComplianceFindingProps} [props]
     */
    constructor({
        id = '',
        organizationId = null,
        assetId = null,
        assetName = '',
        assetLocation = '',
        type = 'missing-readings',
        severity = 'observation',
        status = FindingStatus.Open,
        periodFrom = '',
        periodTo = '',
        detectedAt = '',
        evidence = '',
        messageKey = '',
        messageParams = {},
    }) {
        this.id = id;
        this.organizationId = Number(organizationId);
        this.assetId = Number(assetId);
        this.assetName = assetName;
        this.assetLocation = assetLocation;
        this.type = type;
        this.severity = severity;
        this.status = status;
        this.periodFrom = periodFrom;
        this.periodTo = periodTo;
        this.detectedAt = detectedAt;
        this.evidence = evidence;
        this.messageKey = messageKey;
        this.messageParams = messageParams;
    }
}
