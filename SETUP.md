# Enable real registrations and the admin dashboard

The pages are already built. **One shared Supabase project** is needed so students and the school admin can use them from different devices. GitHub Pages hosts the website files; Supabase handles accounts and the shared database.

Nothing has been published or connected for you. With `config.js` left empty, `index.html` remains a clearly labelled local preview, and `admin.html` offers a local preview of this browser’s records.

## 1. Create the shared database

1. Open [Supabase](https://supabase.com) and create a project owned by the school or its responsible administrator.
2. In the project’s **SQL Editor**, open a new query.
3. Copy the complete contents of `setup/database.sql` into the editor and run it.
4. Confirm that it finishes successfully. It creates the Learnst tables, access rules and functions. It does not create fake student accounts, real lessons or an admin account.

The SQL is designed to run again without deleting the existing Learnst records. It uses names beginning with `learnst_` to separate them from other app tables.

## 2. Connect the website

Find your Supabase **Project URL** and **publishable API key** in the project’s connection/API settings. A legacy **anon** key also works.

Edit `config.js`:

```js
window.LEARNST_CONFIG = {
  schoolName: "Your school name",
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseKey: "YOUR-PUBLIC-PUBLISHABLE-KEY"
};
```

These settings are public browser settings. **Do not put a `service_role` key, a `sb_secret_…` key, a database password or SMTP credentials in website files.** The publishable key is intended for browser apps; database rules and authenticated user tokens control access. See the [official API key guide](https://supabase.com/docs/guides/getting-started/api-keys).

Upload all website files and the `assets` folder to your GitHub repository, replacing the old files. `index.html`, `account.html` and `admin.html` must be at the top level. Commit the changes.

If Pages is not enabled yet, use **Settings → Pages → Deploy from a branch → main → /(root) → Save**. Wait for **Visit site**. Do not upload the ZIP itself.

Once valid configuration is present, the home page uses the shared school database. It does not silently switch to local bookings if the connection fails.

## 3. Set the email confirmation address

In Supabase **Authentication → URL Configuration**:

- Set the **Site URL** to your website’s root URL, for example `https://YOUR-USERNAME.github.io/learnst/`.
- Add the exact account-page URL to **Redirect URLs**: `https://YOUR-USERNAME.github.io/learnst/account.html`.

Use your real GitHub username and repository path. Keep the `/learnst/` part if that is your repository name.

In the email/password authentication settings:

- Enable new user registration.
- Keep **Confirm email** enabled.
- Use a password policy allowing at least 10-character passwords, matching the website form. A stricter project policy will also be enforced by Supabase.

This website uses the [browser confirmation flow](https://supabase.com/docs/guides/auth/sessions/implicit-flow). Confirmation and password-reset links return to `account.html`.

## 4. Set up email delivery before inviting students

**Supabase’s built-in test email service only sends to project-team addresses.** It is not sufficient for ordinary student registrations.

Configure a **custom SMTP provider** in Supabase Auth before inviting students. Use the school’s supported provider, or a provider such as Resend that supports SMTP. Enter its credentials only in the Supabase dashboard. Use a verified sending address/domain as required by that provider.

Official instructions and current restrictions: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

The built-in service can be used for initial testing with an email that belongs to your Supabase project team, subject to its limits. The student form shows an explanatory error if email delivery is not configured for that address.

## 5. Create the first administrator

1. Open your published `account.html` page.
2. Select **Create account**. Enter the admin’s name, use `Staff` for the class, and register with the admin’s email/password.
3. Confirm the email, then sign in.
4. In the Supabase SQL Editor, run the following query with the real admin email:

```sql
insert into public.learnst_admins (user_id)
select id
from auth.users
where lower(email) = lower('YOUR-ADMIN-EMAIL@example.com')
  and email_confirmed_at is not null
on conflict (user_id) do nothing;
```

5. Open `admin.html`, signing in with the same account if needed. It should show the dashboard.

Only the project owner or an authorised database administrator should run that query. Student signup metadata, local storage and the public website form cannot grant admin access. To grant another admin, repeat the query for that confirmed account.

To remove admin access:

```sql
delete from public.learnst_admins
where user_id in (
  select id from auth.users
  where lower(email) = lower('FORMER-ADMIN-EMAIL@example.com')
);
```

## 6. Add real lessons

In `admin.html`, select **Add a lesson**.

Choose **Science, English or Maths**, enter a title and tutor name, select a future date/hour, set the number of places, and add the location and description.

- Lessons last one hour. Enter times in **Bishkek time (UTC+6)**.
- Capacity can be from 1 to 50. Use 1 for individual help or a larger number for a group.
- The title, tutor, description and location appear on the public timetable. Share private online meeting links separately with registered students.
- Save the lesson. It appears on the student page and timetable after refresh.
- Cancelling a lesson also cancels its registrations. Students see the change in My lessons after refresh; no notification email is sent.

No lesson is automatically published by the supplied SQL.

## 7. Check a student and an admin together

Before inviting the school:

1. In another browser or private window, create a separate student account. Confirm its email and sign in.
2. Register for one of the published lessons. It should appear in **My lessons**.
3. Refresh `admin.html`. The lesson count should increase. **View list** should show that student’s name, class, email and question.
4. The student cancels their place. Refresh the admin dashboard; the active count should decrease, and the cancelled record remains available in the lesson details.
5. Check that the student account cannot open the admin data. Opening `admin.html` should show the admin-access screen.
6. Try a one-place lesson with two student accounts. Only one should obtain the place. A student cannot register for two overlapping lessons.
7. Try **Forgot password** and confirm that the reset email returns to your real `account.html` page.

These are live checks for your configured project. They have not been run against your school’s Supabase account in this workspace.

## Optional: restrict registration to school emails

After creating the admin account, edit the database’s school settings using SQL:

```sql
update public.learnst_settings
set school_name = 'Your school name',
    school_domains = array['school.example']
where singleton = true;
```

Replace `school.example` with the school’s real email domain, in lowercase and without `@`. Use multiple exact domains if needed. Subdomains are not automatically included. An empty array permits any confirmed email address.

The database enforces this restriction on signup and lesson registration. Existing admin accounts can still manage the school. The setting does not turn email/password accounts into Google or Microsoft school SSO; SSO is not implemented here.

## What the admin sees

- Registered accounts, including admins and accounts awaiting email confirmation.
- Active registrations, upcoming lessons, and distinct people with a place.
- Registration totals for Science, English and Maths.
- The count and remaining capacity for each lesson.
- Each lesson’s participant list: name, class, email, question and registration status.
- Account verification state and CSV exports.

The pages refresh about every 20 seconds while open. There is also a Refresh button.

## Access and data handling

The database checks the signed-in user and admin membership for every protected operation. Student queries return their own registrations. Public lesson listings expose lesson details and aggregate counts, not student names or emails. Direct browser table writes are blocked; registrations run through a function that checks email confirmation, capacity and overlapping times while locking the relevant records.

Passwords are submitted to Supabase Auth and are not stored in app tables or browser storage. Signed-in session tokens are kept in this tab’s session storage; sign out on shared computers. The account page includes password recovery.

Original local-preview records are retained in this browser. They are not uploaded into the shared school database automatically. For the old file-sharing workflow, see `LOCAL-PREVIEW.md`.

## Verification limits

Browser-side account/API flows, UI rendering, error handling, file paths and existing local features are tested without publishing. SQL access definitions are reviewed and checked in source. A PostgreSQL/Supabase runtime and a browser preview are unavailable in this environment, so actual SQL execution, email delivery, live access rules and visual layout must be verified using the steps above after you connect your project.
