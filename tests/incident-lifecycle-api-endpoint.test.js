import assert from 'node:assert/strict';
import test from 'node:test';
import {IncidentLifecycleApiEndpoint} from '../src/alerts/infrastructure/incident-lifecycle-api-endpoint.js';

function endpointWithCalls({patchError} = {}) {
    const calls = [];
    const http = {
        async patch(url, data) {
            calls.push({method: 'patch', url, data});
            if (patchError) throw patchError;
            return {status: 200, data: {id: 8, correctiveAction: data.correctiveAction}};
        },
        async post(url, data) {
            calls.push({method: 'post', url, data});
            return {status: 200, data: {id: 8, status: 'resolved'}};
        },
    };

    return {
        calls,
        endpoint: new IncidentLifecycleApiEndpoint({http}, '/api/v1/organizations/3/incidents'),
    };
}

test('registers the corrective action before resolving a closed incident', async () => {
    const {calls, endpoint} = endpointWithCalls();

    const response = await endpoint.updateLifecycle({
        id: 8,
        status: 'closed',
        recognizedBy: 'Shift operator',
        closedBy: 'Quality manager',
        correctiveAction: 'Replaced the damaged temperature probe.',
        closureEvidence: 'Probe calibration report CT-442.',
    });

    assert.equal(response.data.status, 'resolved');
    assert.deepEqual(calls, [
        {
            method: 'patch',
            url: '/api/v1/organizations/3/incidents/8/corrective-action',
            data: {
                correctiveAction: 'Replaced the damaged temperature probe.',
                registeredBy: 'Quality manager',
            },
        },
        {
            method: 'post',
            url: '/api/v1/organizations/3/incidents/8/resolutions',
            data: {
                resolvedBy: 'Quality manager',
                resolutionNotes: 'Probe calibration report CT-442.',
            },
        },
    ]);
});

test('does not resolve when corrective action registration fails', async () => {
    const patchError = new Error('corrective action rejected');
    const {calls, endpoint} = endpointWithCalls({patchError});

    await assert.rejects(
        endpoint.updateLifecycle({
            id: 8,
            status: 'closed',
            closedBy: 'Quality manager',
            correctiveAction: 'Replace the damaged temperature probe.',
        }),
        patchError,
    );

    assert.equal(calls.length, 1);
    assert.equal(calls[0].method, 'patch');
});

test('prioritizes escalation over acknowledgement for an active incident', async () => {
    const {calls, endpoint} = endpointWithCalls();

    await endpoint.updateLifecycle({
        id: 8,
        status: 'recognized',
        recognizedBy: 'Shift operator',
        escalationStatus: 'escalated',
        escalationPolicyMinutes: 30,
        escalatedTo: 'Operations manager',
    });

    assert.deepEqual(calls, [{
        method: 'patch',
        url: '/api/v1/organizations/3/incidents/8/escalation',
        data: {
            escalatedBy: 'Operations manager',
            escalationReason: 'Incident remained active for 30 minutes.',
        },
    }]);
});

test('acknowledges a recognized incident with the responsible actor', async () => {
    const {calls, endpoint} = endpointWithCalls();

    await endpoint.updateLifecycle({
        id: 8,
        status: 'recognized',
        recognizedBy: 'Shift operator',
        escalationStatus: 'none',
    });

    assert.deepEqual(calls, [{
        method: 'post',
        url: '/api/v1/organizations/3/incidents/8/acknowledgements',
        data: {acknowledgedBy: 'Shift operator'},
    }]);
});
