import { api } from 'src/lib/api/client';
import type { MembershipResponse, MembershipRole, OrganizationResponse } from 'src/lib/api/types';

export interface AddMemberRequest {
  userId: string;
  role: MembershipRole;
}

export const organizationApi = {
  get(organizationId: string, signal?: AbortSignal) {
    return api.get<OrganizationResponse>(`/organizations/${organizationId}`, { signal });
  },
  members(organizationId: string, signal?: AbortSignal) {
    return api.get<MembershipResponse[]>(`/organizations/${organizationId}/members`, { signal });
  },
  addMember(organizationId: string, request: AddMemberRequest) {
    return api.post<MembershipResponse>(`/organizations/${organizationId}/members`, request);
  },
};
