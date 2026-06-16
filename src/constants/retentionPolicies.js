export const RETENTION_POLICIES = [
  { id: '5y', label: '5 years', years: 5 },
  { id: '7y', label: '7 years', years: 7 },
]

export function getRetentionPolicyLabel(policyId) {
  return RETENTION_POLICIES.find((policy) => policy.id === policyId)?.label ?? ''
}
