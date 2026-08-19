export type TuiAccountSummary = {
  authenticated: boolean
  email?: string
  plan?: string
  periodEnd?: string
  requestsUsed?: number
  requestsRemaining?: number
  tokensUsed?: number
  tokensRemaining?: number
  includedCreditUsed?: number
  includedCreditRemaining?: number
  topupCredit?: number
  sessions?: number
  learnerLevel?: string
}

export type TuiAccountAdapter = {
  summary: () => Promise<TuiAccountSummary>
  open: (action?: "account" | "upgrade" | "topup" | "billing") => Promise<void>
}
