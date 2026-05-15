/**
 * @typedef {Object} OrganizationProps
 * @property {number|null} [id]
 * @property {string} [legalName]
 * @property {string} [commercialName]
 * @property {string} [taxId]
 * @property {string} [contactEmail]
 */

/**
 * Domain entity representing organization.
 */
export class Organization {
    /**
     * @param {OrganizationProps} [props]
     */
    constructor({
        id = null,
        legalName = '',
        commercialName = '',
        taxId = '',
        contactEmail = '',
    }) {
        this.id = Number(id);
        this.legalName = legalName;
        this.commercialName = commercialName;
        this.taxId = taxId;
        this.contactEmail = contactEmail;
    }
}
