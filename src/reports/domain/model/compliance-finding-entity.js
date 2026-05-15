import {FindingStatus} from '@/reports/domain/model/finding-status.js';

export class ComplianceFinding {
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
