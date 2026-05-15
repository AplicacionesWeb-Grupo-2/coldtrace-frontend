/**
 * @typedef {Object} UserProps
 * @property {number|null} [id]
 * @property {string} [uuid]
 * @property {number|null} [organizationUserId]
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [email]
 * @property {number|null} [organizationId]
 * @property {number|null} [roleId]
 */

/**
 * Domain entity representing user.
 */
export class User {
    /**
     * @param {UserProps} [props]
     */
    constructor({
        id = null,
        uuid = '',
        organizationUserId = null,
        firstName = '',
        lastName = '',
        email = '',
        organizationId = null,
        roleId = null,
    }) {
        this.id = Number(id);
        this.uuid = uuid || `USR-${id}`;
        this.organizationUserId = organizationUserId ?? this.id;
        this.firstName = firstName;
        this.lastName = lastName;
        this.email = email;
        this.organizationId = Number(organizationId);
        this.roleId = Number(roleId);
    }

    /**
     * Returns the full name value for this entity.
     *
     * @returns {string}
     */
    get fullName() {
        return `${this.firstName} ${this.lastName}`.trim();
    }
}
