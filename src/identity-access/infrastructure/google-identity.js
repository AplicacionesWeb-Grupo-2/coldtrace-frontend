const googleScriptUrl = 'https://accounts.google.com/gsi/client';
const defaultGoogleOAuthClientId = '458208617776-jdce9bkfp960sd01v9d9tgj6ns3ca9j3.apps.googleusercontent.com';
const googlePromptTimeoutMs = 60000;

/**
 * Starts the Google Identity Services prompt and returns a backend-ready token exchange request.
 */
export class GoogleIdentityService {
    #scriptLoading = null;

    /**
     * Determines whether Google sign-in can be started.
     *
     * @returns {boolean}
     */
    get configured() {
        return Boolean(this.#clientId);
    }

    /**
     * Starts Google sign-in.
     *
     * @returns {Promise<{idToken: string}>}
     */
    async signIn() {
        if (!this.configured) throw new Error('social-provider-unavailable');

        await this.#loadScript();
        const googleIdentity = window.google?.accounts?.id;
        if (!googleIdentity) throw new Error('social-provider-unavailable');

        return new Promise((resolve, reject) => {
            let settled = false;
            const timeoutId = window.setTimeout(
                () => rejectOnce('social-provider-unavailable'),
                googlePromptTimeoutMs,
            );
            const rejectOnce = (reason = 'social-provider-unavailable') => {
                if (settled) return;
                settled = true;
                window.clearTimeout(timeoutId);
                reject(new Error(reason));
            };

            googleIdentity.initialize({
                client_id: this.#clientId,
                callback: (response) => {
                    if (settled) return;
                    if (!response?.credential) {
                        rejectOnce();
                        return;
                    }

                    settled = true;
                    window.clearTimeout(timeoutId);
                    resolve({idToken: response.credential});
                },
            });
            googleIdentity.prompt((notification) => {
                if (notification.isDismissedMoment?.()) {
                    rejectOnce('social-sign-in-cancelled');
                    return;
                }

                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    rejectOnce();
                }
            });
        });
    }

    /**
     * Resolves the configured Google OAuth client id.
     *
     * @returns {string}
     */
    get #clientId() {
        return import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID ?? defaultGoogleOAuthClientId;
    }

    /**
     * Loads the Google script once.
     *
     * @returns {Promise<void>}
     */
    #loadScript() {
        if (window.google?.accounts?.id) return Promise.resolve();
        if (this.#scriptLoading) return this.#scriptLoading;

        this.#scriptLoading = new Promise((resolve, reject) => {
            const existingScript = document.querySelector(`script[src="${googleScriptUrl}"]`);
            if (existingScript) {
                existingScript.addEventListener('load', () => resolve(), {once: true});
                existingScript.addEventListener('error', () => reject(new Error('social-provider-unavailable')), {once: true});
                return;
            }

            const script = document.createElement('script');
            script.src = googleScriptUrl;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('social-provider-unavailable'));
            document.head.appendChild(script);
        });

        return this.#scriptLoading;
    }
}
