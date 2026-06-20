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
        this.baseApi = baseApi;
        this.http = baseApi.http;
        this.endpointPath = endpointPath;
    }

    /**
     * Requests all from the API.
     *
     * @returns {Promise<*>}
     */
    getAll() {
        return this.baseApi.get(this.endpointPath);
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

        try {
            return await this.http.request({method, url, data});
        } catch (error) {
            if (method === 'delete' && error.response?.status === 404) {
                return {status: 204, data: null};
            }

            throw error;
        }
    }

    /**
     * Handles request collection write behavior in the shared context.
     *
     * @param {*} method
     * @param {*} data
     * @returns {Promise<*>}
     */
    requestCollectionWrite(method, data) {
        return this.http.request({method, url: this.endpointPath, data});
    }
}
