/**
 * @typedef {Object} DailyLogProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {string} [date]
 * @property {string} [generatedAt]
 * @property {number} [expectedReadings]
 * @property {Array<*>} [entries]
 */

/**
 * Domain entity representing daily log.
 */
export class DailyLog {
    /**
     * @param {DailyLogProps} [props]
     */
    constructor({id = null, organizationId = null, date = '', generatedAt = '', expectedReadings = 0, entries = []}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.date = date;
        this.generatedAt = generatedAt;
        this.expectedReadings = Number(expectedReadings);
        this.entries = entries;
    }

    /**
     * Returns the total readings value for this entity.
     *
     * @returns {number}
     */
    get totalReadings() {
        return this.entries.reduce((total, entry) => total + entry.totalReadings, 0);
    }

    /**
     * Returns the monitored assets value for this entity.
     *
     * @returns {*}
     */
    get monitoredAssets() {
        return this.entries.length;
    }

    /**
     * Returns the out of range readings value for this entity.
     *
     * @returns {*}
     */
    get outOfRangeReadings() {
        return this.entries.reduce((total, entry) => total + entry.outOfRangeCount, 0);
    }

    /**
     * Returns the incomplete assets value for this entity.
     *
     * @returns {*}
     */
    get incompleteAssets() {
        return this.entries.filter(entry => entry.status !== 'complete').length;
    }

    /**
     * Returns the compliance rate value for this entity.
     *
     * @returns {number}
     */
    get complianceRate() {
        if (!this.totalReadings) return 0;
        const validReadings = this.totalReadings - this.outOfRangeReadings;
        return Math.round((validReadings / this.totalReadings) * 100);
    }

    /**
     * Returns the has incomplete data value for this entity.
     *
     * @returns {boolean}
     */
    get hasIncompleteData() {
        return this.incompleteAssets > 0;
    }
}
