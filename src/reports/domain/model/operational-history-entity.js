/**
 * @typedef {Object} OperationalHistoryProps
 * @property {Object} [filters]
 * @property {Array<*>} [events]
 */

/**
 * Domain entity representing operational history.
 */
export class OperationalHistory {
    /**
     * @param {OperationalHistoryProps} [props]
     */
    constructor({filters = {}, events = []}) {
        this.filters = filters;
        this.events = events;
    }

    /**
     * Returns the total events value for this entity.
     *
     * @returns {number}
     */
    get totalEvents() {
        return this.events.length;
    }

    /**
     * Returns the readings count value for this entity.
     *
     * @returns {number}
     */
    get readingsCount() {
        return this.events.filter(event => event.eventType === 'reading').length;
    }

    /**
     * Returns the alerts count value for this entity.
     *
     * @returns {number}
     */
    get alertsCount() {
        return this.events.filter(event => event.eventType === 'alert').length;
    }

    /**
     * Returns the incidents count value for this entity.
     *
     * @returns {number}
     */
    get incidentsCount() {
        return this.events.filter(event => event.eventType === 'incident').length;
    }
}
