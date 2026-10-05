const { JSDOM } = require('jsdom');
const fs = require('fs');

const html = fs.readFileSync(__dirname + '/../guided-transition-companion-v2.html', 'utf8');
const dom = new JSDOM(html, { url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
const { window } = dom;
const doc = window.document;
const peek = (expr) => window.eval(expr);
const results = [];
const check = (name, ok, detail) => { results.push({name, ok}); console.log((ok ? '✅' : '❌'), name, detail!=null ? '— '+detail : ''); };

async function send(text){
  doc.getElementById('input').value = text;
  doc.getElementById('btnSend').click();
  await new Promise(r => setTimeout(r, 300));
}
function lastTurnText(){
  const kids = doc.getElementById('thread').children;
  return kids[kids.length-1].textContent;
}

(async () => {
  doc.getElementById('btnStart').click();

  // 1: first real answer -> fallback + ack
  await send("שירתי בשריון בעזה ובלבנון, שלוש שנים ועוד שנתיים מילואים.");
  check('Falls back to Practice Mode when API unreachable', peek('S.practice') === true);
  check('One-time service acknowledgment fired', peek('S.ack') === true, lastTurnText().slice(0,60));

  // 2: candidates should surface now (practiceStep 1) incl. tank/armor hint
  await send("פעם הקשר קרס באמצע תמרון והייתי חייב להחליט לבד על המסלול.");
  const tags2 = [...doc.querySelectorAll('.turn:last-child .tag')].map(t=>t.textContent);
  check('Candidate skills surfaced (tank/armor HINTS branch)', tags2.length > 0, tags2.join(', '));

  // 3: another concrete step (practiceStep 2)
  await send("הצוות שלי נשאר בטוח כי לקחתי אחריות באותו רגע.");

  // 4: give a real concrete example -> should surface candidates again (step 3) and set up confirmation at step4
  await send("ניווטתי את הרכב בעצמי בלי תקשורת, תוך כדי אש, ושמרתי על כולם בחיים.");
  const tags4 = [...doc.querySelectorAll('.turn:last-child .tag')].map(t=>t.textContent);
  check('Second candidate surfacing pass (step 3)', tags4.length > 0, tags4.join(', '));

  // 5: this long answer should get CONFIRMED with real evidence text (practiceStep 4)
  await send("כשהקשר קרס לקחתי החלטה לבד על המסלול תחת אש ושמרתי על הצוות בחיים בלי לחכות לפקודה.");
  const profileJson = peek('JSON.stringify(S.profile)');
  const profile = JSON.parse(profileJson);
  check('Confirmed strength recorded with real evidence (not empty)', profile.strengths.length > 0 && profile.strengths[0].evidence.length > 5, JSON.stringify(profile.strengths));
  check('Profile badge count reflects confirmed strengths', doc.getElementById('btnProfile').dataset.count === String(profile.strengths.length));

  // 6: direction/proposals phase should now be live (practiceStep >= 5)
  await send("עכשיו אני חושב על עבודה או לימודים.");
  const props = [...doc.querySelectorAll('.turn:last-child .prop b')].map(p=>p.textContent);
  check('Direction proposals appear once in direction phase', props.length > 0, props.join(' | '));
  check('Phase advanced to "direction"', peek('S.phase') === 'direction');

  // --- fresh session: test the SHIFT rule in isolation ---
  const dom2 = new JSDOM(html, { url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w2 = dom2.window, d2 = w2.document, peek2 = (e)=>w2.eval(e);
  d2.getElementById('btnStart').click();
  async function send2(t){ d2.getElementById('input').value = t; d2.getElementById('btnSend').click(); await new Promise(r=>setTimeout(r,300)); }
  function lastText2(){ const k=d2.getElementById('thread').children; return k[k.length-1].textContent; }

  await send2("אני לא יודע מה לעשות, מה אתה מציע?"); // no constraint named -> should fire shift once
  check('Shift-naming fires when no constraint is named', peek2('S.shift') === true, lastText2().slice(0,70));

  const dom3 = new JSDOM(html, { url: 'https://localhost/', runScripts: 'dangerously', pretendToBeVisual: true });
  const w3 = dom3.window, d3 = w3.document, peek3 = (e)=>w3.eval(e);
  d3.getElementById('btnStart').click();
  async function send3(t){ d3.getElementById('input').value = t; d3.getElementById('btnSend').click(); await new Promise(r=>setTimeout(r,300)); }
  await send3("אין לי כסף ואין לי איפה לגור, מה אתה מציע?"); // constraint named -> shift should NOT fire
  check('Shift-naming suppressed when a real constraint is named', peek3('S.shift') === false);

  // --- support drawer ---
  doc.getElementById('btnHelp').click();
  const supportText = doc.getElementById('dBody').textContent;
  check('Support drawer renders configured contacts', supportText.includes('ער"ן') || supportText.includes('ERAN'), supportText.replace(/\s+/g,' ').slice(0,120));

  console.log('\n' + results.filter(r=>r.ok).length + '/' + results.length + ' checks passed.');
  if (results.some(r=>!r.ok)) process.exit(1);
})().catch(e => { console.error('TEST THREW:', e); process.exit(1); });
