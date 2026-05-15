import {CalibrationStatus} from '@/asset-management/domain/model/calibration-status.js';
import {IoTDeviceStatus} from '@/asset-management/domain/model/iot-device-status.js';

export class IoTDevice {
    constructor({
        id = null,
        organizationId = null,
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
