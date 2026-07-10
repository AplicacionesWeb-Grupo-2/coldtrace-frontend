import {BaseEndpoint} from '../../shared/infrastructure/base-endpoint.js';

const fallbackActor = 'ColdTrace User';

/**
 * Handles incident lifecycle transitions exposed as subordinate REST resources.
 */
export class IncidentLifecycleApiEndpoint extends BaseEndpoint {
    /**
     * Persists the lifecycle transition represented by the incident resource.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    async updateLifecycle(resource) {
        if (resource.status === 'closed') {
            if (resource.correctiveAction) {
                await this.registerCorrectiveAction(resource);
            }

            return this.resolve(resource);
        }

        if (resource.escalationStatus === 'escalated') {
            return this.escalate(resource);
        }

        if (resource.status === 'recognized') {
            return this.acknowledge(resource);
        }

        if (resource.correctiveAction) {
            return this.registerCorrectiveAction(resource);
        }

        return {status: 200, data: resource};
    }

    /**
     * Acknowledges an open incident.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    acknowledge(resource) {
        return this.http.post(`${this.endpointPath}/${resource.id}/acknowledgements`, {
            acknowledgedBy: resource.recognizedBy ?? fallbackActor,
        });
    }

    /**
     * Escalates an active incident.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    escalate(resource) {
        const escalationReason = resource.escalationPolicyMinutes
            ? `Incident remained active for ${resource.escalationPolicyMinutes} minutes.`
            : 'Incident requires escalation according to the active policy.';

        return this.http.patch(`${this.endpointPath}/${resource.id}/escalation`, {
            escalatedBy: resource.escalatedTo ?? fallbackActor,
            escalationReason,
        });
    }

    /**
     * Registers the action applied before resolution.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    registerCorrectiveAction(resource) {
        return this.http.patch(`${this.endpointPath}/${resource.id}/corrective-action`, {
            correctiveAction: resource.correctiveAction ?? 'Corrective action registered.',
            registeredBy: resource.closedBy ?? resource.recognizedBy ?? fallbackActor,
        });
    }

    /**
     * Resolves an active incident.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    resolve(resource) {
        return this.http.post(`${this.endpointPath}/${resource.id}/resolutions`, {
            resolvedBy: resource.closedBy ?? resource.recognizedBy ?? fallbackActor,
            resolutionNotes: resource.closureEvidence ?? resource.correctiveAction ?? 'Incident resolved.',
        });
    }
}
