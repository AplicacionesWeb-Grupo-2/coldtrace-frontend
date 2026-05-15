export class EvidenceItem {
    constructor({id = '', status = 'incomplete', quantity = 0, requiredQuantity = 0, messageKey = '', messageParams = {}}) {
        this.id = id;
        this.status = status;
        this.quantity = Number(quantity);
        this.requiredQuantity = Number(requiredQuantity);
        this.messageKey = messageKey;
        this.messageParams = messageParams;
    }

    get isComplete() {
        return this.status === 'complete';
    }
}
