(function(global){
  "use strict";
  const C=global.LearnstCloud,U=global.LearnstUI,D=global.LearnstData,e=U.escape;
  if(!C||!U||!D)return;
  function start(){
    const root=document.getElementById("app"),dialog=document.getElementById("modal");
    const state={catalog:[],registrations:[],profile:null,school:C.schoolName,loading:true,error:""};
    const filter={subject:"all",mode:"all",view:"open"};let week=0,initialWeek=false,fetching=false;
    const subject=id=>U.subject(id),tag=id=>'<span class="tag '+e(subject(id).color)+'">'+e(subject(id).name)+'</span>';
    const registered=id=>state.registrations.find(item=>item.lesson_id===id&&item.status==="active");
    const lesson=id=>state.catalog.find(item=>item.id===id)||(state.registrations.find(item=>item.lesson_id===id)||{}).lesson;
    const heading=(over,title,text)=>'<div class="page-heading"><div><span class="eyebrow">'+e(over)+'</span><h1>'+e(title)+'</h1><p>'+e(text)+'</p></div><button type="button" class="button outline small" data-live-action="refresh">Refresh ↻</button></div>';
    const route=()=>["find","schedule","lessons","workspace"].includes(location.hash.slice(1))?location.hash.slice(1):"find";
    const empty=(title,text,button)=>'<div class="empty"><h3>'+e(title)+'</h3><p>'+e(text)+'</p>'+(button||'')+'</div>';
    function schoolToday(){return U.when(new Date().toISOString()).date;}
    function monday(){const today=schoolToday(),day=new Date(today+'T12:00:00Z').getUTCDay();return D.addDays(today,-((day+6)%7)+week*7);}
    function go(name){U.closeModal();if(location.hash==="#"+name)render();else location.hash=name;window.scrollTo({top:0,behavior:"instant"});}
    function filtered(items){return items.filter(item=>(filter.subject==="all"||item.subject===filter.subject)&&(filter.mode==="all"||item.mode===filter.mode));}
    function choices(){return '<div class="live-filter-bar"><div class="chips" aria-label="Subjects">'+[{id:"all",name:"All subjects"},...D.SUBJECTS].map(item=>'<button type="button" class="chip" data-live-action="subject" data-id="'+e(item.id)+'" aria-pressed="'+(filter.subject===item.id)+'">'+e(item.name)+'</button>').join('')+'</div><select class="select" id="live-mode" aria-label="Lesson format">'+[['all','Any format'],['campus','On campus'],['online','Online']].map(item=>'<option value="'+item[0]+'"'+(filter.mode===item[0]?' selected':'')+'>'+item[1]+'</option>').join('')+'</select></div>';}
    function card(item){
      const time=U.when(item.starts_at),end=U.when(item.ends_at),count=Number(item.registered_count)||0,full=count>=item.capacity,own=!!registered(item.id),past=Date.parse(item.starts_at)<=Date.now();
      return '<article class="live-lesson-card">'+tag(item.subject)+'<h3>'+e(item.title)+'</h3><p class="live-teacher">With '+e(item.teacher_name)+'</p><p class="live-time">'+e(time.label)+' · '+e(time.time)+'–'+e(end.time)+'</p><p class="live-place">'+e(item.location)+' · '+(item.mode==='online'?'Online':'On campus')+'</p><p class="live-description">'+e(item.description)+'</p><div class="capacity-line"><span>'+count+' / '+item.capacity+' registered</span><strong>'+Math.max(0,item.capacity-count)+' places left</strong></div><div class="capacity-bar"><span style="width:'+Math.min(100,100*count/item.capacity)+'%"></span></div><button type="button" class="button '+(own?'outline':'purple')+' full" data-live-action="lesson" data-id="'+e(item.id)+'">'+(own?'✓ You are registered':past?'View lesson':full?'View full lesson':'Register for this lesson ↗')+'</button></article>';
    }
    function home(){
      const items=filtered(state.catalog);
      return '<section class="hero"><div class="hero-copy"><span class="eyebrow">'+e(state.school)+' · YOUR PEOPLE</span><h1>A little help.<br>A lot more<br><span>confidence.</span></h1><p>Science, English or Maths. Find your lesson, choose a friendly face and turn “I can’t” into “I’ve got this.”</p><div class="hero-buttons"><button type="button" class="button purple" data-live-action="find">Find my lesson ↗</button><a class="button text" href="./account.html">'+(state.profile?'My account':'Create an account')+' →</a></div><div class="hero-footnote"><span class="mini-avatars" aria-hidden="true"><i>S</i><i>E</i><i>M</i></span><span>One good question can change everything.<br><strong>A little time. A real place on the list.</strong></span></div></div><div class="hero-art"><div class="art-grid"></div><span class="art-star" aria-hidden="true">✳</span><div class="art-float">Aha! I get it.</div><img src="./assets/hero.svg" width="470" height="330" alt="Two students learning together"><div class="art-session"><i aria-hidden="true">✳</i><div><small>YOUR NEXT LIGHTBULB MOMENT</small><strong>“See you at four?”</strong><span>A subject. A friendly face. A plan.</span></div><b aria-hidden="true">✓</b></div><span class="art-note">better, together. ↗</span></div></section><section class="section" id="school-lessons"><div class="live-student-heading"><div><span class="eyebrow">FIND YOUR “AHA!” MOMENT</span><h2>What are we figuring out?</h2><p>Choose a lesson and save your place.</p></div><a href="#schedule" class="button outline small">Open timetable ↗</a></div>'+choices()+(items.length?'<div class="live-lesson-grid">'+items.map(card).join('')+'</div>':empty('A little learning is on its way.','Your school admin can publish lesson times on the admin page. Try another filter if lessons are already listed.'))+'</section><section class="how"><div class="how-grid"><article class="how-card"><div>01</div><h3>Create your account</h3><p>Add your name and class, then confirm your email.</p></article><article class="how-card"><div>02</div><h3>Find your lesson</h3><p>Choose Science, English or Maths at a time that works for you.</p></article><article class="how-card"><div>03</div><h3>Save your place</h3><p>Your registration goes straight to the shared school list.</p></article></div></section>';
    }
    function timetableEvent(item){const time=U.when(item.starts_at),own=!!registered(item.id);return '<button type="button" class="slot timetable-event '+e(subject(item.subject).color)+'" data-live-action="lesson" data-id="'+e(item.id)+'"><strong>'+e(subject(item.subject).name)+'</strong><span>'+e(time.time)+' · '+e(item.title)+'</span><span>'+e(item.teacher_name)+'</span><span class="event-status">'+(own?'✓ Registered':Math.max(0,item.capacity-(Number(item.registered_count)||0))+' places left')+'</span></button>';}
    function timetable(){
      const first=monday(),dates=Array.from({length:7},(_,i)=>D.addDays(first,i));
      const all=filter.view==='mine'?state.registrations.filter(item=>item.status==='active'&&item.lesson.status==='published').map(item=>item.lesson):state.catalog;
      const items=filtered(all).filter(item=>{const date=U.when(item.starts_at).date;return date>=first&&date<=dates[6];});
      const eventHours=items.map(item=>Number(U.when(item.starts_at).time.slice(0,2))),low=Math.min(14,...eventHours),high=Math.max(18,...eventHours),hours=Array.from({length:high-low+1},(_,i)=>String(low+i).padStart(2,'0')+':00');
      const weekday=date=>new Intl.DateTimeFormat('en-GB',{timeZone:'UTC',weekday:'short'}).format(new Date(date+'T12:00:00Z'));
      const rows=hours.map(hour=>'<tr><th scope="row" class="time-axis">'+hour+'</th>'+dates.map(date=>{const group=items.filter(item=>{const time=U.when(item.starts_at);return time.date===date&&time.time===hour;});return '<td>'+group.slice(0,2).map(timetableEvent).join('')+(group.length>2?'<button type="button" class="timetable-more" data-live-action="day" data-date="'+date+'" data-hour="'+hour+'">+'+(group.length-2)+' more</button>':'')+(group.length?'':'<span class="empty-cell" aria-hidden="true">·</span>')+'</td>';}).join('')+'</tr>').join('');
      const agenda=dates.map(date=>{const group=items.filter(item=>U.when(item.starts_at).date===date);return '<section class="agenda-day"><h2>'+e(weekday(date))+'<span>'+e(D.shortDate(date,false))+'</span></h2>'+group.slice(0,4).map(timetableEvent).join('')+(group.length>4?'<button type="button" class="timetable-more" data-live-action="day" data-date="'+date+'">View all '+group.length+' lessons ↗</button>':'')+(group.length?'':'<p class="no-slots">No lessons planned</p>')+'</section>';}).join('');
      return heading('A LITTLE TIME. A LITTLE PROGRESS.','Your timetable.','Science, English and Maths. All times are in Bishkek time.')+'<section class="page-content"><div class="tab-row"><button type="button" data-live-action="view" data-id="open" aria-pressed="'+(filter.view==='open')+'">All lessons</button><button type="button" data-live-action="view" data-id="mine" aria-pressed="'+(filter.view==='mine')+'">My registrations</button></div>'+choices()+'<div class="timetable-shell"><div class="calendar-toolbar"><div><button type="button" class="icon-button" data-live-action="week-prev" aria-label="Previous week"'+(week<=-16?' disabled':'')+'>‹</button><button type="button" class="icon-button" data-live-action="week-next" aria-label="Next week"'+(week>=16?' disabled':'')+'>›</button><h2>'+e(D.shortDate(first,false))+' — '+e(D.shortDate(dates[6],false))+'</h2></div><div><button type="button" class="button outline small" data-live-action="week-now">This week</button><span class="timezone">Bishkek · UTC+6</span></div></div><p class="timetable-summary"><strong>'+items.length+'</strong> lessons this week · select a lesson to see details.</p><table class="timetable-grid"><caption class="sr-only">Weekly school lesson timetable, Bishkek time</caption><thead><tr><th scope="col" class="time-axis">Time</th>'+dates.map(date=>'<th scope="col"><span>'+e(weekday(date))+'</span><b>'+Number(date.slice(-2))+'</b><small>'+e(D.shortDate(date,false).split(' ').slice(1).join(' '))+'</small></th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table><div class="timetable-agenda">'+agenda+'</div></div><p class="help timetable-note">Registrations are saved in the shared school database. Refresh to see the latest places available.</p></section>';
    }
    function myLessons(){
      if(!state.profile)return heading('YOUR LITTLE LEARNING PLAN','My lessons.','Your registrations will appear here.')+empty('Your place starts with an account.','Sign in to see your own lessons from any device.','<a class="button purple" href="./account.html">Sign in / Create account ↗</a>');
      return heading('YOUR LITTLE LEARNING PLAN','My lessons.','Your subject, tutor, time and place. Saved to your school account.')+'<section class="page-content"><div class="live-enrolments">'+(state.registrations.length?state.registrations.map(reg=>{const item=reg.lesson,time=U.when(item.starts_at),active=reg.status==='active'&&item.status==='published';return '<article class="live-enrolment"><div>'+tag(item.subject)+'<h3>'+e(item.title)+'</h3><p>With '+e(item.teacher_name)+'</p><p>'+e(time.label)+' · '+e(time.time)+'–'+e(U.when(item.ends_at).time)+' · Bishkek</p><p>'+e(item.location)+'</p>'+(reg.note?'<div class="lesson-note"><strong>Your question</strong>'+e(reg.note)+'</div>':'')+'</div><div><span class="status '+(active?'confirmed':'cancelled')+'">'+(active?'Registered':'Cancelled')+'</span>'+(active&&Date.parse(item.starts_at)>Date.now()?'<button type="button" class="button outline small" data-live-action="cancel" data-id="'+e(reg.id)+'">Cancel my place</button>':'')+'</div></article>';}).join(''):empty('One good question is a start.','Choose a lesson to register for your first place.','<a class="button purple" href="#find">Find a lesson ↗</a>'))+'</div></section>';
    }
    function workspace(){return heading('FOR THE PEOPLE WHO MAKE IT HAPPEN','A community worth growing.','Your school admin publishes lessons and manages the registration list.')+empty('Helping the helpers.','The separate school dashboard shows registration counts and each lesson’s student list. Access is checked by the shared database.','<a class="button purple" href="./admin.html">Open school admin ↗</a>');}
    function render(){
      const name=route();document.title='Learnst · '+({find:'Learn together',schedule:'Timetable',lessons:'My lessons',workspace:'School workspace'})[name];
      document.querySelectorAll('[data-route]').forEach(link=>{if(link.dataset.route===name)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');});
      document.getElementById('profile-button').textContent=state.profile?state.profile.full_name.split(' ')[0]:'Sign in / Register';
      root.innerHTML=(state.error?'<p class="notice" role="alert">'+e(state.error)+'</p>':'')+(state.loading?'<p class="cloud-loading" role="status">Opening the school timetable…</p>':name==='find'?home():name==='schedule'?timetable():name==='lessons'?myLessons():workspace());
    }
    async function refresh(){
      if(fetching)return;fetching=true;
      try{
        const values=await Promise.all([C.catalog(),C.school()]);state.catalog=values[0]||[];state.school=values[1]&&values[1].school_name||C.schoolName;
        if(C.signedIn()){const privateData=await Promise.all([C.profile(),C.myRegistrations()]);state.profile=privateData[0];state.registrations=privateData[1]||[];}else{state.profile=null;state.registrations=[];}
        if(!initialWeek&&state.catalog.length){const today=schoolToday(),day=new Date(today+'T12:00:00Z').getUTCDay(),first=D.addDays(today,-((day+6)%7));week=Math.min(16,Math.max(0,Math.floor((Date.parse(U.when(state.catalog[0].starts_at).date+'T12:00:00Z')-Date.parse(first+'T12:00:00Z'))/604800000)));initialWeek=true;}
        state.error='';
      }catch(error){state.error=error.message;}finally{fetching=false;state.loading=false;if(!dialog.open)render();}
    }
    function showLesson(id){
      const item=lesson(id);if(!item)return;
      const time=U.when(item.starts_at),own=registered(id),full=Number(item.registered_count)>=item.capacity,started=Date.parse(item.starts_at)<=Date.now();
      U.modal('<span class="eyebrow">'+e(subject(item.subject).name)+'</span><h2 id="modal-title">'+e(item.title)+'</h2><div class="registration-summary"><p>With '+e(item.teacher_name)+'</p><p>'+e(time.label)+' · '+e(time.time)+'–'+e(U.when(item.ends_at).time)+' · Bishkek</p><p>'+e(item.location)+'</p><p>'+e(item.description)+'</p></div>'+(own?'<div class="success-note">✓ Your place is registered. Your school admin can see you on this lesson’s list.</div>':!state.profile?'<p class="modal-lead">Sign in or create an account to save your place.</p><a class="button purple full" href="./account.html">Sign in / Create account ↗</a>':full||started?'<p class="notice">'+(started?'This lesson has already started.':'This lesson is full. Please choose another time.')+'</p>':'<form class="form" data-live-form="register" data-id="'+e(id)+'"><p class="help">Registering as '+e(state.profile.full_name)+' · '+e(state.profile.year)+'</p><label>What would you like help with?<textarea name="note" maxlength="600" placeholder="A topic, a question or a little context."></textarea></label>'+U.error+'<button type="submit" class="button purple full">Register my place ↗</button><small>Your name, class, email and question will be visible to the school admin.</small></form>'));
    }
    document.addEventListener('click',async event=>{
      if(event.target.closest('#profile-button')){location.href='./account.html';return;}
      const button=event.target.closest('[data-live-action], [data-action="close"], .skip-link');if(!button)return;
      if(button.matches('.skip-link')){event.preventDefault();document.getElementById('main').focus();return;}
      const action=button.dataset.liveAction||(button.dataset.action==='close'?'close':'');
      try{
        if(action==='close')U.closeModal();
        if(action==='refresh'){button.disabled=true;await refresh();}
        if(action==='find')document.getElementById('school-lessons').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
        if(action==='subject'){filter.subject=button.dataset.id;render();}
        if(action==='view'){filter.view=button.dataset.id;render();}
        if(action==='lesson')showLesson(button.dataset.id);
        if(action==='week-prev'){week=Math.max(-16,week-1);render();}
        if(action==='week-next'){week=Math.min(16,week+1);render();}
        if(action==='week-now'){week=0;render();}
        if(action==='day'){const all=filter.view==='mine'?state.registrations.filter(item=>item.status==='active').map(item=>item.lesson):state.catalog;U.modal('<span class="eyebrow">YOUR SCHOOL TIMETABLE</span><h2 id="modal-title">'+e(D.shortDate(button.dataset.date))+'</h2><div class="day-slots">'+filtered(all).filter(item=>{const t=U.when(item.starts_at);return t.date===button.dataset.date&&(!button.dataset.hour||t.time===button.dataset.hour);}).map(timetableEvent).join('')+'</div>');}
        if(action==='cancel')U.modal('<span class="eyebrow">YOUR LEARNING PLAN</span><h2 id="modal-title">Cancel your place?</h2><p class="modal-lead">Your place becomes available for another student. The cancelled registration stays in your history.</p><form class="form" data-live-form="cancel" data-id="'+e(button.dataset.id)+'">'+U.error+'<button class="button danger full" type="submit">Cancel my place</button></form>');
      }catch(error){U.notify(error.message);}
    });
    document.addEventListener('change',event=>{if(event.target.id==='live-mode'){filter.mode=event.target.value;render();}});
    document.addEventListener('submit',async event=>{
      const form=event.target.closest('[data-live-form]');if(!form)return;event.preventDefault();
      const button=form.querySelector('[type="submit"]'),error=form.querySelector('[data-form-error]');if(button.disabled)return;button.disabled=true;error.hidden=true;
      try{if(form.dataset.liveForm==='register')await C.register(form.dataset.id,String(new FormData(form).get('note')||''));else await C.cancelRegistration(form.dataset.id);U.closeModal();await refresh();go('lessons');U.notify(form.dataset.liveForm==='register'?'Your place is registered. The school admin can see your booking.':'Your place has been cancelled.');}catch(problem){error.textContent=problem.message;error.hidden=false;button.disabled=false;}
    });
    dialog.addEventListener('click',event=>{if(event.target===dialog)U.closeModal();});
    window.addEventListener('hashchange',()=>{U.closeModal();render();});
    const bar=document.querySelector('.local-bar .wrap');if(bar)bar.innerHTML='<span><i aria-hidden="true"></i><strong>School registrations</strong><span class="bar-detail">Shared timetable · saved to your account</span></span><a href="./account.html" class="button text small">Account ↗</a>';
    const warning=document.getElementById('storage-warning');if(warning)warning.hidden=true;
    const setupNote=document.getElementById('cloud-setup-note');if(setupNote)setupNote.hidden=true;
    document.querySelectorAll('.workspace-link').forEach(link=>{link.textContent='School admin ↗';link.href='./admin.html';});
    document.querySelectorAll('.footer button').forEach(button=>{const link=document.createElement('a');link.href='./account.html';link.textContent='My account';button.replaceWith(link);});
    render();refresh();setInterval(()=>{if(!document.hidden&&!dialog.open)refresh();},20000);
  }
  global.LearnstStudent=Object.freeze({start});
})(window);
