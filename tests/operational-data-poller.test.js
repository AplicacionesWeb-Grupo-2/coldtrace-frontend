import assert from 'node:assert/strict';
import test from 'node:test';
import {createOperationalDataPoller} from '../src/shared/application/operational-data-poller.js';

test('the shell polling interval executes read operations only', async () => {
    const requests = [];
    let intervalCallback = null;
    let intervalDelay = null;
    let clearedIntervalId = null;
    const scheduler = {
        setInterval(callback, delay) {
            intervalCallback = callback;
            intervalDelay = delay;
            return 41;
        },
        clearInterval(intervalId) {
            clearedIntervalId = intervalId;
        },
    };
    const poller = createOperationalDataPoller({
        getOrganizationId: () => 7,
        refreshAssets: async organizationId => requests.push(`GET assets:${organizationId}`),
        refreshIncidents: async organizationId => requests.push(`GET incidents:${organizationId}`),
        scheduler,
    });

    poller.start();
    await intervalCallback();
    poller.stop();

    assert.equal(intervalDelay, 12000);
    assert.deepEqual(requests, ['GET assets:7', 'GET incidents:7']);
    assert.equal(clearedIntervalId, 41);
});

test('the poller coalesces overlapping refreshes and tolerates read failures', async () => {
    let releaseAssets;
    let assetReads = 0;
    let incidentReads = 0;
    const poller = createOperationalDataPoller({
        getOrganizationId: () => 9,
        refreshAssets: () => {
            assetReads += 1;
            return new Promise(resolve => {
                releaseAssets = resolve;
            });
        },
        refreshIncidents: async () => {
            incidentReads += 1;
            throw new Error('temporarily unavailable');
        },
        scheduler: {setInterval: () => 1, clearInterval: () => {}},
    });

    const firstRefresh = poller.refresh();
    const secondRefresh = poller.refresh();
    assert.equal(assetReads, 1);
    assert.equal(incidentReads, 1);

    releaseAssets();
    const [firstResult, secondResult] = await Promise.all([firstRefresh, secondRefresh]);

    assert.equal(firstResult[0].status, 'fulfilled');
    assert.equal(firstResult[1].status, 'rejected');
    assert.deepEqual(secondResult, firstResult);
});
