/**
 * @typedef {Object} PermissionProps
 * @property {number|null} [id]
 * @property {string} [resource]
 * @property {string} [action]
 * @property {string} [description]
 */

/**
 * Domain entity representing permission.
 */
export class Permission {
    /**
     * @param {PermissionProps} [props]
     */
    constructor({id = null, resource = '', action = '', description = ''}) {
        this.id = Number(id);
        this.resource = resource;
        this.action = action;
        this.description = description;
    }
}
