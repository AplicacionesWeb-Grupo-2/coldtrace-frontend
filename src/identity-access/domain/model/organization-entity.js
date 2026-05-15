export class Organization {
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
