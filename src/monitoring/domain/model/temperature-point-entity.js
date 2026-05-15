/**
 * @typedef {Object} TemperaturePointProps
 * @property {number|null} [id]
 * @property {string} [label]
 * @property {number} [temperature]
 * @property {number} [ghost]
 * @property {number} [maxLimit]
 * @property {number} [minLimit]
 */

/**
 * Domain entity representing temperature point.
 */
export class TemperaturePoint {
    /**
     * @param {TemperaturePointProps} [props]
     */
    constructor({id = null, label = '', temperature = 0, ghost = 0, maxLimit = 1, minLimit = 0}) {
        this.id = Number(id);
        this.label = label;
        this.temperature = Number(temperature);
        this.ghost = Number(ghost);
        this.maxLimit = Number(maxLimit);
        this.minLimit = Number(minLimit);
    }
}
