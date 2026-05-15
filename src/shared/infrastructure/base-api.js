import axios from 'axios';

const coldTraceApiUrl = import.meta.env.VITE_COLDTRACE_API_URL;

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
            baseURL: coldTraceApiUrl ?? 'http://localhost:3000/api/v1',
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    /**
     * Exposes the configured Axios instance.
     *
     * @returns {import('axios').AxiosInstance}
     */
    get http() {
        return this.#http;
    }
}
