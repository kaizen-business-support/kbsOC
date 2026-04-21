export type GuardOperator = 'AND' | 'OR';
export type ConditionOperator = 'BETWEEN' | 'LT' | 'GT' | 'GTE' | 'LTE' | 'IN' | 'NOT_IN';
export type ConditionField = 'amount' | 'riskScore' | 'creditTypeId';

export interface GuardCondition {
  field: ConditionField;
  operator: ConditionOperator;
  value: number | { min: number; max: number } | string[];
}

export interface GuardsJson {
  operator: GuardOperator;
  conditions: GuardCondition[];
}

export interface GuardContext {
  amount: number;
  riskScore: number;     // extrait de CreditApplication.score?.numeric — défaut 0
  creditTypeId: string;
}

function evaluateCondition(condition: GuardCondition, ctx: GuardContext): boolean {
  const raw = ctx[condition.field];
  const val = typeof raw === 'number' ? raw : 0;
  const strVal = String(raw ?? '');

  switch (condition.operator) {
    case 'GTE':
      return val >= (condition.value as number);
    case 'LTE':
      return val <= (condition.value as number);
    case 'GT':
      return val > (condition.value as number);
    case 'LT':
      return val < (condition.value as number);
    case 'BETWEEN': {
      const { min, max } = condition.value as { min: number; max: number };
      return val >= min && val <= max;
    }
    case 'IN':
      return (condition.value as string[]).includes(strVal);
    case 'NOT_IN':
      return !(condition.value as string[]).includes(strVal);
    default:
      return false;
  }
}

export function evaluateGuards(guards: GuardsJson | null, ctx: GuardContext): boolean {
  if (!guards || !guards.conditions || guards.conditions.length === 0) return true;

  const results = guards.conditions.map((c) => evaluateCondition(c, ctx));
  return guards.operator === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}
