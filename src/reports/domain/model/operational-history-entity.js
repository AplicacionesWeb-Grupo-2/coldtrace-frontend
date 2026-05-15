export class OperationalHistory {
    constructor({filters = {}, events = []}) {
        this.filters = filters;
        this.events = events;
    }

    get totalEvents() {
        return this.events.length;
    }

    get readingsCount() {
        return this.events.filter(event => event.eventType === 'reading').length;
    }

    get alertsCount() {
        return this.events.filter(event => event.eventType === 'alert').length;
    }

    get incidentsCount() {
        return this.events.filter(event => event.eventType === 'incident').length;
    }
}
