export class Role {
    constructor({id = null, name = '', label = '', permissions = []}) {
        this.id = Number(id);
        this.name = name;
        this.label = label;
        this.permissions = permissions;
    }
}
