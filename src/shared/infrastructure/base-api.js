import axios from 'axios';

const coldTraceApiUrl = import.meta.env.VITE_COLDTRACE_API_URL;

export class BaseApi {
    #http;

    constructor() {
        this.#http = axios.create({
            baseURL: coldTraceApiUrl ?? 'http://localhost:3000/api/v1',
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
        });
    }

    get http() {
        return this.#http;
    }
}
