export type Direction = 'debit' | 'credit'
export type AccountType = 'bank' | 'credit' | 'cash' | 'wallet'
export type CategoryKind = 'expense' | 'income' | 'transfer'
export type InvestmentType = 'fd' | 'stock' | 'unit_trust' | 'gold' | 'other'
export type SmsStatus = 'new' | 'parsed' | 'ignored' | 'failed' | 'dismissed'

export interface Settings {
  user_id: string
  display_name: string | null
  payday_day: number
  currency: string
  ingest_token: string
}

export interface Account {
  id: string
  name: string
  bank: string | null
  last4: string | null
  type: AccountType
  balance: number | null
  balance_at: string | null
  credit_limit: number | null
  color: string | null
  archived: boolean
}

export interface Category {
  id: string
  name: string
  icon: string
  color: string
  kind: CategoryKind
  sort: number
  archived: boolean
}

export interface Transaction {
  id: string
  account_id: string | null
  category_id: string | null
  amount: number
  direction: Direction
  occurred_at: string
  merchant: string | null
  note: string | null
  source: 'sms' | 'manual'
  raw_sms_id: string | null
  needs_review: boolean
  currency: string
}

export interface Rule {
  id: string
  pattern: string
  category_id: string
  rename_to: string | null
}

export interface RawSms {
  id: string
  sender: string | null
  body: string
  received_at: string
  status: SmsStatus
  note: string | null
}

export interface Budget {
  id: string
  name: string
  amount: number
  category_ids: string[]
  period: 'cycle' | 'week' | 'year'
  active: boolean
}

export interface Subscription {
  id: string
  name: string
  amount: number
  currency: string
  cycle: 'weekly' | 'monthly' | 'yearly'
  next_date: string // yyyy-mm-dd
  icon: string
  match: string | null
  category_id: string | null
  active: boolean
}

export interface Investment {
  id: string
  type: InvestmentType
  name: string
  institution: string | null
  units: number | null
  cost: number
  price: number | null
  price_at: string | null
  rate: number | null
  start_date: string | null
  maturity_date: string | null
  notes: string | null
  closed: boolean
}

export interface DB {
  settings: Settings | null
  accounts: Account[]
  categories: Category[]
  transactions: Transaction[]
  rules: Rule[]
  raw_sms: RawSms[]
  budgets: Budget[]
  subscriptions: Subscription[]
  investments: Investment[]
}

export type TableName = Exclude<keyof DB, 'settings'>
export type Row<T extends TableName> = DB[T][number]
