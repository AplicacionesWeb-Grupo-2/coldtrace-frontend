/**
 * @typedef {Object} StorageDistributionItemProps
 * @property {number|null} [id]
 * @property {string} [label]
 * @property {number} [assetCount]
 * @property {number} [percentage]
 * @property {string} [color]
 */

/**
 * Domain entity representing storage distribution item.
 */
export class StorageDistributionItem {
    /**
     * @param {StorageDistributionItemProps} [props]
     */
    constructor({id = null, label = '', assetCount = 0, percentage = 0, color = '#9AA3AF'}) {
        this.id = Number(id);
        this.label = label;
        this.assetCount = Number(assetCount);
        this.percentage = Number(percentage);
        this.color = color;
    }
}
