/**
 * @typedef {Object} IncidentDayProps
 * @property {number|null} [id]
 * @property {string} [label]
 * @property {number} [normal]
 * @property {number} [warning]
 * @property {number} [critical]
 * @property {number} [offline]
 */

/**
 * Domain entity representing incident day.
 */
export class IncidentDay {
    /**
     * @param {IncidentDayProps} [props]
     */
    constructor({id = null, label = '', normal = 0, warning = 0, critical = 0, offline = 0}) {
        this.id = Number(id);
        this.label = label;
        this.normal = Number(normal);
        this.warning = Number(warning);
        this.critical = Number(critical);
        this.offline = Number(offline);
    }
}
