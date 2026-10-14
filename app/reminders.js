/* Demo: the page must remain open. No Web Push subscription. */
(() => {
  const box = document.createElement('div');
  box.dir = 'rtl';
  box.style.cssText = 'position:fixed;left:12px;bottom:86px;z-index:1000;background:white;border:1px solid #bbb;border-radius:8px;padding:8px;max-width:300px;font:13px Arial';
  const enable = document.createElement('button');
  enable.textContent = 'הפעלת התראות במחשב';
  const test = document.createElement('button');
  test.textContent = 'בדיקת התראה';
  const status = document.createElement('div');
  status.setAttribute('role', 'status');
  box.append(enable, test, status);
  document.body.append(box);
  let registration, busy = false;
  const supported = 'Notification' in window && 'serviceWorker' in navigator && window.isSecureContext;
  let workerError = '';
  const workerReady = supported
    ? navigator.serviceWorker.register('./service-worker.js').then(() => navigator.serviceWorker.ready).then(r => { registration = r; })
      .catch(e => { workerError = e.message; })
    : Promise.resolve();
  function paint() {
    box.hidden = !momentumUser;
    enable.disabled = !supported || Notification.permission === 'granted';
    test.disabled = !supported || Notification.permission !== 'granted';
    status.textContent = !supported ? 'הדפדפן אינו תומך בהתראות כאן.'
      : workerError ? 'לא ניתן להפעיל התראות: ' + workerError
      : Notification.permission === 'denied' ? 'ההתראות חסומות. אפשר לשנות זאת בהגדרות האתר בדפדפן.'
      : Notification.permission === 'granted' ? 'התראות פעילות. להשאיר את האתר פתוח ברקע.'
      : 'יש לאשר התראות בדפדפן. האתר צריך להישאר פתוח.';
  }
  enable.addEventListener('click', async () => {
    try {
      // Permission request must start directly from the user click.
      await Notification.requestPermission();
      await workerReady;
      paint();
      await poll();
    } catch (e) { status.textContent = 'לא ניתן להפעיל התראות: ' + e.message; }
  });
  async function show(title, body, tag) {
    await workerReady;
    if (!registration) throw new Error(workerError || 'Service Worker unavailable');
    await registration.showNotification(title, {
      body, tag, icon: './icon-192.png', dir: 'rtl', lang: 'he',
      data: { url: new URL('./', location.href).href },
    });
  }
  test.addEventListener('click', async () => {
    try {
      await show('Momentum — בדיקת התראה', 'ההתראות במחשב מוכנות. עכשיו אפשר לקבוע תזכורת בצ׳אט.', 'momentum-test');
      status.textContent = 'בקשת ההתראה נשלחה למערכת. אם אין חלונית, בדוק הגדרות התראות ו״נא לא להפריע״.';
    } catch (e) { status.textContent = 'בדיקת ההתראה נכשלה: ' + e.message; }
  });
  async function checkDue() {
    const email = momentumUser.id;
    const { data, error } = await momentumClient.rpc('demo_due_reminders', { p_email: email });
    if (error) throw error;
    for (const reminder of data || []) {
      if (momentumUser?.id !== email) return;
      const key = 'momentum-notified:' + email + ':' + reminder.id;
      // Local marker lets an acknowledgement retry without redisplaying.
      if (!localStorage.getItem(key)) {
        await show(reminder.title, reminder.body, 'momentum-reminder:' + reminder.id);
        localStorage.setItem(key, '1');
      }
      const ack = await momentumClient.rpc('demo_ack_reminder', { p_email: email, p_id: reminder.id });
      if (ack.error) throw ack.error;
    }
  }
  async function poll() {
    paint();
    if (busy || !supported || Notification.permission !== 'granted' || !momentumUser || !momentumClient) return;
    busy = true;
    try {
      // One polling tab per origin in browsers supporting Web Locks.
      if (navigator.locks) await navigator.locks.request('momentum-reminders', { ifAvailable: true }, async lock => { if (lock) await checkDue(); });
      else await checkDue();
    } catch (e) { status.textContent = 'בדיקת תזכורות נכשלה: ' + (e.message || e); }
    finally { busy = false; }
  }
  setInterval(poll, 5000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  window.addEventListener('online', poll);
  paint();
})();
