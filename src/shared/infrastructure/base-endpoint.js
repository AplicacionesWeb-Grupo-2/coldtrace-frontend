/**
 * Shared endpoint helper that wraps common CRUD HTTP operations.
 */
export class BaseEndpoint {
    /**
     * Creates an endpoint helper for a specific API collection path.
     *
     * @param {*} baseApi
     * @param {*} endpointPath
     */
    constructor(baseApi, endpointPath) {
        this.http = baseApi.http;
        this.endpointPath = endpointPath;
    }

    /**
     * Requests all from the API.
     *
     * @returns {Promise<*>}
     */
    async getAll() {
        const response = await this.http.get(this.endpointPath);
        return this.collectionFallbackResponse(response);
    }

    /**
     * Requests by id from the API.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    getById(id) {
        return this.requestItem('get', id);
    }

    /**
     * Creates a resource in the shared context.
     *
     * @param {*} resource
     * @returns {Promise<*>}
     */
    create(resource) {
        return this.requestCollectionWrite('post', resource);
    }

    /**
     * Updates the selected resource in the shared context.
     *
     * @param {number|string} id
     * @param {*} resource
     * @returns {Promise<*>}
     */
    update(id, resource) {
        return this.requestItem('put', id, resource);
    }

    /**
     * Deletes the selected resource from the shared context.
     *
     * @param {number|string} id
     * @returns {Promise<*>}
     */
    delete(id) {
        return this.requestItem('delete', id);
    }

    /**
     * Handles request item behavior in the shared context.
     *
     * @param {*} method
     * @param {number|string} id
     * @param {*} data
     * @returns {Promise<*>}
     */
    async requestItem(method, id, data = undefined) {
        const url = `${this.endpointPath}/${id}`;
        const fallbackBaseURL = this.fallbackBaseURL();

        if (fallbackBaseURL && fallbackBaseURL !== this.http.defaults.baseURL) {
            try {
                return await this.http.request({method, baseURL: fallbackBaseURL, url, data});
            } catch {
                // Keep trying the configured endpoint; root collections are only a JSON Server convenience.
            }
        }

        try {
            return await this.http.request({method, url, data});
        } catch (error) {
            if (method === 'delete' && error.response?.status === 404) {
                return {status: 204, data: null};
            }

            if (error.response?.status !== 404) throw error;

            if (!fallbackBaseURL || fallbackBaseURL === this.http.defaults.baseURL) throw error;

            return this.http.request({method, baseURL: fallbackBaseURL, url, data});
        }
    }

    /**
     * Handles collection fallback response behavior in the shared context.
     *
     * @param {*} response
     * @returns {Promise<*>}
     */
    async collectionFallbackResponse(response) {
        const fallbackBaseURL = this.fallbackBaseURL();
        if (!fallbackBaseURL || fallbackBaseURL === this.http.defaults.baseURL) return response;

        try {
            const fallbackResponse = await this.http.request({
                method: 'get',
                baseURL: fallbackBaseURL,
                url: this.endpointPath,
            });

            return this.shouldUseCollectionFallback(response, fallbackResponse) ? fallbackResponse : response;
        } catch {
            return response;
        }
    }

    /**
     * Handles should use collection fallback behavior in the shared context.
     *
     * @param {*} response
     * @param {*} fallbackResponse
     * @returns {*}
     */
    shouldUseCollectionFallback(response, fallbackResponse) {
        const responseItems = Array.isArray(response.data) ? response.data : null;
        const fallbackItems = Array.isArray(fallbackResponse.data) ? fallbackResponse.data : null;
        if (!responseItems || !fallbackItems) return false;

        return responseItems.some(item => item?.apiId === 'v1') || fallbackItems.length > responseItems.length;
    }

    /**
     * Handles fallback base url behavior in the shared context.
     *
     * @returns {*}
     */
    fallbackBaseURL() {
        return this.http.defaults.baseURL?.replace(/\/api\/v1\/?$/, '');
    }

    /**
     * Handles request collection write behavior in the shared context.
     *
     * @param {*} method
     * @param {*} data
     * @returns {Promise<*>}
     */
    async requestCollectionWrite(method, data) {
        const fallbackBaseURL = this.fallbackBaseURL();

        if (fallbackBaseURL && fallbackBaseURL !== this.http.defaults.baseURL) {
            try {
                return await this.http.request({method, baseURL: fallbackBaseURL, url: this.endpointPath, data});
            } catch {
                // Real APIs may not expose root collections; keep the configured endpoint as the fallback.
            }
        }

        return this.http.request({method, url: this.endpointPath, data});
    }
}
