/* Shared Supabase Auth + database API. No external JavaScript libraries. */
(function (global) {
  "use strict";
  const config = global.LEARNST_CONFIG || {};
  const base = String(config.supabaseUrl || "").trim().replace(/\/+$/, "");
  const key = String(config.supabaseKey || "").trim();
  let configError = "";
  if (base || key) {
    if (!/^https:\/\/[^/]+$/.test(base) || !key) configError = "Add the project URL and public API key in config.js first.";
    if (key.startsWith("sb_secret_")) configError = "Use a publishable key in config.js. Secret keys must not be placed in website files.";
    if (key.split(".").length === 3) {
      try {
        const value = JSON.parse(atob(key.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")));
        if (value.role !== "anon") configError = "Use the public anon or publishable key, not a service_role key.";
      } catch (error) { configError = "The public API key is not valid. Check config.js."; }
    }
  }
  const configured = !!base && !!key && !configError;
  const storageKey = "learnst-auth:" + base + ":" + location.pathname.replace(/[^/]*$/, "");
  let saved = null, refreshTask = null;
  try { saved = JSON.parse(sessionStorage.getItem(storageKey) || "null"); } catch (error) { /* Use memory when session storage is unavailable. */ }
  function save(value) {
    saved = value && typeof value.access_token === "string" && typeof value.refresh_token === "string" ? {
      access_token: value.access_token, refresh_token: value.refresh_token,
      expires_at: Number(value.expires_at) || Math.floor(Date.now()/1000) + (Number(value.expires_in) || 3600)
    } : null;
    try { if (saved) sessionStorage.setItem(storageKey, JSON.stringify(saved)); else sessionStorage.removeItem(storageKey); } catch (error) { /* A tab can remain signed in using memory. */ }
  }
  function ready() { if (!configured) throw new Error(configError || "Your school needs to connect its shared database. See SETUP.md."); }
  function message(data) {
    const code = data && (data.error_code || data.code || data.error);
    if (code === "email_address_not_authorized") return "Student email delivery is not set up yet. Ask your school admin to configure email sending.";
    if (code === "over_email_send_rate_limit") return "Too many emails were requested. Wait a little before trying again.";
    if (code === "invalid_credentials") return "That email and password did not match.";
    if (code === "email_not_confirmed") return "Confirm your email using the message in your inbox, then sign in.";
    if (code === "signup_disabled") return "Your school has not enabled new account registration yet.";
    return String(data && (data.message || data.msg || data.error_description || data.error) || "The request could not be completed.").slice(0,500);
  }
  async function network(path, options, token) {
    ready();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(base + path, {
        method: options.method || "POST", signal: controller.signal,
        headers: { apikey: key, "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) })
      });
      const raw = await response.text();
      let data = null;
      if (raw) { try { data = JSON.parse(raw); } catch (error) { throw new Error("The server returned an unreadable response. Please try again."); } }
      if (!response.ok) { const error = new Error(message(data)); error.status = response.status; throw error; }
      return data;
    } catch (error) {
      if (error.name === "AbortError") throw new Error("The connection took too long. Please try again.");
      throw error;
    } finally { clearTimeout(timer); }
  }
  async function refresh(force) {
    if (!saved) throw new Error("Sign in to continue.");
    if (!force && saved.expires_at > Date.now()/1000 + 45) return;
    if (!refreshTask) refreshTask = network("/auth/v1/token?grant_type=refresh_token", { body: { refresh_token: saved.refresh_token } }, null)
      .then(data => { save(data); })
      .catch(error => { if (error.status === 400 || error.status === 401 || error.status === 403) save(null); throw error; })
      .finally(() => { refreshTask = null; });
    return refreshTask;
  }
  async function request(path, body, authenticated, method) {
    if (authenticated) await refresh(false);
    try { return await network(path, { body, method: method || "POST" }, authenticated && saved ? saved.access_token : null); }
    catch (error) {
      if (authenticated && error.status === 401 && saved) {
        await refresh(true);
        return network(path, { body, method: method || "POST" }, saved.access_token);
      }
      throw error;
    }
  }
  const rpc = (name, body, authenticated) => request("/rest/v1/rpc/" + name, body || {}, authenticated !== false);
  const accountUrl = () => new URL("./account.html", location.href).href.split("#")[0].split("?")[0];
  async function signUp(email, password, fullName, year) {
    if (password.length < 10) throw new Error("Use a password with at least 10 characters.");
    const data = await request("/auth/v1/signup?redirect_to=" + encodeURIComponent(accountUrl()), {
      email: email.trim(), password, data: { full_name: fullName.trim(), year: year.trim() }
    }, false);
    if (data && data.access_token) save(data);
    return { signedIn: !!(data && data.access_token) };
  }
  async function signIn(email, password) {
    const data = await request("/auth/v1/token?grant_type=password", { email: email.trim(), password }, false);
    if (!data || !data.access_token || !data.refresh_token) throw new Error("Sign-in did not return a session. Please try again.");
    save(data);
  }
  async function signOut() {
    try { if (saved) await request("/auth/v1/logout", {}, true); }
    finally { save(null); }
  }
  async function consumeRedirect() {
    const params = new URLSearchParams(location.hash.slice(1));
    if (!params.has("access_token") && !params.has("error_description")) return { recovery: false };
    history.replaceState(null, "", location.pathname + location.search);
    if (params.has("error_description")) throw new Error(params.get("error_description").slice(0,300));
    const access = params.get("access_token"), refreshToken = params.get("refresh_token");
    if (!access || !refreshToken) throw new Error("This confirmation link is incomplete. Sign in or request a new password email.");
    await network("/auth/v1/user", { method: "GET" }, access);
    save({ access_token: access, refresh_token: refreshToken, expires_in: Number(params.get("expires_in")) || 3600 });
    return { recovery: params.get("type") === "recovery" };
  }
  global.LearnstCloud = Object.freeze({
    configured, configError, schoolName: String(config.schoolName || "Your school"),
    signedIn: () => !!saved, signUp, signIn, signOut, consumeRedirect,
    profile: () => rpc("learnst_profile"),
    updateProfile: (name, year) => rpc("learnst_update_profile", { p_full_name: name.trim(), p_year: year.trim() }),
    school: () => rpc("learnst_school", {}, false),
    catalog: () => rpc("learnst_catalog", {}, false),
    myRegistrations: () => rpc("learnst_my_enrolments"),
    register: (id, note) => rpc("learnst_register", { p_lesson_id: id, p_note: note || "" }),
    cancelRegistration: id => rpc("learnst_cancel_registration", { p_enrolment_id: id }),
    dashboard: () => rpc("learnst_admin_dashboard"),
    createLesson: data => rpc("learnst_admin_create_lesson", data),
    cancelLesson: id => rpc("learnst_admin_cancel_lesson", { p_lesson_id: id }),
    resetPassword: email => request("/auth/v1/recover?redirect_to=" + encodeURIComponent(accountUrl()), { email: email.trim() }, false),
    updatePassword: password => { if (password.length < 10) return Promise.reject(new Error("Use at least 10 characters.")); return request("/auth/v1/user", { password }, true, "PUT"); }
  });

  const escape = value => String(value == null ? "" : value).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  function when(iso) {
    const date = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bishkek", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
    const p = name => parts.find(item => item.type === name).value;
    return { date: p("year") + "-" + p("month") + "-" + p("day"), time: p("hour") + ":" + p("minute"), label: new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Bishkek", weekday: "short", day: "numeric", month: "short" }).format(date) };
  }
  function modal(html) {
    const element = document.getElementById("modal");
    document.getElementById("modal-body").innerHTML = html;
    if (!element.open) element.showModal();
  }
  function closeModal() { const element = document.getElementById("modal"); if (element && element.open) element.close(); }
  let toastTimer;
  function notify(value) {
    const element = document.getElementById("toast");
    if (element) { element.textContent = value; element.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.hidden = true; },7000); }
    const dialog = document.getElementById("modal");
    if (dialog && dialog.open) {
      let feedback = document.getElementById("modal-feedback");
      if (!feedback) { feedback = document.createElement("p"); feedback.id="modal-feedback"; feedback.className="notice"; feedback.setAttribute("role","status"); document.getElementById("modal-body").appendChild(feedback); }
      feedback.textContent = value;
    }
  }
  function downloadCsv(filename, rows) {
    const value = item => { let s=String(item == null ? "" : item); if (/^\s*[=+@\-]|^[\t\r]/.test(s)) s="'"+s; return '"'+s.replace(/"/g,'""')+'"'; };
    const url = URL.createObjectURL(new Blob(["\ufeff" + rows.map(row => row.map(value).join(",")).join("\r\n")], { type:"text/csv;charset=utf-8" }));
    const link=document.createElement("a"); link.href=url; link.download=filename; document.body.appendChild(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  global.LearnstUI = Object.freeze({ escape, when, modal, closeModal, notify, downloadCsv,
    subject: id => global.LearnstData.SUBJECTS.find(item => item.id === id) || global.LearnstData.SUBJECTS[0],
    error: '<p class="form-error" data-form-error role="alert" hidden></p>'
  });
})(window);
