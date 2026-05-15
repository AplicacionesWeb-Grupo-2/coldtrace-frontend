export class StorageDistributionItem {
    constructor({id = null, label = '', assetCount = 0, percentage = 0, color = '#9AA3AF'}) {
        this.id = Number(id);
        this.label = label;
        this.assetCount = Number(assetCount);
        this.percentage = Number(percentage);
        this.color = color;
    }
}
