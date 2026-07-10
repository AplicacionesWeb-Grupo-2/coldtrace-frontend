const appleScriptUrl = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';

/**
 * Loads Apple JS and starts the Sign in with Apple popup flow.
 */
export class AppleIdentityService {
    #scriptLoading = null;

    /**
     * Determines whether Apple sign-in can be started.
     *
     * @returns {boolean}
     */
    get configured() {
        return Boolean(this.#clientId && this.#redirectUri);
    }

    /**
     * Starts Apple sign-in.
     *
     * @returns {Promise<{idToken?: string, authorizationCode?: string, redirectUri?: string, nonce?: string, email?: string, fullName?: string}>}
     */
    async signIn() {
        if (!this.configured) throw new Error('social-provider-unavailable');

        const nonce = this.#createNonce();
        await this.#loadScript();
        const appleAuth = window.AppleID?.auth;
        if (!appleAuth) throw new Error('social-provider-unavailable');

        appleAuth.init({
            clientId: this.#clientId,
            scope: 'name email',
            redirectURI: this.#redirectUri,
            state: 'coldtrace-social-auth',
            nonce,
            usePopup: true,
        });

        const response = await appleAuth.signIn();
        const authorizationCode = response?.authorization?.code?.trim();
        const idToken = response?.authorization?.id_token?.trim();

        if (!authorizationCode && !idToken) {
            throw new Error('social-provider-unavailable');
        }

        return {
            ...(idToken ? {idToken} : {}),
            ...(authorizationCode ? {authorizationCode} : {}),
            redirectUri: this.#redirectUri,
            nonce,
            ...this.#userProfileFrom(response),
        };
    }

    /**
     * Resolves the configured Apple OAuth client id.
     *
     * @returns {string}
     */
    get #clientId() {
        return import.meta.env.VITE_APPLE_OAUTH_CLIENT_ID?.trim() ?? '';
    }

    /**
     * Resolves the configured Apple redirect URI.
     *
     * @returns {string}
     */
    get #redirectUri() {
        return import.meta.env.VITE_APPLE_OAUTH_REDIRECT_URI ?? `${window.location.origin}/identity-access/sign-in`;
    }

    /**
     * Loads the Apple script once.
     *
     * @returns {Promise<void>}
     */
    #loadScript() {
        if (window.AppleID?.auth) return Promise.resolve();
        if (this.#scriptLoading) return this.#scriptLoading;

        this.#scriptLoading = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src="${appleScriptUrl}"]`);
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(), {once: true});
                existingScript.addEventListener('error', () => reject(new Error('social-provider-unavailable')), {once: true});
                return;
            }

            const script = document.createElement('script');
            script.src = appleScriptUrl;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('social-provider-unavailable'));
            document.head.appendChild(script);
        });

        return this.#scriptLoading;
    }

    /**
     * Extracts the profile Apple may return on first authorization.
     *
     * @param {*} response
     * @returns {*}
     */
    #userProfileFrom(response) {
        const email = response?.user?.email?.trim().toLowerCase();
        const fullName = [
            response?.user?.name?.firstName?.trim(),
            response?.user?.name?.lastName?.trim(),
        ].filter(Boolean).join(' ');

        return {
            ...(email ? {email} : {}),
            ...(fullName ? {fullName} : {}),
        };
    }

    /**
     * Creates a nonce for Apple auth.
     *
     * @returns {string}
     */
    #createNonce() {
        const bytes = new Uint8Array(16);
        window.crypto.getRandomValues(bytes);
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }
}
