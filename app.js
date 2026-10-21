(function () {
  "use strict";
  const D = window.LearnstData;
  if (!D) return;
  if (window.LearnstCloud && window.LearnstCloud.configured && window.LearnstStudent) {
    window.LearnstStudent.start();
    return;
  }
  let storage;
  try { storage = window.localStorage; } catch (error) { storage = null; }
  const store = new D.Store(storage);
  const app = document.getElementById("app");
  const modal = document.getElementById("modal");
  const modalBody = document.getElementById("modal-body");
  const toast = document.getElementById("toast");
  const e = value => String(value == null ? "" : value).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const subject = id => D.subject(id) || D.SUBJECTS[0];
  const filters = { subject: "all", query: "", mode: "all", tutor: "all", lessons: "active", workspace: "requests", timetable: "open" };
  let weekOffset = initialWeekOffset(), booking = null, incoming = null, toastTimer;
  const PATHS = {
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>', up: '<path d="M6 18 18 6M6 6h12v12"/>',
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 11h18m-13 5h2m4 0h2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    book: '<path d="M12 5v15M3 4c4-1 6 0 9 1 3-1 5-2 9-1v15c-4-1-6 0-9 1-3-1-5-2-9-1Z"/>',
    heart: '<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1-3 3-1 7 1 9l7 7 7-7c2-2 4-6 1-9Z"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/>',
    inbox: '<path d="M5 4h14l3 11v5H2v-5Zm-3 11h6l2 3h4l2-3h6"/>',
    pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
    video: '<rect x="2" y="5" width="14" height="14" rx="3"/><path d="m16 9 6-3v12l-6-3"/>',
    check: '<path d="m5 12 4 4L19 6"/>', plus: '<path d="M12 5v14M5 12h14"/>',
    download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>', upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
    spark: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/>'
  };
  const icon = name => '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || PATHS.book) + "</svg>";
  const initials = name => e(name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join(""));
  const avatar = tutor => '<span class="avatar ' + e(tutor.color) + '" aria-hidden="true">' + initials(tutor.name) + "</span>";
  const tag = id => '<span class="tag ' + e(subject(id).color) + '"><span aria-hidden="true">' + e(subject(id).symbol) + "</span>" + e(subject(id).name) + "</span>";
  const option = (value, label, selected) => '<option value="' + e(value) + '"' + (value === selected ? " selected" : "") + ">" + e(label) + "</option>";
  const actionButton = (action, label, classes, id, extra) => '<button type="button" class="button ' + (classes || "outline") + '" data-action="' + e(action) + '"' + (id ? ' data-id="' + e(id) + '"' : "") + (extra || "") + ">" + label + "</button>";
  const heading = (eyebrow, title, description, action) => '<div class="page-heading"><div><span class="eyebrow">' + e(eyebrow) + "</span><h1>" + e(title) + "</h1><p>" + e(description) + "</p></div>" + (action || "") + "</div>";
  const formError = '<p class="form-error" data-form-error role="alert" hidden></p>';
  function empty(title, text, button) {
    return '<div class="empty"><i>' + icon("book") + "</i><h3>" + e(title) + "</h3><p>" + e(text) + "</p>" + (button || "") + "</div>";
  }
  function notice() {
    const warning = document.getElementById("storage-warning");
    warning.hidden = store.persistent;
    if (!store.persistent) warning.textContent = store.warning || "Changes last until you close this page. Download them using “Share a request”.";
  }
  function notify(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    if (modal.open) {
      let feedback = document.getElementById("modal-feedback");
      if (!feedback) { feedback = document.createElement("p"); feedback.id = "modal-feedback"; feedback.className = "notice"; feedback.setAttribute("role", "status"); modalBody.appendChild(feedback); }
      feedback.textContent = message;
    }
    toastTimer = setTimeout(() => { toast.hidden = true; }, 6500);
    notice();
  }
  function route() {
    const name = location.hash.slice(1);
    return ["find", "schedule", "lessons", "workspace"].includes(name) ? name : "find";
  }
  function go(name) {
    closeModal();
    if (location.hash === "#" + name) render(); else location.hash = name;
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function openModal(html) {
    modalBody.innerHTML = html;
    if (!modal.open) modal.showModal();
  }
  function closeModal() {
    if (modal.open) modal.close();
    booking = null;
    incoming = null;
  }
  function render() {
    const name = route();
    const titles = { find: "Learn together", schedule: "Timetable", lessons: "My lessons", workspace: "Tutor workspace" };
    document.title = "Learnst — " + titles[name];
    document.querySelectorAll("[data-route]").forEach(link => {
      if (link.dataset.route === name) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
    });
    document.getElementById("profile-button").textContent = store.state.profile.name ? store.state.profile.name.split(" ")[0] : "My profile";
    app.innerHTML = name === "find" ? findPage() : name === "schedule" ? schedulePage() : name === "lessons" ? lessonsPage() : workspacePage();
    if (name === "find") renderTutorResults();
    notice();
  }
  function findPage() {
    return '<section class="hero"><div class="hero-copy"><span class="eyebrow"><i></i>' + e(D.SETTINGS.school) + ' · your people</span><h1>A little help.<br>A lot more<br><span>confidence.</span></h1><p>Stuck on something? Learn with someone who gets it. Find your subject, meet a peer tutor and turn “I can’t” into “I’ve got this.”</p><div class="hero-buttons">' + actionButton("find-section", "Find a tutor " + icon("up"), "purple") + actionButton("join-tutor", "I would like to help " + icon("arrow"), "text") + '</div><div class="hero-footnote"><span class="mini-avatars" aria-hidden="true"><i>A</i><i>M</i><i>D</i></span><span>One good question can change everything.<br><strong>A community that learns together.</strong></span></div></div><div class="hero-art"><div class="art-grid"></div><span class="art-star" aria-hidden="true">✳</span><div class="art-float">' + icon("spark") + ' Aha! I get it.</div><img src="./assets/hero.svg" width="470" height="330" alt="Two students learning together at a desk"><div class="art-session"><i>' + icon("calendar") + '</i><div><small>YOUR NEXT LIGHTBULB MOMENT</small><strong>“See you at four?”</strong><span>A subject. A friendly face. A plan.</span></div><b aria-hidden="true">✓</b></div><span class="art-note">better, together. ↗</span></div></section>' +
      '<section class="section" id="find-tutors"><div class="section-heading"><div><span class="eyebrow">FIND YOUR “AHA!” PERSON</span><h2>What are we figuring out?</h2><p>No question is too small. Start with a subject.</p></div><span class="section-note">' + icon("heart") + ' Made for learning together</span></div><div class="chips" aria-label="Subjects">' +
      [{ id: "all", name: "All subjects", symbol: "✳" }, ...D.SUBJECTS].map(item => '<button type="button" class="chip" data-action="subject" data-id="' + e(item.id) + '" aria-pressed="' + (filters.subject === item.id) + '"><span aria-hidden="true">' + e(item.symbol) + "</span>" + e(item.name) + "</button>").join("") +
      '</div><div class="toolbar"><p id="result-count" role="status"></p><div class="search-controls"><label class="searchbox">' + icon("search") + '<input id="search" type="search" placeholder="Name, subject or language" aria-label="Search tutors" value="' + e(filters.query) + '"></label><select class="select" id="find-mode" aria-label="Lesson format">' + option("all", "Any format", filters.mode) + option("campus", "On campus", filters.mode) + option("online", "Online", filters.mode) + '</select></div></div><div id="tutor-results"></div><p class="help" style="margin-top:17px">Profiles marked “Sample” and their times help you explore the site. Real tutors can create a local profile in the workspace.</p></section>' +
      '<section class="how"><div class="section-heading"><div><span class="eyebrow">SMALL STEPS. BIG DIFFERENCE.</span><h2>Less overthinking. More understanding.</h2></div></div><div class="how-grid">' + [
        ["01", "search", "Find your person", "Pick your subject, read a tutor profile and find an open hour."],
        ["02", "calendar", "Make a little time", "Choose an open hour and tell your tutor what you want to work on."],
        ["03", "spark", "Share the request", "Download a request file and send it to your tutor. Import their reply back into Learnst."]
      ].map(item => '<article class="how-card"><div><span>' + item[0] + "</span>" + icon(item[1]) + "</div><h3>" + item[2] + "</h3><p>" + item[3] + "</p></article>").join("") + '</div></section>' +
      '<section class="join-banner"><div><span class="eyebrow">GOT A SUBJECT YOU LOVE?</span><h2>Be someone’s<br><em>“now I get it.”</em></h2><p>Share what you know. Lend a little confidence.</p></div>' + actionButton("join-tutor", "Become a peer tutor " + icon("up"), "lime") + '<span class="banner-flower" aria-hidden="true">✳</span></section>' +
      '<section class="faq"><h2>A few<br>good questions.</h2><div><details><summary>Do I need to install anything?</summary><p>Open the website link or the index.html file from the folder. Everything runs in your browser.</p></details><details><summary>Will my tutor receive the request automatically?</summary><p>This version saves the request on your device. Click “Download request” and send the JSON-file to your tutor. They can import it using “Share a request” and send you a reply file.</p></details><details><summary>Is this school-account sign-in?</summary><p>This version uses a local name and class profile. It does not verify school emails or provide secure accounts. Anyone using this browser can view its saved records.</p></details><details><summary>Where does my data go?</summary><p>Requests, profiles and times are saved in this browser. Nothing is sent automatically. Clearing browser data removes them, so download a backup using “My data”.</p></details></div></section>';
  }
  function renderTutorResults() {
    const allSlots = store.available();
    const query = filters.query.trim().toLocaleLowerCase("en-GB");
    const tutors = store.state.tutors.filter(tutor => (filters.subject === "all" || tutor.subjects.includes(filters.subject)) && (!query || [tutor.name, tutor.bio, tutor.languages, ...tutor.subjects.map(item => subject(item).name)].join(" ").toLocaleLowerCase("en-GB").includes(query)) && (filters.mode === "all" || allSlots.some(slot => slot.tutorId === tutor.id && slot.mode === filters.mode)));
    document.getElementById("result-count").innerHTML = "Tutors to learn with: <strong>" + tutors.length + "</strong>";
    document.getElementById("tutor-results").innerHTML = tutors.length ? '<div class="tutor-grid">' + tutors.map(tutor => {
      const slots = allSlots.filter(slot => slot.tutorId === tutor.id && (filters.mode === "all" || slot.mode === filters.mode));
      return '<article class="tutor-card"><div class="tutor-top">' + avatar(tutor) + '<span class="sample-badge">' + (tutor.sample ? "Sample" : "Local profile") + '</span></div><h3>' + e(tutor.name) + '</h3><span class="year">' + e(tutor.year) + '</span><p class="tutor-bio">' + e(tutor.bio) + '</p><div class="tags">' + tutor.subjects.map(tag).join("") + '</div><p class="language">' + icon("message") + e(tutor.languages) + '</p><div class="tutor-bottom"><span class="availability">' + (slots.length ? '<i class="availability-dot"></i>' + e(D.shortDate(slots[0].date, false)) + " · " + e(slots[0].start) : "No open hours yet") + '</span><button type="button" class="book-link" data-action="book" data-id="' + e(tutor.id) + '"' + (!slots.length ? " disabled" : "") + ">Choose a time " + icon("up") + "</button></div></article>";
    }).join("") + "</div>" : empty("No matches just yet.", "Try a different subject, name or lesson format.", actionButton("clear-filters", "Clear filters", "outline"));
  }
  function startOfWeek() {
    const day = new Date(D.today() + "T12:00:00Z").getUTCDay();
    return D.addDays(D.today(), -((day + 6) % 7) + weekOffset * 7);
  }
  function initialWeekOffset() {
    const first = store.available()[0];
    if (!first) return 0;
    const weekday = new Date(D.today() + "T12:00:00Z").getUTCDay();
    const monday = D.addDays(D.today(), -((weekday + 6) % 7));
    return Math.min(16, Math.max(0, Math.floor((Date.parse(first.date + "T12:00:00Z") - Date.parse(monday + "T12:00:00Z")) / 604800000)));
  }
  function timetableRecords() {
    const items = filters.timetable === "mine" ? store.state.lessons.filter(D.active) : store.available();
    return items.filter(item => (filters.subject === "all" || (item.status ? item.subject === filters.subject : store.state.tutors.find(tutor => tutor.id === item.tutorId).subjects.includes(filters.subject))) && (filters.mode === "all" || item.mode === filters.mode) && (filters.tutor === "all" || item.tutorId === filters.tutor));
  }
  function slotButton(slot) {
    const tutor = store.state.tutors.find(item => item.id === slot.tutorId);
    const selectedSubject = filters.subject === "all" ? tutor.subjects[0] : filters.subject;
    return `<button type="button" class="slot timetable-event ${e(subject(selectedSubject).color)}" data-action="book-slot" data-id="${e(slot.id)}" aria-label="${e(subject(selectedSubject).name + ', ' + tutor.name + ', ' + D.shortDate(slot.date) + ', ' + slot.start)}"><strong>${e(subject(selectedSubject).name)}</strong><span>${e(slot.start)}–${e(slot.end)}</span><span>${e(tutor.name)} · ${slot.mode === "online" ? "Online" : "On campus"}</span></button>`;
  }
  function timetableLesson(lesson) {
    return `<button type="button" class="slot timetable-event ${e(subject(lesson.subject).color)} ${lesson.status === "pending" ? "event-pending" : ""}" data-action="lesson-details" data-id="${e(lesson.id)}" aria-label="${e(subject(lesson.subject).name + ', ' + lesson.tutorName + ', ' + D.shortDate(lesson.date) + ', ' + lesson.start + ', ' + D.STATUSES[lesson.status])}"><strong>${e(subject(lesson.subject).name)}</strong><span>${e(lesson.start)}–${e(lesson.end)}</span><span>${e(lesson.tutorName)}</span><span class="event-status">${lesson.status === "confirmed" ? "✓ Confirmed" : "◷ Pending"}</span></button>`;
  }
  function schedulePage() {
    const first = startOfWeek();
    const dates = Array.from({ length: 7 }, (_, index) => D.addDays(first, index));
    const records = timetableRecords().filter(item => item.date >= first && item.date <= dates[6]);
    const renderEvent = filters.timetable === "mine" ? timetableLesson : slotButton;
    const recordedHours = records.map(item => Number(item.start.slice(0, 2)));
    const firstHour = Math.min(14, ...recordedHours), lastHour = Math.max(18, ...recordedHours);
    const hours = Array.from({ length: lastHour - firstHour + 1 }, (_, index) => String(firstHour + index).padStart(2, "0") + ":00");
    const dayName = (date, style) => new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: style || "short" }).format(new Date(date + "T12:00:00Z"));
    const head = dates.map(date => `<th scope="col" class="${date === D.today() ? "is-today" : ""}"><span>${e(dayName(date))}</span><b>${Number(date.slice(-2))}</b><small>${e(new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" }).format(new Date(date + "T12:00:00Z")))}</small></th>`).join("");
    const rows = hours.map(hour => `<tr><th scope="row" class="time-axis"><time datetime="${hour}">${hour}</time></th>${dates.map(date => { const items = records.filter(item => item.date === date && item.start === hour); return `<td class="${date === D.today() ? "today-cell" : ""}">${items.length ? items.slice(0, 2).map(renderEvent).join("") + (items.length > 2 ? `<button type="button" class="timetable-more" data-action="day" data-id="${date}" data-hour="${hour}">+${items.length - 2} more</button>` : "") : '<span class="empty-cell" aria-hidden="true">·</span>'}</td>`; }).join("")}</tr>`).join("");
    const agenda = dates.map(date => { const items = records.filter(item => item.date === date).sort((a, b) => a.start.localeCompare(b.start)); return `<section class="agenda-day"><h2>${e(dayName(date, "long"))}<span>${e(D.shortDate(date, false))}</span></h2>${items.length ? items.slice(0, 4).map(renderEvent).join("") + (items.length > 4 ? `<button type="button" class="timetable-more" data-action="day" data-id="${date}">View all ${items.length} times ↗</button>` : "") : `<p class="no-slots">${filters.timetable === "mine" ? "No lessons planned" : "No open hours"}</p>`}</section>`; }).join("");
    return heading("A LITTLE TIME. A LITTLE PROGRESS.", "Your timetable.", "Science, English and Maths. One clear plan for your week.") +
      `<section class="page-content"><div class="timetable-top"><div class="tab-row" aria-label="Timetable view"><button type="button" data-action="timetable-view" data-id="open" aria-pressed="${filters.timetable === "open"}">${icon("calendar")} Open times</button><button type="button" data-action="timetable-view" data-id="mine" aria-pressed="${filters.timetable === "mine"}">${icon("book")} My lessons</button></div><div class="subject-legend">${D.SUBJECTS.map(item => `<span><i class="${e(item.color)}"></i>${e(item.name)}</span>`).join("")}</div></div>` +
      `<div class="timetable-filters"><label>Subject<select class="select" id="schedule-subject">${option("all", "All subjects", filters.subject) + D.SUBJECTS.map(item => option(item.id, item.name, filters.subject)).join("")}</select></label><label>Tutor<select class="select" id="schedule-tutor">${option("all", "All tutors", filters.tutor) + store.state.tutors.map(item => option(item.id, item.name, filters.tutor)).join("")}</select></label><label>Format<select class="select" id="schedule-mode">${option("all", "Any format", filters.mode) + option("campus", "On campus", filters.mode) + option("online", "Online", filters.mode)}</select></label></div>` +
      `<div class="timetable-shell"><div class="calendar-toolbar"><div><button type="button" class="icon-button" data-action="week-prev" aria-label="Previous week"${weekOffset <= -16 ? " disabled" : ""}>‹</button><button type="button" class="icon-button" data-action="week-next" aria-label="Next week"${weekOffset >= 16 ? " disabled" : ""}>›</button><h2>${e(D.shortDate(first, false))} — ${e(D.shortDate(dates[6], false))}</h2></div><div><button type="button" class="button outline small" data-action="week-today">This week</button><span class="timezone">Bishkek · UTC+6</span></div></div><div class="timetable-summary" role="status"><strong>${records.length}</strong> ${filters.timetable === "mine" ? "saved lessons" : "open hours"} this week · ${filters.timetable === "mine" ? "Select a lesson to see its details." : "Select an open time to request a lesson."}</div><table class="timetable-grid"><caption class="sr-only">Weekly ${filters.timetable === "mine" ? "lesson" : "availability"} timetable, ${e(D.shortDate(first))} to ${e(D.shortDate(dates[6]))}, Bishkek time</caption><thead><tr><th scope="col" class="time-axis">Time</th>${head}</tr></thead><tbody>${rows}</tbody></table><div class="timetable-agenda">${agenda}</div></div>` +
      `<p class="help timetable-note">${filters.timetable === "mine" ? "Pending requests reserve the hour on this device. Your tutor confirms after receiving your request file. Import their reply to update the timetable." : "All lessons last one hour. Sample profiles show example availability. Import a real tutor’s file to see their hours."} Changes stay in this browser; share files to update another device.</p></section>`;
  }
  function lessonsPage() {
    const lessons = store.state.lessons.filter(lesson => filters.lessons === "all" || (filters.lessons === "active" ? D.active(lesson) : !D.active(lesson))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    return heading("YOUR LITTLE LEARNING PLAN", "My lessons.", "Who you are meeting, what you are working on and when. All in one place.", actionButton("transfer", icon("upload") + " Import a reply", "outline")) + '<section class="page-content"><p class="notice"><strong>Requests stay on this device.</strong> Click “Download request” to share it with your tutor. Import their reply using the button above. This list includes every request created or imported in this browser.</p><div class="tab-row" aria-label="Filter lessons">' + [["active", "Active"], ["history", "History"], ["all", "All"]].map(item => '<button type="button" data-action="lesson-filter" data-id="' + item[0] + '" aria-pressed="' + (filters.lessons === item[0]) + '">' + item[1] + "</button>").join("") + '</div><div class="lesson-list">' + (lessons.length ? lessons.map(lesson => lessonCard(lesson, false)).join("") : empty("Your next step is one good question.", "Choose a subject and a tutor to plan your first lesson.", '<a href="#find" class="button purple">Find a tutor ' + icon("arrow") + "</a>")) + "</div></section>";
  }
  function lessonCard(lesson, teaching) {
    const date = new Date(lesson.date + "T12:00:00Z");
    const month = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", month: "short" }).format(date);
    const day = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" }).format(date);
    let actions = "";
    if (teaching && lesson.status === "pending") actions += actionButton("status", icon("check") + " Confirm", "purple", lesson.id, ' data-status="confirmed"') + actionButton("status", "Decline", "outline", lesson.id, ' data-status="declined"');
    if (D.active(lesson)) actions += actionButton("status", "Cancel", "outline", lesson.id, ' data-status="cancelled"');
    if (teaching && lesson.status === "confirmed" && lesson.date + "T" + lesson.end <= D.schoolNow()) actions += actionButton("status", "Complete", "outline", lesson.id, ' data-status="completed"');
    actions += actionButton("export-lesson", icon("download") + (lesson.status === "pending" ? " Download request" : " Download reply"), "outline", lesson.id);
    return '<article class="lesson-card"><div class="date-badge"><span>' + e(month) + "</span><strong>" + date.getUTCDate() + "</strong><span>" + e(day) + '</span></div><div class="lesson-detail"><div class="lesson-title"><h3>' + e(subject(lesson.subject).name) + '</h3><span class="status ' + e(lesson.status) + '">' + e(D.STATUSES[lesson.status]) + '</span></div><p class="lesson-person">' + e(lesson.studentName) + " · " + e(lesson.studentYear) + " → " + e(lesson.tutorName) + '</p><div class="lesson-meta"><span>' + icon("clock") + e(lesson.start) + "–" + e(lesson.end) + '</span><span>' + icon(lesson.mode === "online" ? "video" : "pin") + e(lesson.location) + '</span></div>' + (lesson.previousSubject ? '<p class="help">Originally booked for ' + e(lesson.previousSubject) + ' in the earlier version.</p>' : '') + (lesson.note ? '<div class="lesson-note"><strong>What we are working on</strong>' + e(lesson.note) + "</div>" : "") + (lesson.response ? '<div class="lesson-note"><strong>Reply</strong>' + e(lesson.response) + "</div>" : "") + '<div class="lesson-actions">' + actions + "</div></div></article>";
  }
  function workspacePage() {
    const tutor = store.state.tutors.find(item => item.id === store.state.workspaceTutorId) || store.state.tutors[0];
    const lessons = store.state.lessons.filter(item => item.tutorId === tutor.id).sort((a, b) => b.createdAt - a.createdAt);
    const ownSlots = store.state.slots.filter(item => item.tutorId === tutor.id && !item.archived && D.future(item)).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    return heading("THE OTHER SIDE OF AN “AHA!”", "Hey there. Let’s help.", "Import a request, read the question and make a plan together.", actionButton("join-tutor", icon("plus") + " My tutor profile", "purple")) + '<section class="page-content"><p class="notice">This is a local workspace. Choosing a name opens data on this device; it does not sign in to a secure account. ' + (tutor.sample ? "You are exploring a sample profile." : "To receive a request from another device, import the student’s file.") + '</p><div class="workspace-intro"><label for="workspace-tutor">Tutor<select class="select" id="workspace-tutor">' + store.state.tutors.map(item => option(item.id, item.name + (item.sample ? " · sample" : ""), tutor.id)).join("") + '</select></label><div>' + actionButton("transfer", icon("upload") + " Import a request", "outline small") + '</div></div><div class="stats">' + [["Waiting for you", lessons.filter(item => item.status === "pending").length, "inbox"], ["Confirmed", lessons.filter(item => item.status === "confirmed").length, "calendar"], ["Open hours", store.available(tutor.id).length, "clock"]].map(item => '<div class="stat"><span>' + item[0] + "</span><strong>" + String(item[1]).padStart(2, "0") + "</strong>" + icon(item[2]) + "</div>").join("") + '</div><div class="tab-row"><button type="button" data-action="workspace-tab" data-id="requests" aria-pressed="' + (filters.workspace === "requests") + '">Requests</button><button type="button" data-action="workspace-tab" data-id="availability" aria-pressed="' + (filters.workspace === "availability") + '">My availability</button><button type="button" data-action="edit-tutor" data-id="' + e(tutor.id) + '">Edit profile</button></div>' + (filters.workspace === "requests" ? '<div class="lesson-list">' + (lessons.length ? lessons.map(item => lessonCard(item, true)).join("") : empty("Every good explanation starts with “hello”.", "Import a student request here. To try the process, create a request from the home page first.", actionButton("transfer", "Import a file " + icon("upload"), "purple"))) + "</div>" : '<div class="section-heading"><div><h2>Your time, your timetable.</h2><p>Add your open hours and share the updated timetable with students in a file.</p></div>' + actionButton("add-slot", icon("plus") + " Add a time", "purple small", tutor.id) + '</div><div class="availability-list">' + (ownSlots.length ? ownSlots.map(slot => {
      const occupied = store.state.lessons.some(lesson => lesson.slotId === slot.id && D.active(lesson));
      return '<div class="availability-row"><i>' + icon(slot.mode === "online" ? "video" : "pin") + '</i><div><strong>' + e(D.shortDate(slot.date)) + " · " + e(slot.start) + "–" + e(slot.end) + '</strong><p>' + e(slot.location) + '</p></div><span class="status ' + (occupied ? "pending" : "confirmed") + '">' + (occupied ? "Reserved" : "Open") + '</span><button type="button" class="icon-button" data-action="remove-slot" data-id="' + e(slot.id) + '" aria-label="Remove time ' + e(D.shortDate(slot.date) + " " + slot.start) + '"' + (occupied ? " disabled" : "") + ">×</button></div>";
    }).join("") : empty("A free hour can make a difference.", "Add your first available hour.", actionButton("add-slot", "Add a time", "purple", tutor.id))) + "</div>") + "</section>";
  }
  function profileModal() {
    const profile = store.state.profile;
    openModal('<span class="eyebrow">NICE TO MEET YOU</span><h2 id="modal-title">What should we call you?</h2><p class="modal-lead">Your name and class will appear in your requests. This profile stays in your browser and does not require email verification.</p><form class="form" data-form="profile"><label>Name<input name="name" maxlength="60" required autocomplete="given-name" value="' + e(profile.name) + '" autofocus></label><label>Class<input name="year" maxlength="24" required placeholder="For example, Year 8" value="' + e(profile.year) + '"></label>' + formError + '<button type="submit" class="button purple full">Save profile ' + icon("check") + "</button></form>");
  }
  function bookingModal(tutorId, slotId) {
    const tutor = store.state.tutors.find(item => item.id === tutorId);
    let slots = store.available(tutorId).filter(slot => filters.mode === "all" || slot.mode === filters.mode);
    if (slotId) slots = store.available(tutorId);
    if (!tutor || !slots.length) { notify("This tutor has not added any open times yet."); return; }
    const chosen = slots.find(item => item.id === slotId) || slots[0];
    const selectedSubject = tutor.subjects.includes(filters.subject) ? filters.subject : tutor.subjects[0];
    const dates = [...new Set(slots.map(item => item.date))];
    booking = { tutorId, slotId: chosen.id, mode: slotId ? "all" : filters.mode };
    const profile = store.state.profile;
    openModal('<span class="eyebrow">ONE QUESTION IS A GREAT START</span><h2 id="modal-title">Make a little plan.</h2><div class="booking-tutor">' + avatar(tutor) + '<div><strong>' + e(tutor.name) + '</strong><span class="year">' + e(tutor.year) + (tutor.sample ? " · sample profile" : " · local profile") + '</span></div></div><form class="form" data-form="booking"><div class="form-two"><label>Your name<input name="studentName" required maxlength="60" autocomplete="given-name" value="' + e(profile.name) + '"></label><label>Your class<input name="studentYear" required maxlength="24" placeholder="For example, Year 8" value="' + e(profile.year) + '"></label></div><label>Subject<select name="subject">' + tutor.subjects.map(item => option(item, subject(item).name, selectedSubject)).join("") + '</select></label><label>Date<select id="book-date">' + dates.map(date => option(date, D.shortDate(date), chosen.date)).join("") + '</select></label><div><span class="field-label">Available times · Bishkek</span><div class="time-grid" id="book-times"></div></div><div id="book-location" class="booking-location"></div><label>What would you like help with?<textarea name="note" maxlength="600" placeholder="For example: I would like to understand quadratic equations."></textarea></label>' + formError + '<button type="submit" class="button purple full">Save request ' + icon("arrow") + '</button><small>After saving, download the request and send it to your tutor. Requests are not sent automatically.</small></form>');
    bookingTimes();
  }
  function bookingTimes() {
    if (!booking) return;
    const selectedDate = document.getElementById("book-date").value;
    const slots = store.available(booking.tutorId).filter(slot => slot.date === selectedDate && (booking.mode === "all" || slot.mode === booking.mode));
    if (!slots.some(slot => slot.id === booking.slotId)) booking.slotId = slots.length ? slots[0].id : "";
    document.getElementById("book-times").innerHTML = slots.map(slot => '<button type="button" class="time-option" data-action="book-time" data-id="' + e(slot.id) + '" aria-pressed="' + (booking.slotId === slot.id) + '">' + e(slot.start) + " · " + (slot.mode === "online" ? "online" : "on campus") + "</button>").join("") || '<p class="help">There are no open times left on this date.</p>';
    const chosen = slots.find(slot => slot.id === booking.slotId);
    document.getElementById("book-location").textContent = chosen ? chosen.start + "–" + chosen.end + " · " + chosen.location : "Choose another date.";
  }
  function tutorModal(tutorId) {
    const tutor = store.state.tutors.find(item => item.id === (tutorId || store.state.profile.id));
    const profile = store.state.profile;
    const value = tutor || { name: profile.name, year: profile.year, bio: "", languages: "English", subjects: [] };
    openModal('<span class="eyebrow">SHARE WHAT YOU KNOW</span><h2 id="modal-title">Your tutor profile.</h2><p class="modal-lead">' + (tutor && tutor.sample ? "You are editing a sample on this device. To create your own profile, select “My tutor profile” in the workspace." : "Introduce yourself and choose your subjects. Then add available times and share your timetable with students.") + '</p><form class="form" data-form="tutor" data-id="' + e(tutor ? tutor.id : "") + '"><div class="form-two"><label>Name<input name="name" required maxlength="60" value="' + e(value.name) + '"></label><label>Class<input name="year" required maxlength="24" value="' + e(value.year) + '"></label></div><label>About you<textarea name="bio" required maxlength="360" placeholder="How do you help, and what questions do you enjoy working through?">' + e(value.bio) + '</textarea></label><label>Languages<input name="languages" required maxlength="100" value="' + e(value.languages) + '"></label><fieldset style="border:0;padding:0;margin:0"><legend class="field-label" style="margin-bottom:9px">Which subjects can you help with?</legend><div class="checkboxes">' + D.SUBJECTS.map(item => '<label class="checkbox-label"><input type="checkbox" name="subjects" value="' + e(item.id) + '"' + (value.subjects.includes(item.id) ? " checked" : "") + ">" + e(item.name) + "</label>").join("") + "</div></fieldset>" + formError + '<button type="submit" class="button purple full">Save profile ' + icon("check") + '</button><small>This profile appears in your browser and in files you share. Default profiles for new visitors are configured in data.js.</small></form>');
  }
  function slotModal(tutorId) {
    openModal('<span class="eyebrow">AN HOUR YOU CAN SHARE</span><h2 id="modal-title">Make a little time.</h2><p class="modal-lead">One open hour. All times are in Bishkek time.</p><form class="form" data-form="slot" data-id="' + e(tutorId) + '"><div class="form-two"><label>Date<input type="date" name="date" min="' + D.today() + '" max="' + D.addDays(D.today(), 120) + '" value="' + D.addDays(D.today(), 1) + '" required></label><label>Start time<input type="time" name="start" value="16:00" min="06:00" max="21:00" step="3600" required></label></div><label>Format<select name="mode" id="slot-mode"><option value="campus">On campus</option><option value="online">Online</option></select></label><label>Meeting place<input name="location" id="slot-location" required maxlength="180" value="School library"></label>' + formError + '<button type="submit" class="button purple full">Add this hour ' + icon("plus") + '</button><small>Download your updated timetable using “Share a request” → “Download all data”.</small></form>');
  }
  function statusModal(lessonId, status) {
    const lesson = store.state.lessons.find(item => item.id === lessonId);
    if (!lesson || !Object.prototype.hasOwnProperty.call(D.STATUSES, status)) return;
    const labels = { confirmed: ["All set to meet?", "Confirm"], declined: ["Need a different time?", "Decline request"], cancelled: ["Cancel this lesson?", "Cancel lesson"], completed: ["A little progress worth celebrating.", "Complete lesson"] };
    const label = labels[status];
    if (!label) return;
    openModal('<span class="eyebrow">' + e(subject(lesson.subject).name) + '</span><h2 id="modal-title">' + label[0] + '</h2><p class="modal-lead">' + e(lesson.studentName) + " → " + e(lesson.tutorName) + " · " + e(D.shortDate(lesson.date)) + " · " + e(lesson.start) + '</p><form class="form" data-form="status" data-id="' + e(lessonId) + '" data-status="' + e(status) + '"><label>Message<textarea name="response" maxlength="600" placeholder="For example: meet me in the library and bring your notebook.">' + e(lesson.response) + '</textarea></label>' + formError + '<button type="submit" class="button ' + (status === "cancelled" || status === "declined" ? "danger" : "purple") + ' full">' + label[1] + '</button><small>Download the updated reply and send it to the other participant. Changes do not sync automatically between devices.</small></form>');
  }
  function transferModal(preview) {
    openModal('<span class="eyebrow">PASS THE PLAN ALONG</span><h2 id="modal-title">From you to me.<br>From me to you.</h2><p class="modal-lead">Requests travel as a JSON-file. It contains participant names, times and notes for the selected lessons.</p><div class="transfer-step"><b>1</b><p>The student saves a request and selects <strong>“Download request”</strong> in My lessons.</p></div><div class="transfer-step"><b>2</b><p>The tutor imports the file here, opens their workspace and confirms the time.</p></div><div class="transfer-step"><b>3</b><p>The tutor downloads a reply and sends it back. The student imports it here to update the status.</p></div>' + (preview ? '<div class="import-result"><strong>Ready to import</strong><br>Profiles: ' + preview.tutors.length + " · Hours: " + preview.slots.length + " · Requests: " + preview.lessons.length + '<br>New records will be added. Existing records keep their latest version.</div>' : "") + '<div class="transfer-controls">' + (preview ? actionButton("confirm-import", icon("check") + " Apply this file", "purple full") + actionButton("transfer", "Choose another file", "outline full") : actionButton("pick-file", icon("upload") + " Import a request or reply", "purple full")) + actionButton("export-all", icon("download") + " Download all data", "outline full") + '</div><input id="import-file" type="file" accept=".json,application/json" hidden><p class="help">Import merges data on this device. Files can be up to 1 MB. Your local profile is not included in a full export; participant names inside requests are included.</p><div class="transfer-reset"><small>Your data stays in this browser.</small><button type="button" data-action="reset">Reset</button></div>');
  }
  function download(lessonId) {
    const payload = store.exportData(lessonId);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "learnst-" + (lessonId ? "request-" + lessonId.slice(-8) : "backup") + "-" + D.today() + ".json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    notify("File ready. Send it to the other participant using your preferred messenger or email.");
  }
  function dayModal(date, hour) {
    const records = timetableRecords().filter(item => item.date === date && (!hour || item.start === hour));
    const renderEvent = filters.timetable === "mine" ? timetableLesson : slotButton;
    openModal('<span class="eyebrow">FIND YOUR LITTLE LEARNING WINDOW</span><h2 id="modal-title">' + e(D.shortDate(date)) + (hour ? ' · ' + e(hour) : '') + '</h2><p class="modal-lead">' + (filters.timetable === "mine" ? 'Your saved lessons' : 'Available times') + ' · Bishkek</p><div class="day-slots">' + records.map(renderEvent).join("") + '</div>');
  }
  document.addEventListener("click", event => {
    const button = event.target.closest("[data-action]");
    if (!button || button.disabled) return;
    const { action, id } = button.dataset;
    try {
      switch (action) {
        case "skip": event.preventDefault(); document.getElementById("main").focus(); document.getElementById("main").scrollIntoView(); break;
        case "close": closeModal(); break;
        case "profile": profileModal(); break;
        case "transfer": incoming = null; transferModal(); break;
        case "find-section": document.getElementById("find-tutors").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" }); break;
        case "subject": filters.subject = id; document.querySelectorAll(".chip").forEach(chip => chip.setAttribute("aria-pressed", chip.dataset.id === id ? "true" : "false")); renderTutorResults(); break;
        case "clear-filters": filters.subject = "all"; filters.query = ""; filters.mode = "all"; render(); document.getElementById("find-tutors").scrollIntoView(); break;
        case "book": bookingModal(id); break;
        case "book-slot": { const slot = store.state.slots.find(item => item.id === id); if (slot) bookingModal(slot.tutorId, id); break; }
        case "book-time": if (booking) { booking.slotId = id; bookingTimes(); } break;
        case "join-tutor": tutorModal(); break;
        case "edit-tutor": tutorModal(id); break;
        case "add-slot": slotModal(id); break;
        case "remove-slot": store.removeSlot(id); render(); notify("That hour was removed from your timetable."); break;
        case "timetable-view": filters.timetable = id === "mine" ? "mine" : "open"; render(); break;
        case "week-today": weekOffset = 0; render(); break;
        case "lesson-details": { const lesson = store.state.lessons.find(item => item.id === id); if (lesson) openModal('<span class="eyebrow">YOUR LEARNING PLAN</span><h2 id="modal-title">Lesson details.</h2>' + lessonCard(lesson, false)); break; }
        case "week-prev": weekOffset = Math.max(-16, weekOffset - 1); render(); break;
        case "week-next": weekOffset = Math.min(16, weekOffset + 1); render(); break;
        case "day": dayModal(id, button.dataset.hour); break;
        case "lesson-filter": filters.lessons = id; render(); break;
        case "workspace-tab": filters.workspace = id; render(); break;
        case "status": statusModal(id, button.dataset.status); break;
        case "export-lesson": download(id); break;
        case "export-all": download(); break;
        case "pick-file": document.getElementById("import-file").click(); break;
        case "confirm-import": {
          if (!incoming) break;
          store.importData(incoming);
          closeModal();
          render();
          notify("File imported. Find requests in My lessons and in the selected tutor workspace.");
          break;
        }
        case "reset": openModal('<span class="eyebrow">A FRESH START</span><h2 id="modal-title">Clear this browser?</h2><p class="modal-lead">This removes your local profile, added tutors and requests. You can download a backup first.</p><div class="transfer-controls">' + actionButton("export-all", "Download backup", "outline full") + actionButton("reset-confirm", "Delete data on this device", "danger full") + actionButton("close", "Keep my data", "outline full") + "</div>"); break;
        case "reset-confirm": store.reset(); filters.subject = "all"; filters.tutor = "all"; closeModal(); render(); notify("Local data reset. Sample profiles restored."); break;
      }
    } catch (error) { notify(error.message || "That action could not be completed. Please try again."); }
  });
  document.addEventListener("input", event => {
    if (event.target.id === "search") { filters.query = event.target.value; renderTutorResults(); }
  });
  document.addEventListener("change", async event => {
    const target = event.target;
    try {
      if (target.id === "find-mode") { filters.mode = target.value; renderTutorResults(); }
      if (target.id === "schedule-mode") { filters.mode = target.value; render(); }
      if (target.id === "schedule-subject") { filters.subject = target.value; render(); }
      if (target.id === "schedule-tutor") { filters.tutor = target.value; render(); }
      if (target.id === "workspace-tutor") { store.selectTutor(target.value); render(); }
      if (target.id === "book-date") bookingTimes();
      if (target.id === "slot-mode") document.getElementById("slot-location").value = target.value === "online" ? "Online · agree on meeting details in the reply" : "School library";
      if (target.id === "import-file" && target.files && target.files[0]) {
        const file = target.files[0];
        if (file.size > 1000000) throw new Error("This file is too large. Choose a JSON Learnst file up to 1 MB.");
        const parsed = store.previewImport(await file.text());
        if (!modal.open) return;
        incoming = parsed;
        transferModal(parsed);
      }
    } catch (error) { notify(error.message || "The file could not be imported."); target.value = ""; }
  });
  document.addEventListener("submit", event => {
    const form = event.target.closest("form[data-form]");
    if (!form) return;
    event.preventDefault();
    const data = new FormData(form);
    const value = name => String(data.get(name) || "");
    const errorNode = form.querySelector("[data-form-error]");
    errorNode.hidden = true;
    try {
      if (form.dataset.form === "profile") { store.profile(value("name"), value("year")); closeModal(); render(); notify("Nice to meet you! Your profile is saved on this device."); }
      else if (form.dataset.form === "booking") {
        if (!booking || !booking.slotId) throw new Error("Choose an available time.");
        store.book({ studentName: value("studentName"), studentYear: value("studentYear"), subject: value("subject"), note: value("note"), slotId: booking.slotId });
        filters.lessons = "active";
        go("lessons");
        notify("Request saved. Download it and send the file to your tutor.");
      } else if (form.dataset.form === "tutor") {
        store.saveTutor({ name: value("name"), year: value("year"), bio: value("bio"), languages: value("languages"), subjects: data.getAll("subjects") }, form.dataset.id || undefined);
        filters.workspace = "availability";
        go("workspace");
        notify("Profile saved. Add your available times next.");
      } else if (form.dataset.form === "slot") {
        store.addSlot({ date: value("date"), start: value("start"), mode: value("mode"), location: value("location") }, form.dataset.id);
        closeModal(); render(); notify("New hour added. Download your timetable to share it with students.");
      } else if (form.dataset.form === "status") {
        store.setStatus(form.dataset.id, form.dataset.status, value("response"));
        closeModal(); render(); notify("Status updated. Download the reply file and send it to the other participant.");
      }
    } catch (error) { errorNode.textContent = error.message || "Check the details and try again."; errorNode.hidden = false; }
  });
  modal.addEventListener("click", event => { if (event.target === modal) closeModal(); });
  modal.addEventListener("cancel", () => { booking = null; incoming = null; });
  window.addEventListener("hashchange", () => { closeModal(); render(); });
  window.addEventListener("storage", event => { if (event.key === D.KEY || event.key === null) { store.reload(); if (!modal.open) render(); } });
  render();
})();
