export class BaseEndpoint {
    constructor(baseApi, endpointPath) {
        this.http = baseApi.http;
        this.endpointPath = endpointPath;
    }

    async getAll() {
        const response = await this.http.get(this.endpointPath);
        return this.collectionFallbackResponse(response);
    }

    getById(id) {
        return this.requestItem('get', id);
    }

    create(resource) {
        return this.requestCollectionWrite('post', resource);
    }

    update(id, resource) {
        return this.requestItem('put', id, resource);
    }

    delete(id) {
        return this.requestItem('delete', id);
    }

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

    shouldUseCollectionFallback(response, fallbackResponse) {
        const responseItems = Array.isArray(response.data) ? response.data : null;
        const fallbackItems = Array.isArray(fallbackResponse.data) ? fallbackResponse.data : null;
        if (!responseItems || !fallbackItems) return false;

        return responseItems.some(item => item?.apiId === 'v1') || fallbackItems.length > responseItems.length;
    }

    fallbackBaseURL() {
        return this.http.defaults.baseURL?.replace(/\/api\/v1\/?$/, '');
    }

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
