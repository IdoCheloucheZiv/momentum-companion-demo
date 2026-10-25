/* Shared civilian Passport editor and atomic app updates. Fictional demo only. */
(() => {
 const categories={education:'השכלה',training:'הכשרות והסמכות',experience:'ניסיון אזרחי',skill:'כישורים',language:'שפות',interest:'תחומי עניין',preference:'העדפות ואילוצים'};
 const statuses={active:'פעיל',planned:'מתוכנן',in_progress:'בתהליך',completed:'הושלם',tentative:'בבדיקה',superseded:'הוחלף',archived:'בארכיון',cancelled:'בוטל',pending:'ממתין',delivered:'נמסר לדפדפן'};
 const detailLabels={institution:'מוסד / גוף',field:'תחום',credential:'תואר / תעודה',start_date:'מועד התחלה',end_date:'מועד סיום',level:'רמת שליטה',evidence:'דוגמה תומכת',location:'מיקום רצוי',availability:'זמינות',budget:'תקציב',note:'הערה'};
 const categoryFields={education:['institution','field','credential','start_date','end_date'],training:['institution','credential','end_date'],experience:['institution','start_date','end_date','evidence'],skill:['level','evidence'],language:['level'],interest:['note'],preference:['location','availability','budget','note']};
 const situationOptions={employment_status:{'':'טרם נמסר',employed:'עובד/ת',job_seeking:'מחפש/ת עבודה',self_employed:'עצמאי/ת',not_working:'לא עובד/ת כרגע',unknown:'לא ידוע'},work_scope:{'':'טרם נמסר',full_time:'משרה מלאה',part_time:'משרה חלקית',occasional:'עבודה מזדמנת',unknown:'לא ידוע'},current_study_status:{'':'טרם נמסר',not_studying:'לא לומד/ת כרגע',preparing:'מתכונן/ת ללימודים',enrolled:'נרשמתי ללימודים',studying:'לומד/ת כרגע',unknown:'לא ידוע'},transition_stage:{'':'טרם נמסר',before_release:'לפני שחרור',released:'אחרי שחרור',unknown:'לא ידוע'}};
 const situationLabels={age:'גיל',employment_status:'מצב תעסוקתי',work_scope:'היקף עבודה',current_study_status:'מצב לימודים',transition_stage:'שלב המעבר',release_date:'מועד שחרור',release_time_estimate:'זמן מהשחרור לפי דיווח',available_from:'זמינות מתאריך',availability_label:'זמינות כללית'};
 let current, editing=null, extracting=false, extractionPending=false;
 function civilianFragments(value){
  if(typeof value!=='string')return '';
  if(/אל תשמור|לא לשמור|don't save|do not save/i.test(value))return '';
  const cleaned=value.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'__PRIVATE__').replace(/\b\d{7,}\b/g,'__PRIVATE__').replace(/(?:^|\n)\s*(?:היי[ ,]*)?אני\s+[\p{L}]+\s+ו(?=אני|רוצה)/gu,'');
  const parts=cleaned.split(/(?<!\d)\.|\.(?!\d)|[!?;\n]+|,\s*|\s+(?=(?:ו)?אני\s+(?:רוצה|מתכנ|עובד|מחפש|לומד|לא עובד|סיימתי))/u);
  const blocked=/__PRIVATE__|צה[״"]?ל|צבא|גדוד|פלוג|יחיד|מסווג|סיסמה|תעודת זהות|אבחנה|טראומה|כתובת|שמי |השם שלי|military|classified|password|battalion|combat|\b\d{7,}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
  return parts.map(t=>t.trim()).filter(t=>t&&!blocked.test(t)).join('. ').slice(0,1500);
 }
 const panel=document.getElementById('momentum-passport-panel');
 panel.querySelector('.panel-inner').style.maxWidth='760px';
 const inner=panel.querySelector('.panel-inner');inner.replaceChildren();
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
 const title=el('h2','ה-Passport שלי');const close=el('button','סגור');close.onclick=()=>panel.hidden=true;
 const warning=el('p','דמו — מידע פיקטיבי אזרחי בלבד. מייל אינו אימות זהות. כל הפרטים מבוססים על דיווח המשתמש.');
 const feedback=el('p');feedback.setAttribute('role','status');
 const summary=el('div'),cards=el('div'),reminders=el('div'),form=el('form');form.hidden=true;
 const situationButton=el('button','עדכון מצב נוכחי'),catchupButton=el('button','סנכרון הפרופיל מהשיחה');
 const add=el('button','הוספת פרט לפרופיל'),addGoal=el('button','הוספת מטרה'),addDirection=el('button','עדכון כיוון'),refresh=el('button','רענון');
 inner.append(title,close,warning,feedback,summary,situationButton,catchupButton,add,addGoal,addDirection,refresh,form,cards,reminders);
 async function call(fn,args){const{data,error}=await momentumClient.rpc(fn,args);if(error)throw error;return data;}
 async function get(){return call('demo_v1_get_passport',{p_email:momentumUser.id});}
 async function patch(changes,revision,request=crypto.randomUUID()){
   return call('demo_v1_update_passport',{p_email:momentumUser.id,p_revision:revision,p_request_id:request,p_source:'app',p_changes:changes});
 }
 function errorText(e){return String(e.message||e).includes('REVISION_CONFLICT')?'הפרופיל השתנה בינתיים. רענן ובדוק את השינוי לפני שמירה נוספת.':String(e.message||e);}
 function line(text){return el('p',text);}
 function card(record,kind){
  const node=el('section');node.style.cssText='border:1px solid #ddd;padding:10px;border-radius:8px;margin:8px 0';
  node.append(el('strong',record.title),line(statuses[record.status]||record.status));
  if(kind==='item')Object.entries(record.details||{}).forEach(([k,v])=>{if(v&&detailLabels[k])node.append(line(detailLabels[k]+': '+v));});
  else if(record.target_label||record.target_date)node.append(line('יעד: '+(record.target_label||record.target_date)));
  const edit=el('button','עריכה');edit.onclick=()=>editForm(kind,record);node.append(edit);return node;
 }
 function paintPassport(){
  summary.replaceChildren(line('כיוון מאושר: '+(current.current_direction||'טרם הוגדר')),line('כיוון בבדיקה: '+(current.tentative_direction||'אין כרגע')));
  summary.append(el('h3','מצב נוכחי'));
  for(const[k,label]of Object.entries(situationLabels)){
   const value=current[k];let text=situationOptions[k]?.[value]||value||'טרם נמסר';
   if(k==='release_date'&&value){text=current.release_date_precision==='month'?value.slice(0,7):current.release_date_precision==='year'?value.slice(0,4):value;}
   summary.append(line(label+': '+text));
  }
  const since=current.time_since_release;
  if(since?.days!==undefined)summary.append(line('זמן מהשחרור: '+since.days+' ימים (מחושב להיום)'));
  else if(since?.from)summary.append(line('אחרי שחרור מאז '+since.from+' (המועד נמסר ברמת '+(since.precision==='month'?'חודש':'שנה')+')'));
  else if(since?.estimate)summary.append(line('הערכה שנמסרה: '+since.estimate+(since.recorded_at?' — נכון ל־'+new Date(since.recorded_at).toLocaleDateString('he-IL'):'')));
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
 function editSituation(){
  form.replaceChildren(el('h3','עדכון מצב נוכחי'));form.hidden=false;editing='situation';const snapshot=structuredClone(current),inputs={};
  inputs.age=field('גיל','number',current.age);inputs.age.min='16';inputs.age.max='100';inputs.age.step='1';
  for(const[k,options]of Object.entries(situationOptions))inputs[k]=select(situationLabels[k],options,current[k]||'');
  inputs.release_date=field('תאריך שחרור — רק אם ידוע','date',current.release_date);
  inputs.release_date_precision=select('דיוק מועד השחרור',{day:'יום מדויק',month:'חודש בלבד',year:'שנה בלבד'},current.release_date_precision||'day');
  form.append(line('אם ידוע רק חודש או שנה, בחר את היום הראשון שלהם וסמן את רמת הדיוק. התאריך לא יוצג כיום מדויק.'));
  inputs.release_time_estimate=field('הערכה כשאין תאריך, למשל לפני כחצי שנה','text',current.release_time_estimate);
  inputs.available_from=field('זמינות מתאריך מדויק, אם ידוע','date',current.available_from);
  inputs.availability_label=field('זמינות כללית, למשל בעוד חודש','text',current.availability_label);
  const submit=buttons();form.onsubmit=async e=>{e.preventDefault();submit.disabled=true;try{
   const fresh=await get(),fields={};for(const[k,input]of Object.entries(inputs)){
    if((fresh[k]??null)!==(snapshot[k]??null))throw Error('REVISION_CONFLICT');
    fields[k]=k==='age'?(input.value?Number(input.value):null):(input.value.trim()||null);
   }
   if(!fields.release_date)fields.release_date_precision=null;
   else if(fields.release_date_precision==='month')fields.release_date=fields.release_date.slice(0,7)+'-01';
   else if(fields.release_date_precision==='year')fields.release_date=fields.release_date.slice(0,4)+'-01-01';
   await patch([{kind:'situation',fields}],fresh.revision);form.hidden=true;editing=null;await load();feedback.textContent='המצב הנוכחי נשמר.';
  }catch(e){feedback.textContent=errorText(e);}finally{submit.disabled=false;}};
 }
 situationButton.onclick=editSituation;
 catchupButton.onclick=()=>window.momentumPassport.extract({catchUp:true});
 add.onclick=()=>editForm('item');addGoal.onclick=()=>editForm('goal');addDirection.onclick=()=>editForm('direction');refresh.onclick=()=>load().catch(e=>feedback.textContent=errorText(e));
 window.momentumPassport={
  async context(){
    if(!momentumUser)return '';
    try{
      const p=await get();
      return JSON.stringify({situation:Object.fromEntries(Object.keys(situationLabels).map(k=>[k,p[k]])),release_date_precision:p.release_date_precision,time_since_release:p.time_since_release,current_direction:p.current_direction,tentative_direction:p.tentative_direction,items:p.items.filter(i=>!['superseded','archived'].includes(i.status)),goals:p.goals.filter(g=>!['superseded','cancelled'].includes(g.status))});
    }catch(e){console.warn('Passport context unavailable:',e.message);return '';}
  },
  async open(){panel.hidden=false;feedback.textContent='טוען...';try{await load();feedback.textContent='הפרופיל העדכני נטען מהמערכת.';}catch(e){feedback.textContent=errorText(e);}},
  sanitize:civilianFragments,
  async extract({catchUp=false,preview=false}={}){
   if(S.practice||!momentumUser)return;
   if(extracting){if(preview)throw Error('עדכון אחר עדיין מתבצע. נסה שוב.');extractionPending=true;return;}
   const lastIndex=S.messages.findLastIndex(m=>m.role==='user');if(lastIndex<0)return;
   const latest=S.messages[lastIndex],text=latest.localOnly?'':civilianFragments(latest.text);
   if(!text&&!catchUp){document.getElementById('momentum-sync-note').textContent='לא נמצא מידע אזרחי לשמירה בהודעה זו.';return;}
   if(/אל תשמור|לא לשמור|don't save|do not save/i.test(latest.text||''))return;
   const account=momentumUser.id;
   const key='momentum-extracted-v11:'+account+':'+Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode((catchUp?'catchup:':'latest:')+S.messages.filter(m=>m.role==='user').length+':'+text)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   if(!preview&&localStorage.getItem(key))return {success:true,changes:[]};
   const context=S.messages.slice(0,lastIndex).filter(m=>!m.localOnly&&(m.role==='user'||m.role==='assistant')).slice(-8).map(m=>{
    if(m.role==='assistant'){
      const q=(m.text||'').match(/[^.!?\n]{1,220}\?/g)?.at(-1)||'';
      return {role:'assistant_question_only',text:civilianFragments(q)};
    }
    return {role:'user',text:civilianFragments(m.text)};
   }).filter(m=>m.text);
   extracting=true;document.getElementById('momentum-sync-note').textContent='מעדכן את הפרופיל מהשיחה...';
   try{
    let attempt=0;
    while(true){
     const p=await get();
     const system=`Extract civilian Passport changes from ${catchUp?'the sanitized USER statements in the supplied conversation, respecting the latest correction':'the LATEST user statement; previous statements and assistant questions only clarify short replies'}. Return ONLY JSON {"changes":[]}. Assistant questions are NOT evidence about the user; never infer skills from assistant suggestions. No quotes, hypotheticals or other people's facts. Fictional non-sensitive data only. Categories: education,training,experience,skill,language,interest,preference. Operations: {kind:"item",id?:existingUUID,category,title,status,details:{institution?,field?,credential?,start_date?,end_date?,level?,evidence?,location?,availability?,budget?,note?}}, {kind:"goal",id?:existingUUID,title,status,target_date?:"YYYY-MM-DD"|null,target_label?:string|null}, {kind:"direction",title,status:"tentative"|"confirmed"}, {kind:"situation",fields:{age?:integer|null,employment_status?:"employed"|"job_seeking"|"self_employed"|"not_working"|"unknown"|null,work_scope?:"full_time"|"part_time"|"occasional"|"unknown"|null,current_study_status?:"not_studying"|"preparing"|"enrolled"|"studying"|"unknown"|null,transition_stage?:"before_release"|"released"|"unknown"|null,release_date?:"YYYY-MM-DD"|null,release_date_precision?:"day"|"month"|"year"|"estimated"|null,release_time_estimate?:string|null,available_from?:"YYYY-MM-DD"|null,availability_label?:string|null}}. Save already discharged as released; never guess the date, employment or education from that. A short 'not yet' after a psychometric question means no exam yet; a goal/interest may record psychometric preparation only if the user actually plans it, not merely because the assistant suggested it. A short 'still open' after a university question indicates institution undecided, not lack of education. Items status active/planned/in_progress/completed/tentative/superseded/archived; goals active/in_progress/completed/superseded/cancelled. Use existing IDs for corrections and do not repeat unchanged facts. Considering is tentative; an explicit chosen study path is confirmed. 'I want to study psychology in a year' is an intended study direction and a goal; do not mark enrolled. Completed training is not proof of proficiency. If the user explicitly replaces a direction, mark clearly incompatible old goals superseded in the same batch. Do not infer qualification. For relative dates resolve from the current date; year-only goals use target_label, not an invented day. For relative time since discharge preserve the user's estimate in release_time_estimate instead of inventing an exact date. For month/year-only release_date use a representative first day with explicit month/year precision. Today is ${new Date().toLocaleDateString('en-CA')}; timezone ${Intl.DateTimeFormat().resolvedOptions().timeZone}. Hebrew labels for Hebrew users. Save current age only when personally stated. During onboarding, use the preceding questionnaire question to interpret the answer. Prior-work answers belong to civilian experience with note "לפני השירות". Never include military details, units, roles, names, health or identifiers. For onboarding goals, uncertainty alone is NOT a goal or direction: return empty changes for it. Explicit near-term intentions such as temporary work, saving for a trip, rest or exploring options can be active goals without a long-term career decision. Preserve tentative wording; never turn rest or travel into a permanent career direction. Use the preceding question only to interpret the stated time horizon, never to choose an activity for the user. Empty changes if unsupported. Maximum 20 changes.`;
     const existing={...p};delete existing.email;
     const response=await fetch(CONFIG.API_URL,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:CONFIG.MODEL,max_tokens:2000,system,messages:[{role:'user',content:JSON.stringify({existing,context,latest_statement:text})}]})});
     if(!response.ok)throw Error('Extraction HTTP '+response.status);
     const data=await response.json(),raw=(data.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('\n').trim();
     const parsed=JSON.parse(raw.replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));
     if(!Array.isArray(parsed.changes))throw Error('Invalid extraction response');
     if(momentumUser?.id!==account)return;
     if(preview)return {success:true,changes:parsed.changes,revision:p.revision};
     try{if(parsed.changes.length)await patch(parsed.changes,p.revision);}catch(e){
      if(String(e.message||e).includes('REVISION_CONFLICT')&&attempt++<1)continue;
      throw e;
     }
     localStorage.setItem(key,'1');
     document.getElementById('momentum-sync-note').textContent=parsed.changes.length?'הפרופיל עודכן מהשיחה.':'אין פרטים חדשים לשמירה.';
     if(!panel.hidden&&!editing)await load();break;
    }
   }catch(e){if(preview)throw e;document.getElementById('momentum-sync-note').textContent='עדכון הפרופיל לא נשמר: '+errorText(e)+' — אפשר לנסות שוב דרך ״סנכרון הפרופיל מהשיחה״.';}
   finally{extracting=false;if(extractionPending){extractionPending=false;void window.momentumPassport.extract();}}
  }

 };
 const note=el('p');note.id='momentum-sync-note';note.setAttribute('role','status');note.style.cssText='position:fixed;bottom:45px;right:12px;z-index:999;font:12px Arial;max-width:300px;background:white';document.body.append(note);
 setInterval(()=>{if(!panel.hidden&&!editing&&momentumUser)load().catch(e=>feedback.textContent=errorText(e));},5000);
})();

