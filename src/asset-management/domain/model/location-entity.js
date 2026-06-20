/**
 * @typedef {Object} LocationProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [name]
 * @property {string} [type]
 * @property {string} [address]
 * @property {string} [description]
 * @property {string} [status]
 */

/**
 * Domain entity representing an operational location.
 */
export class Location {
    /**
     * @param {LocationProps} [props]
     */
    constructor({
        id = null,
        organizationId = null,
        name = '',
        type = 'WAREHOUSE',
        address = '',
        description = '',
        status = 'active',
    } = {}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.name = name;
        this.type = type;
        this.address = address ?? '';
        this.description = description ?? '';
        this.status = status;
    }
}
