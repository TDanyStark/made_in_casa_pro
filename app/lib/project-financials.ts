/**
 * Hours and money invested in a project (see odd/tasks/project-financials.md).
 *
 * Cost rules per task:
 *  - Completed with a frozen internal rate: minutes × frozen rate. The current
 *    rate is never used, so past projects keep the rate of their time.
 *  - Completed without one: the external price declared at completion, else the
 *    accepted quote price. An internal task with no rate counts hours at cost 0.
 *  - Not completed yet: internal work at the assignee's current rate; external
 *    work at its accepted quote price, if any.
 *  - Unassigned tasks only add their minutes to the total.
 */

export interface ProjectFinancialRow {
  assigned_user_id: number | null;
  assigned_user_name: string | null;
  assignee_is_internal: number | null;
  assignee_hourly_rate: number | string | null;
  status: string;
  progress_minutes: number | string | null;
  completion_hourly_rate: number | string | null;
  completion_cost: number | string | null;
  accepted_quote_price: number | string | null;
}

export interface CollaboratorInvestment {
  user_id: number;
  name: string;
  is_internal: boolean;
  minutes: number;
  cost: number;
}

export interface ProjectFinancials {
  sale_price: number | null;
  total_minutes: number;
  internal_minutes: number;
  external_minutes: number;
  internal_cost: number;
  external_cost: number;
  total_cost: number;
  margin: number | null;
  by_collaborator: CollaboratorInvestment[];
}

const toNumber = (value: number | string | null | undefined): number | null =>
  value === null || value === undefined || value === "" ? null : Number(value);

const roundCents = (value: number) => Math.round(value * 100) / 100;

function classifyTask(row: ProjectFinancialRow): { internal: boolean; cost: number } {
  const minutes = toNumber(row.progress_minutes) ?? 0;
  const frozenRate = toNumber(row.completion_hourly_rate);
  const externalPrice = toNumber(row.completion_cost) ?? toNumber(row.accepted_quote_price);
  const assigneeInternal = Number(row.assignee_is_internal) === 1;

  if (row.status === "completed") {
    if (frozenRate !== null) return { internal: true, cost: (minutes / 60) * frozenRate };
    if (externalPrice !== null) return { internal: false, cost: externalPrice };
    return { internal: assigneeInternal, cost: 0 };
  }
  if (assigneeInternal) {
    return { internal: true, cost: (minutes / 60) * (toNumber(row.assignee_hourly_rate) ?? 0) };
  }
  return { internal: false, cost: toNumber(row.accepted_quote_price) ?? 0 };
}

export function computeProjectFinancials(
  rows: ProjectFinancialRow[],
  salePrice: number | string | null
): ProjectFinancials {
  const sale = toNumber(salePrice);
  let totalMinutes = 0;
  let internalMinutes = 0;
  let externalMinutes = 0;
  let internalCost = 0;
  let externalCost = 0;
  const byUser = new Map<number, CollaboratorInvestment>();

  for (const row of rows) {
    const minutes = toNumber(row.progress_minutes) ?? 0;
    totalMinutes += minutes;
    if (row.assigned_user_id === null) continue;

    const { internal, cost } = classifyTask(row);
    if (internal) {
      internalMinutes += minutes;
      internalCost += cost;
    } else {
      externalMinutes += minutes;
      externalCost += cost;
    }

    const entry = byUser.get(row.assigned_user_id) ?? {
      user_id: row.assigned_user_id,
      name: row.assigned_user_name ?? "",
      is_internal: Number(row.assignee_is_internal) === 1,
      minutes: 0,
      cost: 0,
    };
    entry.minutes += minutes;
    entry.cost = roundCents(entry.cost + cost);
    byUser.set(row.assigned_user_id, entry);
  }

  const totalCost = roundCents(internalCost + externalCost);
  return {
    sale_price: sale,
    total_minutes: totalMinutes,
    internal_minutes: internalMinutes,
    external_minutes: externalMinutes,
    internal_cost: roundCents(internalCost),
    external_cost: roundCents(externalCost),
    total_cost: totalCost,
    margin: sale === null ? null : roundCents(sale - totalCost),
    by_collaborator: [...byUser.values()].sort((a, b) => b.cost - a.cost),
  };
}
