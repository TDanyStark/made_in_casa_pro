// S2, S4, S5: hours and money invested in a project.
import { computeProjectFinancials, type ProjectFinancialRow } from '@/lib/project-financials';

function row(o: Partial<ProjectFinancialRow>): ProjectFinancialRow {
  return {
    assigned_user_id: 1,
    assigned_user_name: 'Ana',
    assignee_is_internal: 1,
    assignee_hourly_rate: null,
    status: 'completed',
    progress_minutes: 0,
    completion_hourly_rate: null,
    completion_cost: null,
    accepted_quote_price: null,
    ...o,
  };
}

describe('computeProjectFinancials()', () => {
  it('uses the frozen rate of completed internal tasks, never the current one (S5)', () => {
    const r = computeProjectFinancials(
      [row({ progress_minutes: 120, completion_hourly_rate: 30000, assignee_hourly_rate: 40000 })],
      null
    );
    expect(r.internal_minutes).toBe(120);
    expect(r.internal_cost).toBe(60000);
    expect(r.total_cost).toBe(60000);
  });

  it('values unfinished internal work at the current rate', () => {
    const r = computeProjectFinancials(
      [row({ status: 'in_progress', progress_minutes: 90, assignee_hourly_rate: 40000 })],
      null
    );
    expect(r.internal_cost).toBe(60000);
  });

  it('adds the external price declared at completion, else the accepted quote (S4)', () => {
    const r = computeProjectFinancials(
      [
        row({ assigned_user_id: 2, assigned_user_name: 'Ext', assignee_is_internal: 0, progress_minutes: 60, completion_cost: 500000 }),
        row({ assigned_user_id: 3, assigned_user_name: 'Quo', assignee_is_internal: 0, progress_minutes: 30, accepted_quote_price: 70000 }),
        row({ assigned_user_id: 3, assigned_user_name: 'Quo', assignee_is_internal: 0, status: 'in_progress', progress_minutes: 10, accepted_quote_price: 20000 }),
      ],
      null
    );
    expect(r.external_minutes).toBe(100);
    expect(r.external_cost).toBe(590000);
    expect(r.internal_cost).toBe(0);
  });

  it('keeps an external price over the assignee becoming internal later', () => {
    const r = computeProjectFinancials(
      [row({ assignee_is_internal: 1, assignee_hourly_rate: 40000, progress_minutes: 60, completion_cost: 100000 })],
      null
    );
    expect(r.external_cost).toBe(100000);
    expect(r.internal_cost).toBe(0);
  });

  it('counts hours of an internal task with no rate at zero cost', () => {
    const r = computeProjectFinancials([row({ progress_minutes: 45 })], null);
    expect(r.internal_minutes).toBe(45);
    expect(r.internal_cost).toBe(0);
  });

  it('counts unassigned minutes only in the total', () => {
    const r = computeProjectFinancials(
      [row({ assigned_user_id: null, assigned_user_name: null, assignee_is_internal: null, progress_minutes: 15 })],
      null
    );
    expect(r.total_minutes).toBe(15);
    expect(r.internal_minutes).toBe(0);
    expect(r.external_minutes).toBe(0);
    expect(r.by_collaborator).toEqual([]);
  });

  it('returns the margin against the sale price, or null without one (S1)', () => {
    const rows = [row({ progress_minutes: 60, completion_hourly_rate: 30000 })];
    expect(computeProjectFinancials(rows, 100000)).toMatchObject({ sale_price: 100000, total_cost: 30000, margin: 70000 });
    expect(computeProjectFinancials(rows, null)).toMatchObject({ sale_price: null, margin: null });
  });

  it('groups by collaborator sorted by cost, highest first', () => {
    const r = computeProjectFinancials(
      [
        row({ progress_minutes: 60, completion_hourly_rate: 10000 }),
        row({ progress_minutes: 60, completion_hourly_rate: 10000 }),
        row({ assigned_user_id: 2, assigned_user_name: 'Ext', assignee_is_internal: 0, progress_minutes: 30, completion_cost: 50000 }),
      ],
      null
    );
    expect(r.by_collaborator).toEqual([
      { user_id: 2, name: 'Ext', is_internal: false, minutes: 30, cost: 50000 },
      { user_id: 1, name: 'Ana', is_internal: true, minutes: 120, cost: 20000 },
    ]);
  });

  it('accepts numeric strings as returned by PostgreSQL NUMERIC and rounds to cents', () => {
    const r = computeProjectFinancials(
      [row({ progress_minutes: 10, completion_hourly_rate: '10000.00' as unknown as number })],
      '250000.50' as unknown as number
    );
    expect(r.internal_cost).toBe(1666.67);
    expect(r.sale_price).toBe(250000.5);
  });

  it('returns zeros for a project without tasks', () => {
    expect(computeProjectFinancials([], null)).toEqual({
      sale_price: null, total_minutes: 0, internal_minutes: 0, external_minutes: 0,
      internal_cost: 0, external_cost: 0, total_cost: 0, margin: null, by_collaborator: [],
    });
  });
});
