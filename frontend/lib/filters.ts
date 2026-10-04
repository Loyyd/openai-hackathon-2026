export interface IncidentFilters { query: string; severity: string; type: string; status: string; assignee: string }
export const defaultFilters: IncidentFilters = { query: '', severity: 'all', type: 'all', status: 'active', assignee: 'all' };
