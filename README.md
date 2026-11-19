# Family Finance

Private family income and expense tracker. Built for the existing Supabase project `Delyreachson`.

## 1. Configure Supabase

1. Open Supabase project `Delyreachson`.
2. Go to **Project Settings → API Keys** (or the API settings page).
3. Copy the **publishable key** (`sb_publishable_...`). The legacy `anon` key is also suitable when that is what the dashboard provides.
4. Open `app.js` in a text editor and replace `PASTE_YOUR_SUPABASE_PUBLISHABLE_KEY_HERE` with that key.
5. Save the file. Do not put a `service_role` or secret key in this website, GitHub, or browser code.

The project URL is already set in `app.js` to `https://ludrupofaaeqmqzvhvox.supabase.co`.

## 2. Run locally

You can open `index.html` in a browser for a quick check. For a more reliable local preview, use VS Code with the Live Server extension.

## 3. Deploy to GitHub Pages

1. Create a private GitHub repository and upload `index.html`, `styles.css`, and `app.js` to its root.
2. In repository **Settings → Pages**, select **Deploy from a branch**, choose `main` and `/(root)`, then Save.
3. Wait for GitHub Pages to publish the site.

Important: GitHub Pages serves a public website even when the repository is private on some plans/configurations. Keep family data protected by Supabase Auth and RLS; do not put passwords or secret keys in the code.

## Database compatibility

This frontend uses the existing `public.transactions` columns: `transaction_type`, `amount`, `currency`, `category`, `description`, and `transaction_date`. It does not create or alter database tables. Existing RLS policies must remain enabled and allow authenticated family account access.


## Savings Goals feature

The Savings Goals page reuses the existing `public.savings_goals` table. Before using contributions, apply the SQL migration in `supabase/migrations/20261116000100_savings_goal_contributions.sql` from the Supabase SQL Editor. The migration creates the contribution history table, enables family-owner RLS, grants the authenticated family account the required Data API permissions, and adds the secure `add_savings_goal_contribution` RPC. Do not use a service-role or secret key in the browser.


## Database safety and maintenance

- The live database is the source of truth. The current application uses the existing `public.transactions`, `public.categories`, `public.savings_goals`, `public.savings_goal_contributions`, `public.family_members`, and `public.app_settings` tables.
- All six live public tables have Row Level Security enabled. Their current policies are restricted to the configured Family Owner account. Keep these policies in place; do not add permissive policies such as `USING (true)` or `WITH CHECK (true)` for the `authenticated` role.
- `supabase/schema.sql` and `supabase/categories.sql` are deprecated historical bootstrap files. They do not match the live schema. **Do not run them** in the Supabase SQL Editor; they are now marked as non-executable notices to prevent accidental reuse.
- `supabase/migrations/20261118000100_add_foreign_key_indexes.sql` adds indexes to the four foreign-key columns verified against the live schema. It does not alter or remove family records. This file is a proposed migration only; merging this PR does not execute it against Supabase. Apply it separately in Supabase only after reviewing and approving the migration.
- Never run a repository SQL file against the live project unless its purpose and effects have been reviewed. Never expose a Supabase service-role or secret key in browser code.


## Password-protected backups

The Backup & Restore page can optionally encrypt exported family-data JSON files in the browser using AES-256-GCM with a PBKDF2-SHA-256 derived key. Use a password of at least 8 characters and keep it separately; encrypted files cannot be restored without the same password. Leaving both password fields blank creates the existing unencrypted JSON format. Older unencrypted Family Finance backups remain supported. This browser backup includes the six application tables listed in `app.js`; it does not include Supabase Auth accounts, project configuration, or Storage objects, and is not a substitute for a full database backup.
