# Learnst

An English-language school peer-tutoring website for **Science, English and Maths**. Find a tutor, pick a time, save a request and share the plan.

This is the lightweight version for GitHub Pages: plain HTML, CSS and JavaScript, with no packages, build commands or server to install.

## Open the website

Unzip the archive and double-click `learnst/index.html`. Keep the other files and the `assets` folder beside it. To use it easily on phones, publish the folder using GitHub Pages and open its link.

## Publish on GitHub Pages

1. Create a GitHub repository called `learnst`. Use **Public** with GitHub Free. You may enable **Add README** to create the `main` branch.
2. Select **Add file → Upload files**.
3. Upload the **contents** of the extracted `learnst` folder, including the `assets` folder. Upload the website files, rather than the ZIP itself.
4. Select **Commit changes**. Check that `index.html` is visible at the top level of the repository.
5. Open **Settings → Pages**. Under **Build and deployment → Source**, select **Deploy from a branch**.
6. Choose **main**, **/(root)** and **Save**.
7. Wait for **Visit site**. The first update may take up to 10 minutes. Use that link on desktop or mobile.

There are no build settings to enter. All asset paths are relative, so the website also works under a project address ending in `/learnst/`.

Official instructions: [create a GitHub Pages site](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site) and [choose a publishing source](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site).

## Use the timetable

Open **Timetable** in the main navigation.

- **Open times** shows available hours, colour coded by Science, English and Maths. Filter by subject, tutor or lesson format. Select an hour to create a request.
- **My lessons** shows pending and confirmed requests saved in this browser. Select a lesson to read its details or download its request/reply file.
- Week arrows move backwards and forwards. **This week** returns to the current week. When opening the timetable for the first time, it shows the first week with an available hour, so an empty weekend does not hide the upcoming times.
- A desktop shows weekdays across the top and hours down the side. Smaller screens show readable day cards instead.
- Every lesson lasts one hour. All times use **Bishkek time (UTC+6)**.

Profiles marked **Sample** and their times are examples for exploring the website.

## Try a complete request

1. On the home page, select **Choose a time** on Alina’s sample Maths profile.
2. Enter your name and class, choose a date/hour and describe your question.
3. Select **Save request**. Your request appears in **My lessons**, with a **Pending** status, and in the timetable’s **My lessons** view.
4. Select **Download request** and send the JSON file to the tutor using your preferred messenger or email.
5. On their own device, the tutor opens this website, selects **Share a request → Import a request or reply**, chooses the file and selects **Apply this file**.
6. The tutor opens **Tutor workspace** (or **Tutor** in the mobile navigation), chooses the relevant name, confirms the request and adds a message.
7. The tutor selects **Download reply** and sends the updated file to the student.
8. The student imports the reply using **Share a request**. The status, message and timetable update in their browser.

To explore the process on one device, go straight from My lessons to Alina’s workspace. Importing an identical file again does not create duplicates.

## Add your own tutor profile

1. Select **I would like to help** on the home page, or **My tutor profile** in the workspace.
2. Add your name, class, introduction, languages and subjects. Only Science, English and Maths are offered.
3. Open **My availability → Add a time** and choose an hour, format and meeting place.
4. Use **Share a request → Download all data** to share your profile and timetable. Students import this file into their own browser before choosing your times.

A profile created using the form appears in this browser and in the files you share. To give every new visitor the same default tutors, edit `sampleTutors()` in `data.js` and upload that changed file to GitHub. Built-in sample profiles receive example availability for the next two weeks. Use the availability form and file sharing for actual meeting times.

## What is saved

- Profiles, hours, requests and replies are saved in this browser’s `localStorage`, if permitted. A warning appears if storage is unavailable; you can still download the temporary data before closing the page.
- Another browser or device has a separate list. Opening the local file and opening a published GitHub Pages address also use separate storage.
- **This version has local profiles, rather than verified school accounts.** Anyone using the same browser can view and change its records. Choosing a tutor name in the workspace is not authentication.
- **Requests do not sync or send automatically.** Download a file, send it to the other participant, and import their reply.
- An individual request export contains that lesson and its supporting tutor profile/hour. A full export contains all tutor profiles, hours and requests in this browser. Names, questions and replies are included. Upload the website files to GitHub; share request files with the relevant participant.
- Newer versions update existing records. Repeated imports do not duplicate them. If two active bookings conflict, the import is rejected without applying changes. Agree on a time, cancel one request and share an updated file.
- Clearing browser data deletes local records. Download a backup first using **Download all data**. You can import it later; enter your name/class again for new requests.

## Updating the earlier version

Replace the website files in your GitHub repository with these updated files. The storage key is retained, so existing requests can be read without resetting your browser.

Untouched sample profiles are updated to English. Older subject IDs are grouped into the new three-subject list when importing or reading saved data: Physics/Chemistry/Programming under Science, writing/language subjects under English, and numerical subjects under Maths. Existing requests retain an **Originally booked for…** note so their original topic is still clear. Student-written names, messages and custom profile text are preserved as entered; they are not automatically translated.

## Edit the website

| File | Contents |
| --- | --- |
| `index.html` | Navigation, browser title and “Adil’s site” footer |
| `styles.css` | Colours, layout, weekly grid and phone agenda |
| `data.js` | School name, three subjects, sample tutors, local storage and file transfers |
| `app.js` | English pages, timetable, forms and buttons |
| `assets/hero.svg` | Illustration of students learning together |
| `assets/favicon.svg` | Learnst icon |
| `START.txt` | Quick start instructions |

The full server version from the earlier archive remains a separate project. This archive contains only the lightweight GitHub Pages version. It has not been published for you.

## Verification

JavaScript/CSS syntax, booking flows, file transfers, conflict handling, older-data compatibility and timetable rendering are checked locally. Asset paths work under a GitHub project subfolder, and there are no external JavaScript libraries or fonts. Visual verification in a real browser is unavailable in this environment.
