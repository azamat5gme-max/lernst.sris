# Learnst — student registration and school admin

An English-language school tutoring website for **Science, English and Maths**, with a weekly timetable and a separate admin dashboard.

## The three pages

| Page | Purpose |
| --- | --- |
| `index.html` | Student website: browse lessons, see the timetable and register for a place |
| `account.html` | Create an account, confirm email, sign in, edit name/class and recover a password |
| `admin.html` | Protected school dashboard: registration counts, lesson lists, student details, CSV export and lesson publishing |

The pages are plain HTML, CSS and JavaScript. GitHub Pages can host them without installing Node.js or running a build.

## Real registrations need the shared database

**Follow [SETUP.md](./SETUP.md)** to create a Supabase project, run `setup/database.sql`, configure email delivery, add the public connection settings to `config.js`, and grant the first admin account access.

Once configured, students can register from their own devices and the admin sees their registrations in the shared dashboard. The database controls permissions, seat limits and overlapping bookings. Student names and emails are not exposed in public timetable listings.

No Supabase project, email sender, account or hosted website has been created for you. The connection values are deliberately empty.

## Preview immediately

Unzip the folder and double-click `index.html`. With `config.js` empty, the earlier local preview still works. Open `admin.html` and select **View local preview** to inspect this browser’s existing requests and counts. This preview does not create verified accounts or synchronise devices.

The account page explains the remaining setup. The old preview workflow is documented in [LOCAL-PREVIEW.md](./LOCAL-PREVIEW.md).

## Publish the files yourself

1. Upload the contents of the extracted `learnst` folder, including `assets`, to the top level of your GitHub repository. Upload files, rather than the ZIP.
2. Enable **Settings → Pages → Deploy from a branch → main → /(root) → Save** if not already enabled.
3. Wait for **Visit site**.
4. Use `.../account.html` for accounts and `.../admin.html` for the separate admin page.
5. Complete `SETUP.md` before collecting real student registrations.

All asset paths are relative, including under a project URL ending in `/learnst/`. The site has not been published for you.

## Main files

- `config.js`: school name and public database connection settings.
- `cloud.js`: account/session API client and shared UI helpers.
- `student.js`: shared student lesson registration and timetable.
- `account.js`: signup, sign-in, profile and password-reset forms.
- `admin.js`: admin counts, participants, lessons and CSV exports.
- `styles.css`, `shared.css`: responsive page and dashboard design.
- `setup/database.sql`: database schema, checked functions and access rules.
- `data.js`, `app.js`: existing local-preview logic, retained for offline review.

Never put secret/service-role keys, database passwords or email credentials in website files. Use only the public publishable/anon key in `config.js`.

## Verification

The client code and local flows are checked without sending emails or deploying. A live Supabase project and browser preview are not connected in this environment. `SETUP.md` includes the real account, admin-access and capacity checks to run after connecting the school’s project.
