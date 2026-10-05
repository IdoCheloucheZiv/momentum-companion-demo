const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../guided-transition-companion-v2.html','utf8');
const results = [];
const check = (n, ok, d) => { results.push(ok); console.log(ok?'✅':'❌', n, d!=null?'— '+d:''); };

function boot(storage){
  // localStorage must exist BEFORE the page scripts run, or the app boots empty
  return new JSDOM(html,{
    url:'https://localhost/', runScripts:'dangerously', pretendToBeVisual:true,
    beforeParse(win){ if (storage) win.localStorage.setItem('gtc_v2_state', storage); }
  });
}
const wait = ms => new Promise(r=>setTimeout(r,ms));

(async()=>{
  // ---------- ENGLISH FLOW ----------
  let dom = boot();
  let w = dom.window, d = w.document;
  d.getElementById('btnLang').click();                 // he -> en
  check('Language toggles to English before start', w.eval('S.lang')==='en' && d.documentElement.dir==='ltr');
  d.getElementById('btnStart').click();
  const opening = d.getElementById('thread').children[0].textContent;
  check('Opening line is in English', /First — thank you/.test(opening), opening.slice(0,60));

  const send = async (dd, t) => { dd.getElementById('input').value=t; dd.getElementById('btnSend').click(); await wait(300); };
  await send(d, "I served three years in armor in Gaza, then two more in reserves.");
  const ackTurn = [...d.getElementById('thread').children].map(c=>c.textContent).join(' ');
  check('English acknowledgment fired (not Hebrew)', /real weight/.test(ackTurn) && !/משקל אמיתי/.test(ackTurn));

  await send(d, "Comms went down mid-maneuver and I called the route myself.");
  const tags = [...d.querySelectorAll('.tag')].map(t=>t.textContent);
  check('Candidate skills render in English', tags.length>0 && /conditions|stress|Teamwork|Reacting/i.test(tags.join(' ')), tags.join(', '));

  // ---------- RESPONSE STYLE: no echoing, a bit of explanation ----------
  const replies = [...d.querySelectorAll('.turn.them .body')].map(b=>b.textContent).slice(1); // skip the opening message
  const echoRe = /I heard|I hear you|what I'm hearing|it sounds like|so you're saying|שמעתי|אני שומע/i;
  const headings = [...d.querySelectorAll('.surface h4')].map(h=>h.textContent);
  check('Replies and headings never echo or say "I heard"', replies.length>0 && headings.length>0 && !replies.some(r=>echoRe.test(r)) && !headings.some(h=>echoRe.test(h)), replies.length+' replies, '+headings.length+' heading(s) checked');
  check('Replies include an explanation as well as a question', replies.every(r=>r.length>=180 && r.includes('?')), replies.map(r=>r.length).join(', ')+' chars');

  // ---------- CONTENT LIMITS ----------
  const sysPrompt = w.eval('systemPrompt()');
  check('Instructions include content limits (no explicit content, no help bypassing filters)', /CONTENT LIMITS/.test(sysPrompt) && /pornographic/.test(sysPrompt) && /content filter/.test(sysPrompt));
  check('Content limits sit before the crisis boundaries and JSON output rules', sysPrompt.indexOf('CONTENT LIMITS') > -1 && sysPrompt.indexOf('CONTENT LIMITS') < sysPrompt.indexOf('BOUNDARIES') && sysPrompt.indexOf('BOUNDARIES') < sysPrompt.indexOf('OUTPUT'));

  // ---------- MID-CONVERSATION LANGUAGE SWITCH ----------
  const beforeCount = d.getElementById('thread').children.length;
  d.getElementById('btnLang').click();
  check('Thread survives mid-conversation language switch', d.getElementById('thread').children.length===beforeCount && d.documentElement.dir==='rtl', beforeCount+' turns intact');

  // ---------- PERSISTENCE ACROSS RELOAD ----------
  const saved = w.localStorage.getItem('gtc_v2_state');
  const savedMsgs = JSON.parse(saved).messages.length;
  const dom2 = boot(saved);
  await wait(200);
  const w2 = dom2.window, d2 = dom2.window.document;
  check('Reload restores conversation', w2.eval('S.messages.length')===savedMsgs, savedMsgs+' messages restored');
  check('Reload lands straight in chat, not welcome', d2.getElementById('welcome').hidden===true && d2.getElementById('chat').hidden===false);
  check('Restored thread actually re-rendered', d2.getElementById('thread').children.length===savedMsgs);

  // ---------- CONCERN -> SUPPORT ESCALATION ----------
  const dom3 = boot();
  const w3 = dom3.window, d3 = dom3.window.document;
  d3.getElementById('btnStart').click();
  await wait(100);
  w3.eval('applyReply({reply:"I hear you.", concern:true})');
  await wait(200);
  const drawerOpen = d3.getElementById('drawer').classList.contains('on');
  const body3 = d3.getElementById('dBody').textContent;
  check('concern:true auto-opens support', drawerOpen);
  check('Support shows crisis line + contacts', /101|100/.test(body3) && /ער"ן|ERAN/.test(body3));
  const threadTxt = d3.getElementById('thread').textContent;
  check('Conversation continues after concern (not terminated)', /זה הרבה לשאת|a lot to carry/i.test(threadTxt) && d3.getElementById('composer').hidden===false);

  // ---------- DELETE / RESET ----------
  const dom4 = boot();
  const w4 = dom4.window, d4 = dom4.window.document;
  w4.confirm = () => true;
  // jsdom can't actually navigate; it logs "Not implemented: navigation" when reload() fires.
  let reloaded = false;
  const origErr = w4._virtualConsole;
  w4._virtualConsole.on('jsdomError', e => { if (/navigation/i.test(e.message)) reloaded = true; });
  d4.getElementById('btnStart').click();
  await send(d4, "בדיקה");
  w4.eval('S.profile.strengths.push({id:26,evidence:"test"}); save();');
  d4.getElementById('btnProfile').click();
  const resetBtn = [...d4.querySelectorAll('.linkish')].find(b=>/מחיקת|Delete/.test(b.textContent));
  check('Delete control exists in profile', !!resetBtn, resetBtn && resetBtn.textContent);
  if (resetBtn){
    resetBtn.click();
    await wait(100);
    check('Delete clears stored state', w4.localStorage.getItem('gtc_v2_state')===null);
    check('Delete triggers reload', reloaded);
  }

  console.log('\n' + results.filter(Boolean).length + '/' + results.length + ' checks passed.');
  if (results.some(r=>!r)) process.exit(1);
})().catch(e=>{console.error('THREW:',e);process.exit(1);});
