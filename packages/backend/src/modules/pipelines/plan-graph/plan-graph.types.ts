/** Internal types used only within the Plan Graph — not exported to shared */

export type GranularityViolation = {
  taskId: string;
  reason: string;
};

export type EvaluationResult = {
  pass: boolean;
  violations: GranularityViolation[];
};
