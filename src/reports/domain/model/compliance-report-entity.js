import {FindingStatus} from '@/reports/domain/model/finding-status.js';

export class ComplianceReport {
    constructor({id = null, organizationId = null, filters = {}, generatedAt = '', findings = []}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.filters = filters;
        this.generatedAt = generatedAt;
        this.findings = findings;
    }

    get totalFindings() {
        return this.findings.length;
    }

    get openFindings() {
        return this.findings.filter(finding => finding.status === FindingStatus.Open).length;
    }

    get closedFindings() {
        return this.findings.filter(finding => finding.status === FindingStatus.Closed).length;
    }

    get affectedAssets() {
        return new Set(this.findings.map(finding => finding.assetId)).size;
    }

    get potentialNonCompliance() {
        return this.findings.filter(finding => finding.severity === 'potential-non-compliance').length;
    }

    get limitations() {
        return this.findings.filter(finding => finding.severity === 'limitation').length;
    }

    get hasFindings() {
        return this.totalFindings > 0;
    }
}
