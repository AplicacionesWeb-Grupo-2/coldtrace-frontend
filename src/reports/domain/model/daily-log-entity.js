export class DailyLog {
    constructor({id = null, organizationId = null, date = '', generatedAt = '', expectedReadings = 0, entries = []}) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.date = date;
        this.generatedAt = generatedAt;
        this.expectedReadings = Number(expectedReadings);
        this.entries = entries;
    }

    get totalReadings() {
        return this.entries.reduce((total, entry) => total + entry.totalReadings, 0);
    }

    get monitoredAssets() {
        return this.entries.length;
    }

    get outOfRangeReadings() {
        return this.entries.reduce((total, entry) => total + entry.outOfRangeCount, 0);
    }

    get incompleteAssets() {
        return this.entries.filter(entry => entry.status !== 'complete').length;
    }

    get complianceRate() {
        if (!this.totalReadings) return 0;
        const validReadings = this.totalReadings - this.outOfRangeReadings;
        return Math.round((validReadings / this.totalReadings) * 100);
    }

    get hasIncompleteData() {
        return this.incompleteAssets > 0;
    }
}