/* Onboarding progress is persisted; raw service answers stay on device. */
(() => {
 let state=null, active=false, busy=false, step=null;
 const originalSend=sendUser;
 function translateService(text){
  const rules=[[/פיקד|מפקד|ניהלתי|הובלתי צוות|אחראי(?:ת)? על צוות/,'ניהול צוותים'],[/הדרכ|הכשרות|אימנתי|לימדתי/,'הדרכה והכשרה'],[/טכני|תקלות|תיקנתי|תחזוקה/,'פתרון בעיות טכניות'],[/תכננתי|לוגיסט|תיאמתי|ארגנתי/,'ארגון ותכנון'],[/תחת לחץ|לחץ זמן|חירום|דחוף/,'תפקוד תחת לחץ'],[/סביבה משתנה|שינויים|השתנה|הסתגלתי/,'התמודדות עם שינויים']];
  return rules.filter(([re])=>re.test(text)).map(([,title])=>({kind:'item',category:'skill',title,status:'tentative',details:{note:'הצעה לתרגום ניסיון מהשירות; נדרשת בדיקה עם המשתמש'}}));
 }
 const steps=[
  {id:'age',he:'בן או בת כמה את/ה?',en:'How old are you?',known:p=>Number.isInteger(p.age)},
  {id:'release',he:'את/ה לפני שחרור או כבר אחרי? אם השתחררת, מתי בערך?',en:'Are you before or after discharge? If discharged, approximately when?',known:p=>p.transition_stage==='before_release'||(p.transition_stage==='released'&&(p.release_date||p.release_time_estimate))},
  {id:'work',he:'מה המצב שלך היום מבחינת עבודה — עובד/ת, מחפש/ת עבודה או משהו אחר? אם עובד/ת, באיזה היקף?',en:'What is your current employment situation? If working, full-time or part-time?',known:p=>p.employment_status&&p.employment_status!=='unknown'&&(p.employment_status!=='employed'||p.work_scope)},
  {id:'education',he:'איזו השכלה או הכשרות כבר יש לך? אפשר לציין מה הושלם ומה עדיין בתהליך.',en:'What education or training have you completed or are you undertaking?',known:p=>p.items.some(i=>['education','training'].includes(i.category)&&!['archived','superseded'].includes(i.status))},
  {id:'prior_experience',he:'לפני השירות, היה לך ניסיון בעבודה, בהתנדבות או בפרויקטים? מה עשית בפועל?',en:'Before service, did you have work, volunteering or project experience? What did you actually do?',known:p=>p.items.some(i=>i.category==='experience'&&/לפני השירות|before service/i.test(i.title+' '+(i.details?.note||'')))},
  {id:'service',he:'בדמו הזה השתמש/י בתיאור פיקטיבי וכללי בלבד: אילו תחומי אחריות היו לך בשירות? בלי יחידה, מיקום, פעילות מבצעית או פרטים רגישים. נבדוק כישורים בהמשך באמצעות דוגמאות.',en:'For this demo use a fictional, general description only: what responsibilities did you have in service? No unit, location, operations or sensitive details. We will explore skills using examples later.',known:()=>false},
  {id:'goals',he:'מה היית רוצה לקדם בתקופה הקרובה — לימודים, עבודה או מטרה אחרת? באיזה טווח זמן?',en:'What would you like to work towards next: studies, work or another goal? In what timeframe?',known:p=>p.goals.some(g=>['active','in_progress'].includes(g.status))},
  {id:'preferences',he:'מה חשוב להתחשב בו בדרך — זמינות להתחלה, מיקום, תקציב או העדפות אחרות?',en:'What should we take into account: availability, location, budget or other preferences?',known:p=>p.availability_label||p.available_from||p.items.some(i=>i.category==='preference'&&i.status==='active')}
 ];
 const bar=document.createElement('div');bar.style.cssText='padding:8px;font:13px Arial';bar.hidden=true;
 const skip=document.createElement('button');skip.type='button';skip.textContent='דלג על השאלה';
 const pause=document.createElement('button');pause.type='button';pause.textContent='להמשיך היכרות אחר כך';bar.append(skip,pause);document.getElementById('composer').append(bar);
 const resume=document.createElement('button');resume.type='button';resume.textContent='השלמת היכרות';document.querySelector('#momentum-passport-panel .panel-inner').prepend(resume);
 async function call(fn,args){const{data,error}=await momentumClient.rpc(fn,args);if(error)throw error;return data;}
 async function passport(){return call('demo_v1_get_passport',{p_email:momentumUser.id});}
 function controls(){bar.hidden=!active;skip.disabled=busy;pause.disabled=busy;}
 function say(text,extra={}){pushMsg('assistant',text,{kind:'onboarding',...extra});}
 function goalFollowUp(){
  const level=Math.min(S.messages.filter(m=>m.kind==='onboarding'&&m.goalFollowUp).length,3);
  const he=[
   'זה בסדר שעוד אין כיוון לטווח הרחוק. כשחושבים על חצי השנה הקרובה, איך היית רוצה שהיא תיראה? למשל עבודה זמנית, חיסכון לטיול, מנוחה או בדיקת אפשרויות לימוד — ואפשר גם משהו אחר.',
   'לא חייבים להחליט עכשיו על מסלול. נתמקד בחודש הקרוב: יש משהו שהיית רוצה לעשות או לקדם, אפילו קטן? למשל להרוויח קצת כסף, לקחת זמן לעצמך או לבדוק אפשרות שמעניינת אותך.',
   'אפשר להתחיל מצעד קטן בלבד. יש משהו שהיית רוצה לעשות בשבוע הקרוב? אם גם זה עוד לא ברור, אפשר לבחור ״דלג על השאלה״ ולחזור לזה בהמשך.',
   'אין צורך להכריח תשובה. אפשר לכתוב צעד קטן שמתאים לך כרגע, או לבחור ״דלג על השאלה״ ולהמשיך. לא נשמור כיוון שלא בחרת.'
  ];
  const en=[
   'It is okay not to have a long-term direction yet. How would you like the next six months to look? Perhaps temporary work, saving for a trip, rest or exploring study options — or something else entirely.',
   'You do not need to choose a path now. What would you like to do in the next month, even something small? Perhaps earn some money, take time for yourself or explore an option that interests you.',
   'We can start with one small step. Is there anything you would like to do in the next week? If that is still unclear, choose “Skip” and come back to this later.',
   'There is no need to force an answer. You can name a small step that suits you now, or choose “Skip” and continue. We will not save a direction you have not chosen.'
  ];
  say((S.lang==='he'?he:en)[level],{onboardingStep:'goals',goalFollowUp:true});
 }
 function fail(e){pushMsg('system','לא הצלחתי לאשר שמירה במערכת: '+(e.message||e)+'. לא עברנו לשאלה הבאה. אפשר לנסות שוב או לדלג.');}
 function verify(p,changes){
  for(const c of changes){
   if(c.kind==='situation')for(const[k,v]of Object.entries(c.fields))if((p[k]??null)!==v)throw Error('בדיקת השמירה של '+k+' נכשלה');
   if(c.kind==='direction'&&(c.status==='confirmed'?p.current_direction:p.tentative_direction)!==c.title.trim())throw Error('בדיקת שמירת הכיוון נכשלה');
   if(c.kind==='item'||c.kind==='goal'){
    const row=(c.kind==='item'?p.items:p.goals).find(r=>c.id?r.id===c.id:r.title===c.title.trim()&&(c.kind==='goal'||r.category===c.category));
    if(!row||(c.status&&row.status!==c.status))throw Error('בדיקת שמירת הפריט נכשלה');
    if(c.kind==='item')for(const[k,v]of Object.entries(c.details||{}))if(row.details?.[k]!==v)throw Error('בדיקת שמירת פרטי ההכשרה או הניסיון נכשלה');
    if(c.kind==='goal')for(const k of ['target_date','target_label'])if(k in c&&(row[k]??null)!==c[k])throw Error('בדיקת שמירת מועד המטרה נכשלה');
   }
  }
 }
 async function complete(id,p,changes=[],skipped=false,request=crypto.randomUUID()){
  const result=await call('demo_onboarding_save',{p_email:momentumUser.id,p_step:id,p_revision:p.revision,p_request_id:request,p_changes:changes,p_skip:skipped});
  if(!result?.success||!result.onboarding?.completed_steps?.includes(id))throw Error('לא התקבל אישור השלמת השלב');
  const saved=await passport();verify(saved,changes);state=result.onboarding;
  return saved;
 }
 async function next(){
  let p=await passport();
  for(const candidate of steps){
   if(state.completed_steps.includes(candidate.id))continue;
   if(candidate.known(p)){p=await complete(candidate.id,p);continue;}
   step=candidate;active=true;controls();
   say((S.lang==='he'?candidate.he:candidate.en)+'\n\n'+(S.lang==='he'?'אפשר לדלג או לענות ״עדיין לא יודע/ת״.':'You can skip or answer “not sure yet”.'),{onboardingStep:candidate.id});return;
  }
  active=false;step=null;controls();
  say(S.lang==='he'?'סיימנו את ההיכרות הראשונית. המידע האזרחי ששיתפת נשמר בפרופיל, ואפשר לתקן אותו בכל שלב. מה הכי יעזור לך שנקדם עכשיו?':'Initial onboarding is complete. Your civilian information was saved to your profile and can be corrected at any time. What would be most helpful to work on now?');
 }
 async function answer(text,skipped=false){
  if(busy||!step)return;busy=true;controls();
  const current=step,id=current.id;const request=crypto.randomUUID();
  if(!skipped){document.getElementById('input').value='';stopSpeaking();pushMsg('user',text,{onboardingStep:id,localOnly:id==='service'});}
  try{
   let p=await passport(),changes=[];
   const goalUncertain=id==='goals'&&/(?:לא יודע|לא יודעת|לא בטוח|לא בטוחה|אין לי מושג|אין לי כיוון|אין לי מטר|לא ברור לי|לא החלטתי|מתלבט|not sure|don.t know|no idea|undecided)/i.test(text)&&!/(?:אבל|רוצה|מתכנ|אולי|חושב|but|want|plan|maybe)/i.test(text);
   if(!skipped&&goalUncertain){goalFollowUp();return;}
   const unknown=/^(?:עדיין )?(?:לא יודע(?:ת)?|לא בטוח(?:ה)?|אין|לא היה|not sure|unknown)[.!]?$/i.test(text.trim());
   if(!skipped&&id==='goals'&&unknown){goalFollowUp();return;}
   if(!skipped&&!unknown&&id!=='service'){
    if(id==='age'){
     const match=text.match(/(?:^|\D)(\d{1,3})(?:\D|$)/);const age=match?Number(match[1]):NaN;
     if(!Number.isInteger(age)||age<16||age>100)throw Error('לגיל יש להזין מספר בין 16 ל־100, או לבחור דילוג');
     changes=[{kind:'situation',fields:{age}}];
    }else{
     const preview=await window.momentumPassport.extract({preview:true});
     if(!preview?.success)throw Error('לא התקבל אישור חילוץ. אפשר להשיב בתיאור אזרחי קצר או לדלג');
     changes=preview.changes;
     const requiredKind={release:'situation',work:'situation',education:'item',prior_experience:'item',goals:'goal',preferences:'situation'}[id];
     const relevant=changes.some(c=>id==='preferences'?(c.kind==='situation'||(c.kind==='item'&&c.category==='preference')):id==='education'?(c.kind==='item'&&['education','training'].includes(c.category)):id==='prior_experience'?(c.kind==='item'&&c.category==='experience'):id==='goals'?(c.kind==='goal'||c.kind==='direction'):c.kind===requiredKind);
     const statedNone=['education','prior_experience'].includes(id)&&/אין|לא למד|לא עשיתי|לא היה|לא עבד|no experience|no training/i.test(text);
     if(id==='goals'&&!relevant){goalFollowUp();return;}
     if(!relevant&&!statedNone)throw Error('לא זוהה פרט לשמירה בתשובה. נסה ניסוח מפורש יותר או דלג');
     p=await passport();
     if(preview.revision!==undefined&&preview.revision!==p.revision)throw Error('הפרופיל השתנה בינתיים. נסה שוב כדי להתאים למידע החדש');
    }
   }
   if(id==='service'&&!skipped&&!unknown){
    changes=translateService(text).filter(c=>!p.items.some(i=>i.category==='skill'&&i.title===c.title));
   }
   await complete(id,p,changes,skipped||unknown,request);
   if(id==='service'&&!skipped)say(S.lang==='he'?'תיאור השירות נשאר במכשיר הזה. '+(changes.length?'נשמרו כהצעות לבדיקה: '+changes.map(c=>c.title).join(', ')+'. נבדוק דוגמאות לפני שנתייחס אליהם ככישורים מאושרים.':'כישורים אזרחיים נבדוק באמצעות דוגמאות לפני שנאשר אותם.'):'Your service description stays on this device. Any civilian skill suggestions were recorded as tentative, to examine using examples.');
   else if(changes.length)say(S.lang==='he'?'נשמר בפרופיל.':'Saved to your profile.');
   await next();
  }catch(e){fail(e);}finally{busy=false;controls();}
 }
 skip.onclick=()=>answer('דלג',true);
 pause.onclick=()=>{active=false;controls();say(S.lang==='he'?'נעצור כאן את ההיכרות. אפשר להמשיך דרך ״השלמת היכרות״ בפרופיל. במה נעסוק עכשיו?':'Onboarding is paused. Resume through your profile whenever you like. What shall we work on now?');};
 resume.onclick=()=>window.momentumOnboarding.start();
 sendUser=async function(text){
  if(!active)return originalSend(text);
  text=(text||'').trim();if(!text||busy)return;
  if(/^(דלג|דילוג|skip)$/i.test(text))return answer(text,true);
  if(/^(אחר כך|בהמשך|לעצור|pause)$/i.test(text)){pause.click();return;}
  return answer(text);
 };
 window.momentumOnboarding={
  async start(){
   if(!momentumUser||busy)return;
   busy=true;controls();
   try{
    state=await call('demo_onboarding_get',{p_email:momentumUser.id});
    if(state.status==='completed'){active=false;controls();return;}
    S.started=true;enterChat();save();
    if(state.status==='not_started')say(S.lang==='he'?'לפני שנתחיל, נכיר אותך בכמה שאלות קצרות — אחת בכל פעם. נשמור את המידע האזרחי בפרופיל כדי שלא תצטרך/י להתחיל מחדש בשיחה הבאה. זה דמו עם מידע פיקטיבי בלבד.':'Let’s get acquainted with a few short questions, one at a time. Your civilian answers will be saved so you can continue next time. Use fictional demo data only.');
    await next();
   }catch(e){fail(e);}finally{busy=false;controls();}
  },
  isActive:()=>active,
  translateService
 };
})();
