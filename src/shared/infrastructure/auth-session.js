const storageKey = 'coldtrace.auth.session';

/**
 * Shared browser-backed store for the current ColdTrace backend session.
 */
export const authSession = {
    current,
    token,
    user,
    hasToken,
    set,
    clear,
};

/**
 * Returns the current persisted session.
 *
 * @returns {{token: string, user: Object}|null}
 */
function current() {
    return restore();
}

/**
 * Returns the current persisted JWT.
 *
 * @returns {string|null}
 */
function token() {
    return current()?.token ?? null;
}

/**
 * Returns the current persisted session user.
 *
 * @returns {Object|null}
 */
function user() {
    return current()?.user ?? null;
}

/**
 * Determines whether a backend session token exists.
 *
 * @returns {boolean}
 */
function hasToken() {
    return !!token();
}

/**
 * Persists the current backend session.
 *
 * @param {string} sessionToken
 * @param {Object} sessionUser
 * @returns {{token: string, user: Object}}
 */
function set(sessionToken, sessionUser) {
    const session = {token: sessionToken, user: sessionUser};
    browserStorage()?.setItem(storageKey, JSON.stringify(session));
    return session;
}

/**
 * Clears the current persisted backend session.
 *
 * @returns {void}
 */
function clear() {
    browserStorage()?.removeItem(storageKey);
}

/**
 * Restores a valid session from browser storage.
 *
 * @returns {{token: string, user: Object}|null}
 */
function restore() {
    const storedSession = browserStorage()?.getItem(storageKey);

    if (!storedSession) return null;

    try {
        const session = JSON.parse(storedSession);
        if (isValidSession(session)) return session;
    } catch {
        clear();
    }

    clear();
    return null;
}

/**
 * Checks the minimal session shape used by route guards and API requests.
 *
 * @param {*} session
 * @returns {boolean}
 */
function isValidSession(session) {
    return (
        typeof session?.token === 'string' &&
        !!session.token.trim() &&
        Number.isFinite(session.user?.id) &&
        session.user.id > 0 &&
        Number.isFinite(session.user?.organizationId) &&
        session.user.organizationId > 0 &&
        typeof session.user?.fullName === 'string' &&
        !!session.user.fullName.trim()
    );
}

/**
 * Safely resolves browser localStorage.
 *
 * @returns {Storage|null}
 */
function browserStorage() {
    if (typeof window === 'undefined') return null;

    const storage = window.localStorage;
    return storage &&
        typeof storage.getItem === 'function' &&
        typeof storage.setItem === 'function' &&
        typeof storage.removeItem === 'function'
        ? storage
        : null;
}
