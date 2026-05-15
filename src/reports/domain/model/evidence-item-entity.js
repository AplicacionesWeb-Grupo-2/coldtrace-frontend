/**
 * @typedef {Object} EvidenceItemProps
 * @property {string} [id]
 * @property {string} [status]
 * @property {number} [quantity]
 * @property {number} [requiredQuantity]
 * @property {string} [messageKey]
 * @property {Object} [messageParams]
 */

/**
 * Domain entity representing evidence item.
 */
export class EvidenceItem {
    /**
     * @param {EvidenceItemProps} [props]
     */
    constructor({id = '', status = 'incomplete', quantity = 0, requiredQuantity = 0, messageKey = '', messageParams = {}}) {
        this.id = id;
        this.status = status;
        this.quantity = Number(quantity);
        this.requiredQuantity = Number(requiredQuantity);
        this.messageKey = messageKey;
        this.messageParams = messageParams;
    }

    /**
     * Returns the is complete value for this entity.
     *
     * @returns {boolean}
     */
    get isComplete() {
        return this.status === 'complete';
    }
}
