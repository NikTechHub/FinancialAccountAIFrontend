import { api } from 'src/lib/api/client';
import type { PageResponse } from 'src/lib/api/types';
import type {
  AccountApi,
  AccountListParams,
  AccountParentOption,
  AccountRecord,
  AccountTreeNode,
  CreateAccountInput,
  UpdateAccountInput,
} from './types';

function listQuery(params: AccountListParams): string {
  const query = new URLSearchParams({
    page: String(params.page),
    size: String(params.size),
  });

  const search = params.search.trim();
  if (search) query.set('search', search);
  if (params.type) query.set('type', params.type);
  if (params.sort) query.set('sort', params.sort);

  return query.toString();
}

function collectSubtreeIds(
  nodes: AccountTreeNode[],
  accountId: string,
): Set<string> {
  const result = new Set<string>();

  function visit(node: AccountTreeNode): boolean {
    if (node.id === accountId) {
      result.add(node.id);
      node.children.forEach((child) => result.add(child.id));
      return true;
    }

    return node.children.some(visit);
  }

  nodes.some(visit);
  return result;
}

function flattenTree(
  nodes: AccountTreeNode[],
  excludedIds: Set<string>,
  depth = 0,
  result: AccountParentOption[] = [],
): AccountParentOption[] {
  for (const node of nodes) {
    if (excludedIds.has(node.id)) continue;

    result.push({
      id: node.id,
      code: node.code,
      name: node.name,
      type: node.type,
      depth,
    });
    flattenTree(node.children, excludedIds, depth + 1, result);
  }

  return result;
}

async function fetchAccountTree(signal?: AbortSignal): Promise<AccountTreeNode[]> {
  return api.get<AccountTreeNode[]>('/accounts/tree', { signal });
}

export const accountApi: AccountApi = {
  list(params, signal) {
    return api.get<PageResponse<AccountRecord>>(
      `/accounts?${listQuery(params)}`,
      { signal },
    );
  },

  create(input, signal) {
    return api.post<AccountRecord>('/accounts', input, { signal });
  },

  update(id, input, signal) {
    return api.put<AccountRecord>(`/accounts/${id}`, input, { signal });
  },

  deactivate(id, signal) {
    return api.delete<void>(`/accounts/${id}`, { signal });
  },

  async parentOptions(excludeAccountId, signal) {
    const tree = await fetchAccountTree(signal);
    const excludedIds = excludeAccountId
      ? collectSubtreeIds(tree, excludeAccountId)
      : new Set<string>();

    return flattenTree(tree, excludedIds);
  },
};

export type { CreateAccountInput, UpdateAccountInput };
