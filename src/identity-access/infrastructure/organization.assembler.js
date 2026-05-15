import {Organization} from '@/identity-access/domain/model/organization-entity.js';

/**
 * @typedef {Object} OrganizationApiResource
 * @property {*} [id]
 * @property {*} [legalName]
 * @property {*} [commercialName]
 * @property {*} [taxId]
 * @property {*} [contactEmail]
 */

/**
 * Maps organization resources between API payloads and domain entities.
 */
export class OrganizationAssembler {
    /**
     * Maps an API resource into a domain entity.
     *
     * @param {OrganizationApiResource} resource
     * @returns {Organization}
     */
    static toEntityFromResource(resource) {
        return new Organization({...resource});
    }

    /**
     * Maps an API response into a list of domain entities.
     *
     * @param {import('axios').AxiosResponse<OrganizationApiResource[]|Object>} response
     * @returns {Organization[]}
     */
    static toEntitiesFromResponse(response) {
        if (response.status !== 200) return [];
        const resources = response.data instanceof Array ? response.data : response.data.organizations;
        return resources.map(resource => this.toEntityFromResource(resource));
    }

    /**
     * Maps a domain entity into the API resource contract.
     *
     * @param {Organization} entity
     * @returns {OrganizationApiResource}
     */
    static toResourceFromEntity(entity) {
        return {
            id: entity.id,
            legalName: entity.legalName,
            commercialName: entity.commercialName,
            taxId: entity.taxId,
            contactEmail: entity.contactEmail,
        };
    }
}
