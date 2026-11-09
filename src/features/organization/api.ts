import { api } from 'src/lib/api/client';
import type { MembershipResponse, MembershipRole, OrganizationResponse, RegionalSettingsResponse } from 'src/lib/api/types';

export interface AddMemberRequest {
  userId: string;
  role: MembershipRole;
}

export interface UpdateRegionalSettingsRequest {
  country: string;
  currency: string;
}

export const organizationApi = {
  get(organizationId: string, signal?: AbortSignal) {
    return api.get<OrganizationResponse>(`/organizations/${organizationId}`, { signal });
  },
  regionalSettings(organizationId: string, signal?: AbortSignal) {
    return api.get<RegionalSettingsResponse>(`/organizations/${organizationId}/regional-settings`, { signal });
  },
  updateRegionalSettings(organizationId: string, request: UpdateRegionalSettingsRequest) {
    return api.patch<RegionalSettingsResponse>(`/organizations/${organizationId}/regional-settings`, request);
  },
  members(organizationId: string, signal?: AbortSignal) {
    return api.get<MembershipResponse[]>(`/organizations/${organizationId}/members`, { signal });
  },
  addMember(organizationId: string, request: AddMemberRequest) {
    return api.post<MembershipResponse>(`/organizations/${organizationId}/members`, request);
  },
};
