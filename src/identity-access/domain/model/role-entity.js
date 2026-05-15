/**
 * @typedef {Object} RoleProps
 * @property {number|null} [id]
 * @property {string} [name]
 * @property {string} [label]
 * @property {Array<*>} [permissions]
 */

/**
 * Domain entity representing role.
 */
export class Role {
    /**
     * @param {RoleProps} [props]
     */
    constructor({id = null, name = '', label = '', permissions = []}) {
        this.id = Number(id);
        this.name = name;
        this.label = label;
        this.permissions = permissions;
    }
}
