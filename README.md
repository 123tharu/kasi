# Kasi

A personal money tracker for Sri Lanka. Every bank SMS becomes a categorised transaction, and your phone and laptop stay in sync.

- **Home**: spent today, this month vs payday, budgets, upcoming renewals, account balances, net worth
- **Timeline**: every transaction, searchable and filterable
- **Insights**: spending by category, day by day, top merchants, compared with last period
- **Grow**: fixed deposits (accrued interest, maturity), stocks, unit trusts, gold
- **Budgets, Subscriptions, Accounts, Categories & rules, Review inbox**

## How it fits together

```
Samsung ── bank SMS ──▶ MacroDroid ──HTTP──▶ Supabase (ingest_sms_raw)
                                              │  drops OTPs, stores raw SMS
                                              ▼
              Kasi web app (phone + Mac) ◀── realtime ──▶ parses SMS → transactions
```

- `supabase/schema.sql`: tables, row-level security, SMS ingest endpoint. Run once in the Supabase SQL editor.
- `src/lib/parser.ts`: the Sri Lankan bank SMS parser (`src/lib/parser.test.ts` has the tests).
- `src/data/engine.ts`: turns a parsed SMS into a transaction, account match, balance update, subscription renewal.
- `src/data/store.tsx`: loads data, live sync, processes the SMS inbox.

## Develop

```
npm install
npm run dev        # http://localhost:5173 (choose "demo data" to explore)
npx vitest run     # parser tests
npm run build
```

Pushing to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).
The app holds no secrets: the Supabase URL and public key are entered on first launch.
