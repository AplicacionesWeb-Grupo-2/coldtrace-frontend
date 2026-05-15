import {ReportType} from '@/reports/domain/model/report-type.js';

export class Report {
    constructor({
        id = null,
        organizationId = null,
        uuid = '',
        type = ReportType.DailyLog,
        title = '',
        periodDate = '',
        generatedAt = '',
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.uuid = uuid;
        this.type = type;
        this.title = title;
        this.periodDate = periodDate;
        this.generatedAt = generatedAt;
    }
}
