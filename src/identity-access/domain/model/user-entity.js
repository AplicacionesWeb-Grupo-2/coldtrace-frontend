export class User {
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

    get fullName() {
        return `${this.firstName} ${this.lastName}`.trim();
    }
}
