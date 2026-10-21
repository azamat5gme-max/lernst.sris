/* Learnst Lite. Plain JavaScript; no packages to install. */
(function (global) {
  "use strict";

  // Change the school name here. Lesson times use Bishkek time.
  const SETTINGS = { school: String((global.LEARNST_CONFIG || {}).schoolName || "Your school"), timeZone: "Asia/Bishkek" };
  const KEY = "learnst-lite-v1";
  const SUBJECTS = [
    { id: "science", name: "Science", symbol: "⚗", color: "peach" },
    { id: "english", name: "English", symbol: "Aa", color: "lime-bg" },
    { id: "math", name: "Maths", symbol: "∑", color: "lilac" }
  ];
  // Preserve older requests when upgrading from the original ten-subject version.
  const LEGACY_SUBJECTS = { physics: ["science", "Physics"], chemistry: ["science", "Chemistry"], programming: ["science", "Programming"], writing: ["english", "Writing"], russian: ["english", "Russian"], economics: ["math", "Economics"], accounting: ["math", "Accounting"], finance: ["math", "Finance"] };
  const canonicalSubject = value => Object.prototype.hasOwnProperty.call(LEGACY_SUBJECTS, value) ? LEGACY_SUBJECTS[value][0] : value;
  const LEGACY_NAMES = { "\u0410\u043b\u0438\u043d\u0430": "Alina", "\u0410\u043b\u0442\u0435\u044f": "Altea", "\u0410\u043c\u0438\u043d\u0430": "Amina", "\u0414\u0430\u043d\u0438\u044f\u0440": "Daniyar", "\u0421\u043e\u0444\u0438\u044f": "Sofia", "\u041c\u0430\u043d\u0438\u0436\u0430": "Manizha" };
  function localiseLocation(value) {
    if (value === "\u0428\u043a\u043e\u043b\u044c\u043d\u0430\u044f \u0431\u0438\u0431\u043b\u0438\u043e\u0442\u0435\u043a\u0430") return "School library";
    if (value === "\u041e\u043d\u043b\u0430\u0439\u043d \u00b7 \u0434\u043e\u0433\u043e\u0432\u043e\u0440\u0438\u0442\u0435\u0441\u044c \u043e \u0441\u0432\u044f\u0437\u0438 \u0432 \u043e\u0442\u0432\u0435\u0442\u0435") return "Online · agree on meeting details in your reply";
    return value;
  }
  const COLORS = ["lilac", "lime", "peach", "blue", "yellow", "pink"];
  const STATUSES = { pending: "Pending", confirmed: "Confirmed", declined: "Declined", cancelled: "Cancelled", completed: "Completed" };
  const clone = value => JSON.parse(JSON.stringify(value));
  const subject = id => SUBJECTS.find(item => item.id === id);
  const active = lesson => lesson.status === "pending" || lesson.status === "confirmed";
  const uid = prefix => prefix + "-" + (global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  function schoolNow() {
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: SETTINGS.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date());
    const part = name => parts.find(item => item.type === name).value;
    return part("year") + "-" + part("month") + "-" + part("day") + "T" + part("hour") + ":" + part("minute");
  }
  const today = () => schoolNow().slice(0, 10);
  function addDays(date, count) {
    const value = new Date(date + "T12:00:00Z");
    value.setUTCDate(value.getUTCDate() + count);
    return value.toISOString().slice(0, 10);
  }
  function shortDate(date, weekday) {
    return new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", ...(weekday === false ? {} : { weekday: "short" }) }).format(new Date(date + "T12:00:00Z"));
  }
  const future = slot => slot.date + "T" + slot.start > schoolNow();
  const overlaps = (a, b) => a.date === b.date && a.start < b.end && b.start < a.end;
  const required = message => { throw new Error(message); };
  function text(value, max, label, allowEmpty) {
    if (typeof value !== "string" || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) required("Please check “" + label + "”.");
    value = value.trim();
    if (!allowEmpty && !value) required("Please fill in “" + label + "”.");
    return value;
  }
  function id(value) {
    if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,140}$/.test(value)) required("The file contains an invalid record ID.");
    return value;
  }
  function validDate(value) {
    if (typeof value !== "string" || !/^20\d{2}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + "T12:00:00Z")) || new Date(value + "T12:00:00Z").toISOString().slice(0, 10) !== value) required("Enter a valid date.");
    return value;
  }
  function timestamp(value) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 9999999999999) required("The file contains an invalid update date.");
    return value;
  }
  function list(value, max, label) {
    if (!Array.isArray(value) || value.length > max) required("Too many records or an invalid list: " + label + ".");
    return value;
  }
  function unique(items) {
    if (new Set(items.map(item => item.id)).size !== items.length) required("The file contains duplicate record IDs.");
    return items;
  }
  function cleanTutor(value) {
    if (!value || typeof value !== "object") required("This is not a valid tutor profile.");
    if (value.sample === true && value.updatedAt === 1) value = sampleTutors().find(tutor => tutor.id === value.id) || value;
    const subjects = [...new Set(list(value.subjects, 10, "subjects").map(canonicalSubject))];
    if (!subjects.length || subjects.some(item => !subject(item))) required("Choose at least one subject.");
    const color = COLORS.includes(value.color) ? value.color : "lilac";
    return { id: id(value.id), name: text(value.name, 60, "name"), year: text(value.year, 24, "class"), bio: text(value.bio, 360, "about you"), languages: text(value.languages, 100, "languages"), subjects, color, sample: value.sample === true, updatedAt: timestamp(value.updatedAt) };
  }
  function cleanSlot(value) {
    if (!value || typeof value !== "object") required("This is not a valid lesson time.");
    if (typeof value.start !== "string" || !/^(0[6-9]|1\d|20|21):00$/.test(value.start)) required("Lessons start on the hour, between 06:00 and 21:00.");
    const end = String(Number(value.start.slice(0, 2)) + 1).padStart(2, "0") + ":00";
    if (value.end !== end) required("Each lesson lasts exactly one hour.");
    if (!["campus", "online"].includes(value.mode)) required("Choose a lesson format.");
    return { id: id(value.id), tutorId: id(value.tutorId), date: validDate(value.date), start: value.start, end, mode: value.mode, location: localiseLocation(text(value.location, 180, "meeting place")), archived: value.archived === true, updatedAt: timestamp(value.updatedAt) };
  }
  function cleanLesson(value) {
    if (!value || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(STATUSES, value.status) || !subject(canonicalSubject(value.subject))) required("This is not a valid lesson request.");
    const slot = cleanSlot({ ...value, id: value.slotId, tutorId: value.tutorId, archived: false });
    const originalSubject = Object.prototype.hasOwnProperty.call(LEGACY_SUBJECTS, value.subject) ? LEGACY_SUBJECTS[value.subject][1] : value.previousSubject || "";
    const tutorName = typeof value.tutorId === "string" && value.tutorId.startsWith("sample-") && Object.prototype.hasOwnProperty.call(LEGACY_NAMES, value.tutorName) ? LEGACY_NAMES[value.tutorName] : value.tutorName;
    return { id: id(value.id), studentId: id(value.studentId), studentName: text(value.studentName, 60, "student name"), studentYear: text(value.studentYear, 24, "student class"), tutorId: slot.tutorId, tutorName: text(tutorName, 60, "tutor name"), slotId: slot.id, subject: canonicalSubject(value.subject), previousSubject: text(originalSubject, 40, "original subject", true), date: slot.date, start: slot.start, end: slot.end, mode: slot.mode, location: slot.location, note: text(value.note, 600, "question", true), response: text(value.response, 600, "reply", true), status: value.status, createdAt: timestamp(value.createdAt), updatedAt: timestamp(value.updatedAt) };
  }
  function cleanState(value) {
    if (!value || value.version !== 1 || !value.profile) required("This is a different data format for Learnst.");
    const state = { version: 1, profile: { id: id(value.profile.id), name: text(value.profile.name, 60, "name", true), year: text(value.profile.year, 24, "class", true) }, workspaceTutorId: id(value.workspaceTutorId), tutors: unique(list(value.tutors, 60, "tutors").map(cleanTutor)), slots: unique(list(value.slots, 6000, "timetable").map(cleanSlot)), lessons: unique(list(value.lessons, 500, "lessons").map(cleanLesson)) };
    checkState(state);
    return state;
  }
  function checkState(state) {
    const tutors = new Set(state.tutors.map(tutor => tutor.id));
    const slots = new Map(state.slots.map(slot => [slot.id, slot]));
    if (!state.tutors.length) required("Keep at least one tutor in the timetable.");
    for (const slot of state.slots) if (!tutors.has(slot.tutorId)) required("A time refers to a tutor who is not in the file.");
    for (const lesson of state.lessons) {
      const slot = slots.get(lesson.slotId);
      if (!tutors.has(lesson.tutorId) || !slot || ["tutorId", "date", "start", "end", "mode", "location"].some(key => slot[key] !== lesson[key])) required("A request does not match its timetable entry.");
    }
    const occupied = state.lessons.filter(active);
    for (let i = 0; i < occupied.length; i++) for (let j = i + 1; j < occupied.length; j++) {
      const a = occupied[i], b = occupied[j];
      if (overlaps(a, b) && (a.tutorId === b.tutorId || a.studentId === b.studentId || a.studentId === b.tutorId || a.tutorId === b.studentId)) required("These lessons overlap. Cancel one request first, then share the updated file.");
    }
  }
  function sampleTutors() {
    return [
      { id: "sample-alina", name: "Alina", year: "Year 11", subjects: ["math"], color: "lilac", languages: "English, Russian", bio: "Equations and problems at your own pace. Every question is welcome, even the one you think is too simple." },
      { id: "sample-altea", name: "Altea", year: "Year 11", subjects: ["english"], color: "lime", languages: "English", bio: "Grammar, essays or speaking practice? Bring your draft and questions, and we will find the right words together." },
      { id: "sample-amina", name: "Amina", year: "Year 10", subjects: ["science"], color: "peach", languages: "English, Kyrgyz", bio: "Curious about how things work? Let us make Science clearer through diagrams, simple experiments and everyday examples." },
      { id: "sample-daniyar", name: "Daniyar", year: "Year 11", subjects: ["math"], color: "lilac", languages: "English, Russian", bio: "Numbers do not have to be a mystery. We will break each Maths problem into smaller steps and practise together." },
      { id: "sample-sofia", name: "Sofia", year: "Year 11", subjects: ["science"], color: "peach", languages: "English", bio: "Big Science questions welcome. Bring the topic that feels tricky, and we will work through the ideas at your pace." },
      { id: "sample-manizha", name: "Manizha", year: "Year 10", subjects: ["english"], color: "lime", languages: "English, Russian", bio: "A friendly space to practise English, shape an essay and ask every question you were keeping to yourself." }
    ].map(tutor => ({ ...tutor, sample: true, updatedAt: 2 }));
  }
  function populateSlots(state) {
    const ids = new Set(state.slots.map(slot => slot.id));
    const first = today();
    state.tutors.filter(tutor => tutor.sample).forEach((tutor, index) => {
      for (let day = 1; day <= 14; day++) {
        const date = addDays(first, day);
        if (new Date(date + "T12:00:00Z").getUTCDay() === 0) continue;
        [14 + index % 2, 16, 18].forEach(hour => {
          const slotId = tutor.id + "-" + date + "-" + hour;
          if (!ids.has(slotId)) {
            state.slots.push({ id: slotId, tutorId: tutor.id, date, start: hour + ":00", end: hour + 1 + ":00", mode: hour === 18 ? "online" : "campus", location: hour === 18 ? "Online · agree on meeting details in your reply" : "School library", archived: false, updatedAt: 1 });
            ids.add(slotId);
          }
        });
      }
    });
    // Remove expired unused sample times while keeping lesson history.
    const used = new Set(state.lessons.map(lesson => lesson.slotId));
    state.slots = state.slots.filter(slot => slot.date >= addDays(first, -14) || used.has(slot.id));
  }
  function newState() {
    const state = { version: 1, profile: { id: uid("person"), name: "", year: "" }, workspaceTutorId: "sample-alina", tutors: sampleTutors(), slots: [], lessons: [] };
    populateSlots(state);
    return state;
  }
  const stamp = old => Math.max(Date.now(), (old || 0) + 1);
  class Store {
    constructor(storage) {
      this.storage = storage;
      this.persistent = !!storage;
      this.warning = "";
      this.state = newState();
      this.reload();
      populateSlots(this.state);
      this.save();
    }
    reload() {
      if (!this.persistent) return;
      try {
        const raw = this.storage.getItem(KEY);
        if (raw) this.state = cleanState(JSON.parse(raw));
      } catch (error) {
        this.persistent = false;
        this.warning = "Saved data could not be read. New changes are temporary; download them before closing this page.";
      }
    }
    save() {
      if (!this.persistent) return;
      try { this.storage.setItem(KEY, JSON.stringify(this.state)); }
      catch (error) { this.persistent = false; this.warning = "Your browser cannot save changes. Download your data using “Share a request” before closing this page."; }
    }
    transact(change) {
      this.reload();
      const next = clone(this.state);
      const result = change(next);
      this.state = cleanState(next);
      this.save();
      return result;
    }
    available(tutorId, selectedSubject) {
      return this.state.slots.filter(slot => !slot.archived && future(slot) && (!tutorId || slot.tutorId === tutorId) && (!selectedSubject || this.state.tutors.find(tutor => tutor.id === slot.tutorId).subjects.includes(selectedSubject)) && !this.state.lessons.some(lesson => active(lesson) && overlaps(slot, lesson) && (lesson.tutorId === slot.tutorId || lesson.studentId === slot.tutorId))).sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    }
    profile(name, year) {
      return this.transact(state => { state.profile.name = text(name, 60, "name"); state.profile.year = text(year, 24, "class"); });
    }
    book(data) {
      return this.transact(state => {
        const slot = state.slots.find(item => item.id === data.slotId);
        const tutor = slot && state.tutors.find(item => item.id === slot.tutorId);
        if (!slot || slot.archived || !future(slot) || !tutor) required("This time is no longer available. Choose another hour.");
        if (!tutor.subjects.includes(data.subject)) required("Choose a subject this tutor offers.");
        const name = text(data.studentName, 60, "name"), year = text(data.studentYear, 24, "class");
        if (tutor.id === state.profile.id) required("Choose another tutor for your lesson.");
        const now = Date.now();
        const lesson = cleanLesson({ ...slot, id: uid("lesson"), slotId: slot.id, studentId: state.profile.id, studentName: name, studentYear: year, tutorName: tutor.name, subject: data.subject, note: text(data.note, 600, "question", true), response: "", status: "pending", createdAt: now, updatedAt: now });
        state.profile.name = name;
        state.profile.year = year;
        state.lessons.push(lesson);
        return lesson.id;
      });
    }
    setStatus(lessonId, status, response) {
      return this.transact(state => {
        const lesson = state.lessons.find(item => item.id === lessonId);
        if (!lesson) required("This request could not be found.");
        const transitions = { pending: ["confirmed", "declined", "cancelled"], confirmed: ["cancelled", "completed"], cancelled: [], declined: [], completed: [] };
        if (!transitions[lesson.status].includes(status)) required("This status has already changed. Refresh the list.");
        if (status === "completed" && lesson.date + "T" + lesson.end > schoolNow()) required("You can complete a lesson after its scheduled end time.");
        if (status === "confirmed" && !future(lesson)) required("This time has passed. Create a request for a new date.");
        lesson.status = status;
        lesson.response = text(response || "", 600, "reply", true);
        lesson.updatedAt = stamp(lesson.updatedAt);
      });
    }
    saveTutor(data, tutorId) {
      return this.transact(state => {
        const current = state.tutors.find(item => item.id === (tutorId || state.profile.id));
        const tutor = cleanTutor({ ...data, id: current ? current.id : state.profile.id, sample: current ? current.sample : false, color: current ? current.color : "lilac", updatedAt: stamp(current && current.updatedAt) });
        if (current) state.tutors[state.tutors.indexOf(current)] = tutor; else state.tutors.push(tutor);
        if (tutor.id === state.profile.id) { state.profile.name = tutor.name; state.profile.year = tutor.year; }
        state.workspaceTutorId = tutor.id;
        return tutor.id;
      });
    }
    selectTutor(tutorId) {
      this.transact(state => { if (!state.tutors.some(item => item.id === tutorId)) required("This tutor could not be found."); state.workspaceTutorId = tutorId; });
    }
    addSlot(data, tutorId) {
      this.transact(state => {
        if (!state.tutors.some(tutor => tutor.id === tutorId)) required("Create your tutor profile first.");
        const slot = cleanSlot({ ...data, id: uid("slot"), tutorId, end: String(Number(String(data.start).slice(0, 2)) + 1).padStart(2, "0") + ":00", archived: false, updatedAt: Date.now() });
        if (!future(slot) || slot.date > addDays(today(), 120)) required("Choose a future time within the next 120 days.");
        if (state.slots.some(item => !item.archived && item.tutorId === tutorId && overlaps(item, slot))) required("You have already added this time. Choose a different hour.");
        state.slots.push(slot);
      });
    }
    removeSlot(slotId) {
      this.transact(state => {
        const slot = state.slots.find(item => item.id === slotId);
        if (!slot) required("This time could not be found.");
        if (state.lessons.some(lesson => active(lesson) && lesson.slotId === slotId)) required("Cancel the lesson using this time before removing the hour.");
        slot.archived = true;
        slot.updatedAt = stamp(slot.updatedAt);
      });
    }
    exportData(lessonId) {
      this.reload();
      const state = this.state;
      const lessons = lessonId ? state.lessons.filter(item => item.id === lessonId) : state.lessons;
      if (lessonId && !lessons.length) required("This request could not be found.");
      const tutorIds = new Set(lessons.map(item => item.tutorId));
      const slotIds = new Set(lessons.map(item => item.slotId));
      return { app: "learnst-lite", version: 1, exportedAt: Date.now(), tutors: clone(lessonId ? state.tutors.filter(item => tutorIds.has(item.id)) : state.tutors), slots: clone(lessonId ? state.slots.filter(item => slotIds.has(item.id)) : state.slots), lessons: clone(lessons) };
    }
    previewImport(raw) {
      if (typeof raw !== "string" || raw.length > 1000000) required("Choose a JSON-file Learnst file up to 1 MB.");
      let parsed;
      try { parsed = JSON.parse(raw); } catch (error) { required("The file could not be read. Choose a JSON, exported from Learnst."); }
      if (!parsed || parsed.app !== "learnst-lite" || parsed.version !== 1) required("This is not a file from Learnst.");
      const incoming = { tutors: unique(list(parsed.tutors, 60, "tutors").map(cleanTutor)), slots: unique(list(parsed.slots, 6000, "timetable").map(cleanSlot)), lessons: unique(list(parsed.lessons, 500, "lessons").map(cleanLesson)) };
      this.mergedState(incoming);
      return incoming;
    }
    mergedState(incoming) {
      const next = clone(this.state);
      for (const key of ["tutors", "slots", "lessons"]) {
        for (const item of incoming[key]) {
          const existing = next[key].find(value => value.id === item.id);
          if (existing) {
            const stable = key === "slots" ? ["tutorId", "date", "start", "end", "mode", "location"] : key === "lessons" ? ["studentId", "studentName", "studentYear", "tutorId", "tutorName", "slotId", "subject", "date", "start", "end", "mode", "location", "note", "createdAt"] : [];
            if (stable.some(field => existing[field] !== item[field])) required("Two records with the same ID contain different details. No changes were imported.");
            if (item.updatedAt === existing.updatedAt && Object.keys(item).some(field => JSON.stringify(item[field]) !== JSON.stringify(existing[field]))) required("This file and your browser contain conflicting changes with the same timestamp. Ask for a fresh export.");
            if (item.updatedAt > existing.updatedAt) next[key][next[key].indexOf(existing)] = clone(item);
          } else next[key].push(clone(item));
        }
      }
      return cleanState(next);
    }
    importData(incoming) {
      // Revalidate the file in case another tab has updated the data.
      this.reload();
      const safe = this.previewImport(JSON.stringify({ app: "learnst-lite", version: 1, ...incoming }));
      this.state = this.mergedState(safe);
      this.save();
    }
    reset() {
      if (this.storage) { try { this.storage.removeItem(KEY); this.persistent = true; this.warning = ""; } catch (error) { this.persistent = false; } }
      this.state = newState();
      this.save();
    }
  }
  global.LearnstData = Object.freeze({ SETTINGS, KEY, SUBJECTS, STATUSES, Store, subject, active, today, schoolNow, shortDate, addDays, future, uid });
})(window);
