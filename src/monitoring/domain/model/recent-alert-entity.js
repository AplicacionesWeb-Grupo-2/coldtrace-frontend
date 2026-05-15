/**
 * @typedef {Object} RecentAlertProps
 * @property {number|null} [id]
 * @property {string} [assetName]
 * @property {string} [type]
 * @property {string} [value]
 * @property {string} [date]
 * @property {string} [status]
 * @property {string} [severity]
 * @property {string} [icon]
 */

/**
 * Domain entity representing recent alert.
 */
export class RecentAlert {
    /**
     * @param {RecentAlertProps} [props]
     */
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
