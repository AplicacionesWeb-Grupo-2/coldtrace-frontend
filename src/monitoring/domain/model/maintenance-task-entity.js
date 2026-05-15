export class MaintenanceTask {
    constructor({id = null, label = '', icon = 'inventory_2', status = 'to-do'}) {
        this.id = Number(id);
        this.label = label;
        this.icon = icon;
        this.status = status;
    }
}
