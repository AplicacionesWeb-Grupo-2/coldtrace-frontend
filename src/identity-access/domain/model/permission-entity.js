export class Permission {
    constructor({id = null, resource = '', action = '', description = ''}) {
        this.id = Number(id);
        this.resource = resource;
        this.action = action;
        this.description = description;
    }
}
