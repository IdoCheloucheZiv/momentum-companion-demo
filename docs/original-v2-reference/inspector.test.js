const { JSDOM } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../guided-transition-companion-v2.html','utf8');
const dom = new JSDOM(html,{url:'https://localhost/?debug',runScripts:'dangerously',pretendToBeVisual:true});
const {window}=dom, doc=window.document;
const send = async t => { doc.getElementById('input').value=t; doc.getElementById('btnSend').click(); await new Promise(r=>setTimeout(r,300)); };

(async()=>{
  doc.getElementById('btnStart').click();
  await send("שירתי בשריון בעזה ובלבנון שלוש שנים ועוד שנתיים מילואים.");
  await send("הקשר קרס באמצע תמרון והחלטתי לבד על המסלול.");
  await send("שמרתי על הצוות בחיים בלי לחכות לפקודה, תחת אש, לבד.");

  // simulate triple tap on the title
  const mark = doc.getElementById('mark');
  mark.click(); mark.click(); mark.click();

  const drawerOpen = doc.getElementById('drawer').classList.contains('on');
  console.log('inspector opened on triple-tap:', drawerOpen);
  console.log('title:', doc.getElementById('dTitle').textContent);
  console.log('\n===== INSPECTOR CONTENT =====');
  console.log(doc.getElementById('dBody').textContent.replace(/([a-zA-Z ]{3,}?)(“)/g,'\n$1 $2').trim());
})().catch(e=>{console.error('THREW:',e);process.exit(1);});
