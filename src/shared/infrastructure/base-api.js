import axios from 'axios';
import {authSession} from '@/shared/infrastructure/auth-session.js';

const coldTraceApiUrl = import.meta.env.VITE_COLDTRACE_API_URL;
const defaultColdTraceApiUrl = 'http://localhost:3000/api/v1';
const authenticationEndpointPath = import.meta.env.VITE_AUTHENTICATION_ENDPOINT_PATH ?? '/authentication';
const inFlightGetRequests = new Map();

/**
 * Shared HTTP client factory used by infrastructure API facades.
 */
export class BaseApi {
    #http;

    /**
     * Creates the configured Axios HTTP client for ColdTrace API requests.
     */
    constructor() {
        this.#http = axios.create({
            baseURL: coldTraceApiUrl ?? defaultColdTraceApiUrl,
            headers: {
                'Content-Type': 'application/json',
            },
        });

        this.#http.interceptors.request.use((config) => {
            const token = authSession.token();
            if (token && !isAuthenticationRequest(config.url)) {
                config.headers.Authorization = `Bearer ${token}`;
            }
            return config;
        });

        this.#http.interceptors.response.use(
            response => response,
            (error) => {
                if (error.response?.status === 401 && !isAuthenticationRequest(error.config?.url)) {
                    authSession.clear();
                    if (typeof window !== 'undefined' && window.location.pathname !== '/identity-access/sign-in') {
                        window.location.assign('/identity-access/sign-in');
                    }
                }
                return Promise.reject(error);
            },
        );
    }

    /**
     * Exposes the configured Axios instance.
     *
     * @returns {import('axios').AxiosInstance}
     */
    get http() {
        return this.#http;
    }

    /**
     * Sends a deduplicated GET request.
     *
     * @param {string} url
     * @param {Object} config
     * @returns {Promise<import('axios').AxiosResponse>}
     */
    get(url, config = {}) {
        const key = this.#getRequestKey(url, config);
        if (inFlightGetRequests.has(key)) return inFlightGetRequests.get(key);

        const request = this.#http
            .get(url, config)
            .finally(() => inFlightGetRequests.delete(key));

        inFlightGetRequests.set(key, request);
        return request;
    }

    /**
     * Builds an organization-scoped backend path.
     *
     * @param {number|string|null} organizationId
     * @param {string} endpointPath
     * @returns {string|null}
     */
    organizationScopedPath(organizationId, endpointPath) {
        if (!organizationId) return null;
        const normalizedEndpointPath = endpointPath.startsWith('/') ? endpointPath : `/${endpointPath}`;
        return `/organizations/${organizationId}${normalizedEndpointPath}`;
    }

    /**
     * Creates an empty successful collection response.
     *
     * @returns {Promise<{status: number, data: Array}>}
     */
    emptyCollectionResponse() {
        return Promise.resolve({status: 200, data: []});
    }

    /**
     * Builds a stable request key for in-flight GET deduplication.
     *
     * @param {string} url
     * @param {Object} config
     * @returns {string}
     */
    #getRequestKey(url, config) {
        const baseUrl = this.#http.defaults.baseURL ?? '';
        const params = config.params ? JSON.stringify(config.params) : '';
        return `${baseUrl}|${url}|${params}`;
    }
}

/**
 * Determines whether an HTTP request targets the authentication API.
 *
 * @param {string|undefined} url
 * @returns {boolean}
 */
function isAuthenticationRequest(url = '') {
    return url.startsWith(authenticationEndpointPath) || url.includes(`${authenticationEndpointPath}/`);
}
