/* ExamPortal: best-effort exam integrity controls. Browser screenshot prevention is not guaranteed. */
(()=>{
  let lastWarning=0;
  const active=()=>typeof attempt!=='undefined' && attempt?.status==='in_progress' && user?.role==='student';
  function warn(message){
    if(Date.now()-lastWarning<2500)return;
    lastWarning=Date.now();
    let el=document.getElementById('exam-integrity-warning');
    if(!el){el=document.createElement('div');el.id='exam-integrity-warning';el.setAttribute('role','alert');document.body.appendChild(el);}
    el.textContent=message;
    el.hidden=false;
    clearTimeout(warn.timeout);
    warn.timeout=setTimeout(()=>el.hidden=true,4500);
  }
  document.addEventListener('keydown',e=>{
    if(!active())return;
    const k=e.key.toLowerCase();
    if(k==='printscreen'||((e.ctrlKey||e.metaKey)&&['p','s','c','x','u'].includes(k)) || (e.metaKey&&e.shiftKey&&['3','4','5'].includes(k))){
      e.preventDefault();e.stopPropagation();
      warn('Exam integrity: screenshots, printing and copying are not permitted during this examination.');
    }
  },true);
  for(const type of ['copy','cut','contextmenu','dragstart'])document.addEventListener(type,e=>{
    if(!active())return;
    e.preventDefault();warn('Exam integrity: copying or exporting examination content is not permitted.');
  },true);
  document.addEventListener('visibilitychange',()=>{if(active()&&document.hidden)console.warn('ExamPortal: exam tab was hidden at',new Date().toISOString());});
})();
