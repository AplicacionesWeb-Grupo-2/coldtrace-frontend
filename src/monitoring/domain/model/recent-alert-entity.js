export class RecentAlert {
    constructor({
        id = null,
        assetName = '',
        type = '',
        value = '',
        date = '',
        status = 'Unacknowledged',
        severity = 'warning',
        icon = 'report_problem',
    }) {
        this.id = Number(id);
        this.assetName = assetName;
        this.type = type;
        this.value = value;
        this.date = date;
        this.status = status;
        this.severity = severity;
        this.icon = icon;
    }
}
