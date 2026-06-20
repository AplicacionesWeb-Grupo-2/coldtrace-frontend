import {CalibrationStatus} from '@/asset-management/domain/model/calibration-status.js';
import {IoTDeviceStatus} from '@/asset-management/domain/model/iot-device-status.js';

/**
 * @typedef {Object} IoTDeviceProps
 * @property {number|null} [id]
 * @property {number|null} [organizationId]
 * @property {number|null} [gatewayId]
 * @property {string} [uuid]
 * @property {string} [deviceType]
 * @property {string} [model]
 * @property {string} [measurementType]
 * @property {number|null} [assetId]
 * @property {string} [status]
 * @property {string} [calibrationStatus]
 * @property {string} [lastCalibrationDate]
 * @property {string} [nextCalibrationDate]
 * @property {Array<*>} [measurementParameters]
 * @property {number} [readingFrequencySeconds]
 */

/**
 * Domain entity representing iot device.
 */
export class IoTDevice {
    /**
     * @param {IoTDeviceProps} [props]
     */
    constructor({
        id = null,
        organizationId = null,
        gatewayId = null,
        uuid = '',
        deviceType = '',
        model = '',
        measurementType = '',
        assetId = null,
        status = IoTDeviceStatus.Available,
        calibrationStatus = CalibrationStatus.Unknown,
        lastCalibrationDate = '—',
        nextCalibrationDate = '—',
        measurementParameters = [],
        readingFrequencySeconds = 3600,
    }) {
        this.id = Number(id);
        this.organizationId = Number(organizationId);
        this.gatewayId = gatewayId === null || gatewayId === undefined ? null : Number(gatewayId);
        this.uuid = uuid;
        this.deviceType = deviceType;
        this.model = model;
        this.measurementType = measurementType;
        this.assetId = assetId === null || assetId === undefined ? null : Number(assetId);
        this.status = status;
        this.calibrationStatus = calibrationStatus;
        this.lastCalibrationDate = lastCalibrationDate;
        this.nextCalibrationDate = nextCalibrationDate;
        this.measurementParameters = measurementParameters.length
            ? [...measurementParameters]
            : measurementType
                .split('/')
                .map(parameter => parameter.trim().toLowerCase().replace(/\s+/g, '-'))
                .filter(parameter => !!parameter);
        this.readingFrequencySeconds = Number(readingFrequencySeconds);
    }
}
