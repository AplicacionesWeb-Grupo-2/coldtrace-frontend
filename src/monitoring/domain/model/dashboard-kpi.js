/**
 * @typedef {Object} DashboardKpiProps
 * @property {number|null} [id]
 * @property {string} [key]
 * @property {string} [title]
 * @property {string} [value]
 * @property {string} [valueUnit]
 * @property {string} [trend]
 * @property {string} [size]
 * @property {string} [type]
 * @property {Object} [color]
 * @property {*|null} [tooltip]
 * @property {Array<*>} [chartData]
 * @property {number} [highlightedBar]
 * @property {boolean} [showAnchor]
 */

/**
 * Domain entity representing dashboard kpi.
 */
export class DashboardKpi {
    /**
     * @param {DashboardKpiProps} [props]
     */
    constructor({
        id = null,
        key = '',
        title = '',
        value = '',
        valueUnit = '',
        trend = '',
        size = 'small',
        type = 'bars',
        color = {bg: '#ffffff', border: '#e5e7eb', text: '#1a1a1a', chart: '#33bfff'},
        tooltip = null,
        chartData = [],
        highlightedBar = -1,
        showAnchor = true,
    }) {
        this.id = Number(id);
        this.key = key;
        this.title = title;
        this.value = value;
        this.valueUnit = valueUnit;
        this.trend = trend;
        this.size = size;
        this.type = type;
        this.color = color;
        this.tooltip = tooltip;
        this.chartData = chartData;
        this.highlightedBar = Number(highlightedBar);
        this.showAnchor = Boolean(showAnchor);
    }
}
