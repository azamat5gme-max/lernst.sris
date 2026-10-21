(function () {
  "use strict";
  const C=window.LearnstCloud,U=window.LearnstUI,e=U.escape,root=document.getElementById("account-app");
  let tab="signin",profile=null,recovery=false,notice="";
  const next=new URLSearchParams(location.search).get("next")==="admin"?"./admin.html":"./index.html#lessons";
  function render() {
    if(!C.configured){root.innerHTML='<div class="setup-box"><span class="eyebrow">ONE SMALL SETUP FIRST</span><h2>Ready for real registrations.</h2><p>'+e(C.configError||"Your school needs to connect its shared database before students can create accounts. Follow SETUP.md in the downloaded folder.")+'</p><a href="./SETUP.md">Open setup instructions ↗</a></div><a href="./index.html" class="button purple full">Explore the local preview</a><p class="help" style="margin-top:17px">No account is created in the local preview.</p>';return;}
    if(profile&&!recovery){
      root.innerHTML='<span class="account-status">✓ Signed in</span><h2>A little plan,<br>all yours.</h2><div class="account-email"><strong>'+e(profile.full_name)+'</strong>'+e(profile.email)+'</div><form class="form" data-account-form="profile"><label>Your name<input name="full_name" maxlength="60" required value="'+e(profile.full_name)+'"></label><label>Your class<input name="year" maxlength="24" required value="'+e(profile.year)+'"></label>'+U.error+'<button type="submit" class="button purple full">Save profile</button></form><div class="transfer-controls"><a href="'+next+'" class="button outline full">'+(next.includes('admin')?'Open admin dashboard':'Open my lessons')+' ↗</a>'+(profile.is_admin?'<a class="button outline full" href="./admin.html">School admin ↗</a>':'')+'</div><div class="account-links"><button type="button" data-account-action="signout">Sign out</button><button type="button" data-account-action="reset">Reset password</button></div>';return;
    }
    const reset=tab==="reset";
    root.innerHTML=(recovery?'':'<div class="tab-row"><button type="button" data-account-action="tab" data-tab="signin" aria-pressed="'+(tab==="signin")+'">Sign in</button><button type="button" data-account-action="tab" data-tab="signup" aria-pressed="'+(tab==="signup")+'">Create account</button></div>')+
      '<span class="eyebrow">'+(recovery?'A FRESH START':reset?'WE WILL HELP YOU BACK IN':tab==="signup"?'NICE TO MEET YOU':'WELCOME BACK')+'</span><h2>'+(recovery?'Choose a new password.':reset?'Forgot your password?':tab==="signup"?'Your next “aha!”<br>starts here.':'Good to see you.')+'</h2><p class="modal-lead">'+(recovery?'Save a new password for your school account.':reset?'Enter your account email to receive a reset link.':tab==="signup"?'Create your account, confirm your email and choose a lesson.':'Sign in to see your lessons and register for a place.')+'</p>'+(notice?'<div class="success-note" role="status">'+e(notice)+'</div>':'')+
      '<form class="form" data-account-form="'+(recovery?'password':tab)+'">'+(tab==="signup"&&!recovery?'<div class="form-two"><label>Your name<input name="full_name" required maxlength="60" autocomplete="name"></label><label>Your class<input name="year" required maxlength="24" placeholder="Year 8"></label></div>':'')+
      (!recovery?'<label>Email<input name="email" type="email" required maxlength="254" autocomplete="email" placeholder="you@school.example"></label>':'')+
      (!reset||recovery?'<label>Password<input name="password" type="password" required '+(tab==="signup"||recovery?'minlength="10"':'')+' maxlength="128" autocomplete="'+(tab==="signup"||recovery?'new-password':'current-password')+'">'+(tab==="signup"||recovery?'<small>At least 10 characters.</small>':'')+'</label>':'')+U.error+
      '<button type="submit" class="button purple full">'+(recovery?'Save new password':reset?'Send reset link':tab==="signup"?'Create account':'Sign in')+' ↗</button>'+(tab==="signup"&&!recovery?'<small>Your school admin can see your name, class, email and lesson registrations. Passwords are handled by the sign-in service.</small>':'')+'</form><div class="account-links">'+(reset?'<button type="button" data-account-action="tab" data-tab="signin">Back to sign in</button>':'<button type="button" data-account-action="reset">Forgot password?</button>')+'<a href="./index.html" class="help">Back to Learnst ↗</a></div>';
  }
  document.addEventListener("click",async event=>{
    const button=event.target.closest("[data-account-action]");if(!button)return;
    if(button.dataset.accountAction==="tab"){tab=button.dataset.tab;notice="";render();}
    if(button.dataset.accountAction==="reset"){tab="reset";profile=null;notice="";render();}
    if(button.dataset.accountAction==="signout"){button.disabled=true;try{await C.signOut();}catch(error){U.notify(error.message);}profile=null;tab="signin";render();}
  });
  document.addEventListener("submit",async event=>{
    const form=event.target.closest("[data-account-form]");if(!form)return;event.preventDefault();
    const button=form.querySelector('[type="submit"]'),error=form.querySelector('[data-form-error]');
    if(button.disabled)return;button.disabled=true;error.hidden=true;
    const data=new FormData(form),value=name=>String(data.get(name)||"");
    try{
      switch(form.dataset.accountForm){
        case "signup":{const result=await C.signUp(value("email"),value("password"),value("full_name"),value("year"));if(result.signedIn){profile=await C.profile();}else{tab="signin";notice="Check your inbox to confirm your email. Once confirmed, sign in here. If you already have an account, use Sign in or Forgot password.";}render();break;}
        case "signin":await C.signIn(value("email"),value("password"));profile=await C.profile();render();U.notify("You are signed in. Your lesson plan is ready.");break;
        case "profile":await C.updateProfile(value("full_name"),value("year"));profile=await C.profile();render();U.notify("Your profile is saved.");break;
        case "reset":await C.resetPassword(value("email"));notice="If an account exists for this email, a reset link will arrive in your inbox.";render();break;
        case "password":await C.updatePassword(value("password"));recovery=false;profile=await C.profile();render();U.notify("Your password has been updated.");break;
      }
    }catch(problem){error.textContent=problem.message;error.hidden=false;button.disabled=false;}
  });
  (async()=>{if(C.configured){const callback=await C.consumeRedirect();recovery=callback.recovery;if(C.signedIn())profile=await C.profile();}render();})().catch(error=>{render();U.notify(error.message);});
})();
