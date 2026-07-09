/**
 * Creates a read-only poller for organization data displayed by the shared shell.
 *
 * @param {Object} options
 * @param {() => number|string|null} options.getOrganizationId
 * @param {(organizationId: number) => Promise<*>} options.refreshAssets
 * @param {(organizationId: number) => Promise<*>} options.refreshIncidents
 * @param {number} [options.intervalMs]
 * @param {{setInterval: Function, clearInterval: Function}} [options.scheduler]
 * @returns {{start: () => void, stop: () => void, refresh: () => Promise<*>}}
 */
export function createOperationalDataPoller({
    getOrganizationId,
    refreshAssets,
    refreshIncidents,
    intervalMs = 12000,
    scheduler = globalThis,
}) {
    let intervalId = null;
    let refreshInFlight = null;

    async function refresh() {
        const organizationId = Number(getOrganizationId());
        if (!organizationId) return [];
        if (refreshInFlight) return refreshInFlight;

        refreshInFlight = Promise.allSettled([
            refreshAssets(organizationId),
            refreshIncidents(organizationId),
        ]).finally(() => {
            refreshInFlight = null;
        });

        return refreshInFlight;
    }

    function start() {
        if (intervalId !== null) return;
        intervalId = scheduler.setInterval(refresh, intervalMs);
    }

    function stop() {
        if (intervalId === null) return;
        scheduler.clearInterval(intervalId);
        intervalId = null;
    }

    return {start, stop, refresh};
}
