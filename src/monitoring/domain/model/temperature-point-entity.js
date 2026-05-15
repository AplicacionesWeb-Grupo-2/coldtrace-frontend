export class TemperaturePoint {
    constructor({id = null, label = '', temperature = 0, ghost = 0, maxLimit = 1, minLimit = 0}) {
        this.id = Number(id);
        this.label = label;
        this.temperature = Number(temperature);
        this.ghost = Number(ghost);
        this.maxLimit = Number(maxLimit);
        this.minLimit = Number(minLimit);
    }
}
