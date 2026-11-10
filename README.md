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
