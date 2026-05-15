/**
 * @typedef {Object} MaintenanceTaskProps
 * @property {number|null} [id]
 * @property {string} [label]
 * @property {string} [icon]
 * @property {string} [status]
 */

/**
 * Domain entity representing maintenance task.
 */
export class MaintenanceTask {
    /**
     * @param {MaintenanceTaskProps} [props]
     */
    constructor({id = null, label = '', icon = 'inventory_2', status = 'to-do'}) {
        this.id = Number(id);
        this.label = label;
        this.icon = icon;
        this.status = status;
    }
}
