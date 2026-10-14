  summary.replaceChildren(line('כיוון מאושר: '+(current.current_direction||'טרם הוגדר')),line('כיוון בבדיקה: '+(current.tentative_direction||'אין כרגע')));
  cards.replaceChildren();
  for(const[k,label]of Object.entries(categories)){
   cards.append(el('h3',label));const rows=current.items.filter(i=>i.category===k);
   if(!rows.length)cards.append(line('טרם הוזנו פרטים.'));else rows.forEach(r=>cards.append(card(r,'item')));
  }
  cards.append(el('h3','מטרות'));current.goals.forEach(r=>cards.append(card(r,'goal')));
 }
 async function load(){
  if(!momentumUser)return;
  current=await get();paintPassport();
  const rows=await call('demo_v1_reminders',{p_email:momentumUser.id});reminders.replaceChildren(el('h3','תזכורות'));
  if(!rows.length)reminders.append(line('אין תזכורות. אפשר לבקש תזכורת בצ׳אט או להוסיף כאן.'));
  rows.forEach(r=>{
   const c=el('section');c.append(el('strong',r.title),line(new Date(r.remind_at).toLocaleString('he-IL')+' — '+(statuses[r.status]||r.status)));
   if(r.body)c.append(line(r.body));
   if(r.status==='pending'){
    const cancel=el('button','ביטול');cancel.onclick=async()=>{try{await call('demo_v1_update_reminder',{p_email:momentumUser.id,p_id:r.id,p_cancel:true,p_remind_at:null});await load();}catch(e){feedback.textContent=errorText(e);}};
    const reschedule=el('button','שינוי מועד');reschedule.onclick=()=>reminderForm(r);c.append(cancel,reschedule);
   }reminders.append(c);
  });
  const create=el('button','הוספת תזכורת');create.onclick=()=>reminderForm();reminders.append(create);
 }
 function field(label,type,value){const wrap=el('label',label);const input=el('input');input.type=type;input.value=value||'';wrap.append(input);form.append(wrap);return input;}
 function select(label,options,value){const wrap=el('label',label),s=el('select');s.style.cssText='display:block;width:100%;padding:8px';Object.entries(options).forEach(([k,v])=>{const o=el('option',v);o.value=k;s.append(o);});if(value)s.value=value;wrap.append(s);form.append(wrap);return s;}
 function buttons(){const submit=el('button','שמירה');submit.type='submit';const cancel=el('button','ביטול עריכה');cancel.type='button';cancel.onclick=()=>{form.hidden=true;editing=null;};form.append(submit,cancel);return submit;}
 function editForm(kind,record){
  form.replaceChildren(el('h3',record?'עריכת פרט':'הוספת פרט'));form.hidden=false;editing=record?.id||kind;
  const category=kind==='item'?select('סוג פרט',categories,record?.category):null;
  const name=field('כותרת','text',record?.title);name.required=true;name.minLength=2;name.maxLength=kind==='direction'?100:120;
  const opts=kind==='direction'?{tentative:'בבדיקה',confirmed:'החלטה מאושרת'}:kind==='goal'?Object.fromEntries(['active','in_progress','completed','superseded','cancelled'].map(k=>[k,statuses[k]])):Object.fromEntries(['active','planned','in_progress','completed','tentative','superseded','archived'].map(k=>[k,statuses[k]]));
  const st=select('מצב',opts,record?.status||(kind==='direction'?'tentative':'active'));
  const detailBox=el('div');form.append(detailBox);let inputs={};
  function detailsForm(){detailBox.replaceChildren();inputs={};for(const k of categoryFields[category.value]){const label=el('label',detailLabels[k]),input=el('input');input.value=record?.details?.[k]||'';input.maxLength=300;label.append(input);detailBox.append(label);inputs[k]=input;}}
  if(category){category.onchange=detailsForm;detailsForm();}
  const targetDate=kind==='goal'?field('תאריך יעד מדויק, אם ידוע','date',record?.target_date):null;
  const targetLabel=kind==='goal'?field('יעד כללי, למשל שנת הלימודים 2027','text',record?.target_label):null;
  const replacedGoals=[];
  if(kind==='direction'){
    const group=el('fieldset');group.append(el('legend','אם זו החלטה חדשה: אילו מטרות היא מחליפה?'));
    for(const goal of (current?.goals||[]).filter(g=>['active','in_progress'].includes(g.status))){
      const label=el('label'),check=el('input');check.type='checkbox';check.style.width='auto';label.append(check,el('span',goal.title));group.append(label);replacedGoals.push({goal,check});
    }
    const toggle=()=>{group.disabled=st.value!=='confirmed';};st.addEventListener('change',toggle);toggle();form.append(group);
  }
  const submit=buttons();
  form.onsubmit=async e=>{
   e.preventDefault();submit.disabled=true;
   try{
    const fresh=await get();
    // Manual edits must not overwrite a record changed while the form was open.
    if(record&&JSON.stringify((kind==='goal'?fresh.goals:fresh.items).find(x=>x.id===record.id))!==JSON.stringify(record))throw Error('REVISION_CONFLICT');
    const c={kind,title:name.value.trim(),status:st.value};if(record)c.id=record.id;
    if(category){c.category=category.value;c.details=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,v.value.trim()]));}
    if(targetDate){c.target_date=targetDate.value||null;c.target_label=targetLabel.value.trim()||null;}
    const changes=[c];
    if(kind==='direction'&&st.value==='confirmed')for(const {goal,check} of replacedGoals)if(check.checked){
      if(JSON.stringify(fresh.goals.find(g=>g.id===goal.id))!==JSON.stringify(goal))throw Error('REVISION_CONFLICT');
      changes.push({kind:'goal',id:goal.id,status:'superseded'});
    }
    await patch(changes,fresh.revision);form.hidden=true;editing=null;await load();feedback.textContent='נשמר בפרופיל.';
   }catch(e){feedback.textContent=errorText(e);}finally{submit.disabled=false;}
  };
 }
 function reminderForm(record){
  form.replaceChildren(el('h3',record?'שינוי מועד התזכורת':'תזכורת חדשה'));form.hidden=false;editing='reminder';
  const name=record?null:field('כותרת','text','');if(name){name.required=true;name.minLength=2;name.maxLength=100;}
  const body=record?null:field('תוכן ההתראה','text','');if(body)body.maxLength=300;
  const local=new Date(record?.remind_at||Date.now()+60000);const localString=new Date(local.getTime()-local.getTimezoneOffset()*60000).toISOString().slice(0,16);
  const at=field('מועד לפי שעון המחשב','datetime-local',localString);at.required=true;
  const goal=record?null:select('מטרה קשורה (רשות)',{'':'ללא',...Object.fromEntries((current?.goals||[]).filter(g=>['active','in_progress'].includes(g.status)).map(g=>[g.id,g.title]))});
  form.append(line('התראת המחשב דורשת אישור התראות והאתר צריך להישאר פתוח.'));
  const submit=buttons(),request=crypto.randomUUID();
  form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{
    const time=new Date(at.value).toISOString();
    if(record)await call('demo_v1_update_reminder',{p_email:momentumUser.id,p_id:record.id,p_cancel:false,p_remind_at:time});
    else await call('demo_v1_save_reminder',{p_email:momentumUser.id,p_request_id:request,p_title:name.value.trim(),p_body:body.value.trim(),p_remind_at:time,p_goal_id:goal.value||null});
    form.hidden=true;editing=null;await load();feedback.textContent='התזכורת נשמרה.';
   }catch(e){feedback.textContent=errorText(e);}finally{submit.disabled=false;}};
 }
 add.onclick=()=>editForm('item');addGoal.onclick=()=>editForm('goal');addDirection.onclick=()=>editForm('direction');refresh.onclick=()=>load().catch(e=>feedback.textContent=errorText(e));
 window.momentumPassport={
  async context(){
    if(!momentumUser)return '';
    try{
      const p=await get();
      return JSON.stringify({current_direction:p.current_direction,tentative_direction:p.tentative_direction,items:p.items.filter(i=>!['superseded','archived'].includes(i.status)),goals:p.goals.filter(g=>!['superseded','cancelled'].includes(g.status))});
    }catch(e){console.warn('Passport context unavailable:',e.message);return '';}
  },
  async open(){panel.hidden=false;feedback.textContent='טוען...';try{await load();feedback.textContent='הפרופיל העדכני נטען מהמערכת.';}catch(e){feedback.textContent=errorText(e);}},
  async extract(){
   if(extracting||S.practice||!momentumUser)return;
   const latest=S.messages.filter(m=>m.role==='user').at(-1);if(!latest?.text)return;
   const text=latest.text.trim();
   if(/אל תשמור|לא לשמור|don't save|do not save/i.test(text)||/צה"ל|צבא|גדוד|פלוג|יחיד|מסווג|סיסמה|תעודת זהות|אבחנה|טראומה|military|classified|password|\b\d{7,}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(text))return;
   const account=momentumUser.id;
   const key='momentum-extracted:'+account+':'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(S.messages.filter(m=>m.role==='user').length+':'+text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   if(localStorage.getItem(key))return;
   extracting=true;
   try{
    const p=await get();
    const system=`Extract civilian Passport changes from the LATEST user statement only. Return ONLY JSON {"changes":[]}. No quotes, hypotheticals, other people's facts or assistant suggestions. Fictional non-sensitive data only. Categories: education,training,experience,skill,language,interest,preference. Operations: {kind:"item",id?:existingUUID,category,title,status,details:{institution?,field?,credential?,start_date?,end_date?,level?,evidence?,location?,availability?,budget?,note?}}, {kind:"goal",id?:existingUUID,title,status,target_date?:"YYYY-MM-DD"|null,target_label?:string|null}, {kind:"direction",title,status:"tentative"|"confirmed"}. Items status active/planned/in_progress/completed/tentative/superseded/archived; goals active/in_progress/completed/superseded/cancelled. Use existing IDs for the same fact or correction, avoiding duplicates. Considering is tentative; completed training is completed; wanting a course is planned or a goal, never proof of a skill. If the user explicitly replaces a direction, mark incompatible existing goals superseded in this same batch; preserve unrelated goals. Don't infer proficiency. Do not invent dates; for year-only goals use target_label. Today is ${new Date().toLocaleDateString('en-CA')}; timezone ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Hebrew labels for Hebrew users. Empty changes if unsupported. Never include military service, health or identifiers. Details max 300 chars each. Maximum 20 changes.`;
    const response=await fetch(CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:CONFIG.MODEL,max_tokens:1500,system,messages:[{role:'user',content:JSON.stringify({existing:{current_direction:p.current_direction,tentative_direction:p.tentative_direction,items:p.items,goals:p.goals},latest_statement:text})}]})});
    if(!response.ok)throw Error('Extraction HTTP '+response.status);
    const data=await response.json(),raw=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
    const parsed=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
    if(!Array.isArray(parsed.changes))throw Error('Invalid extraction response');
    if(momentumUser?.id!==account)return;
    if(parsed.changes.length)await patch(parsed.changes,p.revision);
    localStorage.setItem(key,'1');
    const note=document.getElementById('momentum-sync-note');note.textContent=parsed.changes.length?'הפרופיל עודכן מהשיחה.':'אין פרטים חדשים לשמירה.';
    if(!panel.hidden&&!editing)await load();
   }catch(e){document.getElementById('momentum-sync-note').textContent='עדכון הפרופיל לא נשמר: '+errorText(e);}
   finally{extracting=false;}
  }
 };
 const note=el('p');note.id='momentum-sync-note';note.setAttribute('role','status');note.style.cssText='position:fixed;bottom:45px;right:12px;z-index:999;font:12px Arial;max-width:300px;background:white';document.body.append(note);
 setInterval(()=>{if(!panel.hidden&&!editing&&momentumUser)load().catch(e=>feedback.textContent=errorText(e));},5000);
})();
