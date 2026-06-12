  const COLORS = [
    ['#EEEDFE','#534AB7'],['#E1F5EE','#0F6E56'],['#FAECE7','#993C1D'],
    ['#FBEAF0','#993556'],['#E6F1FB','#185FA5'],['#EAF3DE','#3B6D11'],
    ['#FAEEDA','#854F0B'],['#FCEBEB','#A32D2D'],['#E1F5EE','#085041'],
    ['#EEEDFE','#3C3489'],['#FAECE7','#712B13'],['#E6F1FB','#0C447C']
  ];
  const DEMO = ['Alice','Bob','Carlos','Diana','Ethan','Fatima','George','Hannah','Ivan','Jasmine'];
  const PREBUILT = [
    { name: 'Math 101', students: ['Alice','Bob','Carlos','Diana','Ethan','Fatima','George','Hannah'] },
    { name: 'Science 5A', students: ['Ivan','Jasmine','Kevin','Laura','Mike','Nina','Oscar','Priya'] },
    { name: 'English B', students: ['Quinn','Rosa','Sam','Tina','Uma','Victor','Wendy','Xander','Yara','Zoe'] }
  ];
 
  let classes = {}, activeId = null, allNames = [], removed = new Set(), lastWinner = null;
  let spinning = false, angle = 0, animId = null;
 
  const canvas = document.getElementById('wheelCanvas');
  const ctx = canvas.getContext('2d');
 
  function save() {
    try { localStorage.setItem('wheelClasses', JSON.stringify(classes)); localStorage.setItem('wheelActive', activeId || ''); } catch(e) {}
  }
  function loadStorage() {
    try {
      const d = localStorage.getItem('wheelClasses');
      if (d) classes = JSON.parse(d);
      const a = localStorage.getItem('wheelActive');
      if (a && classes[a]) activeId = a;
    } catch(e) {}
  }
  loadStorage();
  if (!Object.keys(classes).length) {
    PREBUILT.forEach(p => { const id = uid(); classes[id] = { name: p.name, students: [...p.students] }; });
    save();
  }
 
  function uid() { return 'c' + Date.now() + Math.random().toString(36).slice(2, 6); }
  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function getRemaining() { return allNames.filter(n => !removed.has(n)); }
 
  function renderSidebar() {
    const el = document.getElementById('classList'), ids = Object.keys(classes);
    if (!ids.length) { el.innerHTML = '<p style="font-size:12px;color:#888;padding:4px 0;">No classes yet</p>'; return; }
    el.innerHTML = ids.map(id => {
      const c = classes[id];
      return `<div class="class-item${id === activeId ? ' active' : ''}" onclick="selectClass('${id}')">
        <span class="ci-name">${esc(c.name)}</span>
        <span class="ci-count">${c.students.length}</span>
        <button class="ci-del" onclick="deleteClass(event,'${id}')" title="Delete"><i class="ti ti-trash" style="font-size:13px;"></i></button>
      </div>`;
    }).join('');
  }
 
  function createClass() {
    const inp = document.getElementById('newClassName'), name = inp.value.trim();
    if (!name) return;
    const id = uid(); classes[id] = { name, students: [] }; inp.value = '';
    save(); selectClass(id);
  }
 
  function deleteClass(e, id) {
    e.stopPropagation();
    if (!confirm('Delete "' + classes[id].name + '"?')) return;
    delete classes[id];
    if (activeId === id) { activeId = null; showEmpty(); }
    save(); renderSidebar();
  }
 
  function selectClass(id) {
    activeId = id; allNames = [...classes[id].students]; removed = new Set(); lastWinner = null;
    angle = 0; spinning = false;
    if (animId) cancelAnimationFrame(animId);
    save(); renderSidebar(); showEditor();
  }
 
  function showEmpty() {
    document.getElementById('emptyState').style.display = '';
    document.getElementById('classEditor').style.display = 'none';
  }
 
  function showEditor() {
    const c = classes[activeId];
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('classEditor').style.display = '';
    document.getElementById('classTitle').textContent = c.name;
    document.getElementById('resultBox').textContent = c.students.length ? 'Ready to spin!' : 'Add students to spin!';
    renderNameList(); drawWheel(); updateUI();
  }
 
  function startRename() {
    const c = classes[activeId], titleEl = document.getElementById('classTitle');
    titleEl.outerHTML = `<input class="edit-name-input" id="classTitle" value="${esc(c.name)}" onblur="finishRename()" onkeydown="if(event.key==='Enter')this.blur()" />`;
    document.getElementById('classTitle').focus();
  }
 
  function finishRename() {
    const inp = document.getElementById('classTitle'), val = inp.value.trim() || classes[activeId].name;
    classes[activeId].name = val; save(); renderSidebar();
    inp.outerHTML = `<span class="panel-title" id="classTitle">${esc(val)}</span>`;
  }
 
  function addName() {
    const inp = document.getElementById('nameInput'), val = inp.value.trim();
    if (!val || !activeId) return;
    if (!classes[activeId].students.includes(val)) {
      classes[activeId].students.push(val); allNames.push(val); save();
    }
    inp.value = ''; renderNameList(); drawWheel(); updateUI(); renderSidebar();
  }
 
  function handleTagClick(name) {
    const tags = document.querySelectorAll('.name-tag');
    let found = null;
    tags.forEach(t => { if (t.dataset.name === name) found = t; });
    if (!found) return;
    if (found.classList.contains('winner-confirm')) {
      // Confirmed — permanently delete from class
      classes[activeId].students = classes[activeId].students.filter(n => n !== name);
      allNames = allNames.filter(n => n !== name);
      removed.delete(name);
      if (lastWinner === name) lastWinner = null;
      save(); renderNameList(); drawWheel(); updateUI(); renderSidebar();
      return;
    }
    // First click — turn red to confirm
    document.querySelectorAll('.name-tag.winner-confirm').forEach(t => t.classList.remove('winner-confirm'));
    found.classList.add('winner-confirm');
    setTimeout(() => { if (found && found.classList.contains('winner-confirm')) found.classList.remove('winner-confirm'); }, 2000);
  }
 
  function loadDemo() {
    if (!activeId) return;
    DEMO.forEach(n => {
      if (!classes[activeId].students.includes(n)) { classes[activeId].students.push(n); allNames.push(n); }
    });
    save(); renderNameList(); drawWheel(); updateUI(); renderSidebar();
  }
 
  function openBulk() { document.getElementById('bulkText').value = ''; document.getElementById('bulkModal').classList.add('open'); document.getElementById('bulkText').focus(); }
  function closeBulk() { document.getElementById('bulkModal').classList.remove('open'); }
  function confirmBulk() {
    const names = document.getElementById('bulkText').value.split(/[\n,]/).map(s => s.trim()).filter(s => s.length > 0 && s.length <= 30);
    let added = 0;
    names.forEach(n => {
      if (!classes[activeId].students.includes(n)) { classes[activeId].students.push(n); allNames.push(n); added++; }
    });
    save(); renderNameList(); drawWheel(); updateUI(); renderSidebar(); closeBulk();
    if (added > 0) document.getElementById('resultBox').textContent = `Added ${added} student${added > 1 ? 's' : ''}!`;
  }
 
  document.getElementById('bulkModal').addEventListener('click', function(e) { if (e.target === this) closeBulk(); });
  document.getElementById('nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') addName(); });
  document.getElementById('newClassName').addEventListener('keydown', e => { if (e.key === 'Enter') createClass(); });
  document.addEventListener('click', e => {
    if (!e.target.closest('.name-tag')) document.querySelectorAll('.name-tag.winner-confirm').forEach(t => t.classList.remove('winner-confirm'));
  });
 
  function renderNameList() {
    const el = document.getElementById('nameList'), label = document.getElementById('nameListLabel');
    if (!activeId || !allNames.length) { el.innerHTML = '<p class="hint">No students yet — add names above</p>'; label.textContent = ''; return; }
    label.textContent = removed.size > 0
      ? `${removed.size} removed from wheel — click any name to delete from class`
      : 'Click a name to delete from class';
    el.innerHTML = allNames.map(n => {
      const isWinner = n === lastWinner;
      const isRemoved = removed.has(n);
      let cls = 'name-tag' + (isWinner ? ' winner' : '') + (isRemoved ? ' removed' : '');
      const hint = isWinner ? '★ click to delete' : '× delete?';
      return `<div class="${cls}" data-name="${esc(n)}" onclick="handleTagClick('${n.replace(/'/g, "\\'")}')">
        <span>${esc(n)}</span>
        <span class="del-hint">${hint}</span>
      </div>`;
    }).join('');
  }
 
  function updateUI() {
    const rem = getRemaining();
    const btn = document.getElementById('spinBtn');
    btn.disabled = rem.length < 1 || spinning;
    if (rem.length === 0 && allNames.length > 0 && !spinning)
      document.getElementById('resultBox').textContent = 'Everyone picked! Hit reset.';
  }
 
  function drawWheel() {
    const rem = getRemaining(), n = rem.length;
    ctx.clearRect(0, 0, 300, 300);
    if (n === 0) {
      ctx.beginPath(); ctx.arc(150, 150, 145, 0, Math.PI * 2);
      ctx.fillStyle = '#E1F5EE'; ctx.fill();
      ctx.strokeStyle = '#9FE1CB'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#0F6E56'; ctx.font = '500 14px system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.fillText('All done!', 150, 158);
      return;
    }
    const slice = (Math.PI * 2) / n;
    rem.forEach((name, i) => {
      const isWinner = name === lastWinner;
      const [bg, fg] = COLORS[i % COLORS.length];
      const start = angle + i * slice, end = start + slice;
      ctx.beginPath(); ctx.moveTo(150, 150); ctx.arc(150, 150, 145, start, end); ctx.closePath();
      ctx.fillStyle = isWinner ? '#FFF3CD' : bg; ctx.fill();
      ctx.strokeStyle = isWinner ? '#F0B429' : fg;
      ctx.lineWidth = isWinner ? 3 : 2; ctx.stroke();
      ctx.save(); ctx.translate(150, 150); ctx.rotate(start + slice / 2); ctx.textAlign = 'right';
      const fs = n > 8 ? 11 : n > 5 ? 13 : 14;
      ctx.font = `${isWinner ? '700' : '500'} ${fs}px system-ui,sans-serif`;
      ctx.fillStyle = isWinner ? '#7A4F01' : fg;
      ctx.fillText(name.length > 14 ? name.slice(0, 13) + '…' : name, 138, 5);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(150, 150, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = '#ccc'; ctx.lineWidth = 2; ctx.stroke();
  }
 
  function spin() {
    const rem = getRemaining();
    if (spinning || rem.length === 0) return;
    lastWinner = null; spinning = true;
    document.getElementById('spinBtn').disabled = true;
    document.getElementById('resultBox').textContent = '🎲 Spinning…';
    const n = rem.length, sliceAngle = (Math.PI * 2) / n;
    const winnerIdx = Math.floor(Math.random() * n);
    const extraSpins = (Math.PI * 2) * (5 + Math.floor(Math.random() * 3));
    const targetOffset = Math.PI * 1.5 - (winnerIdx * sliceAngle + sliceAngle / 2);
    const targetAngle = extraSpins + targetOffset - (angle % (Math.PI * 2));
    let start = null; const duration = 3500 + Math.random() * 1000;
    function ease(t) { return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t+2,3)/2; }
    function frame(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      angle = (angle % (Math.PI * 2)) + ease(progress) * targetAngle;
      drawWheel();
      if (progress < 1) { animId = requestAnimationFrame(frame); }
      else {
        spinning = false;
        lastWinner = rem[winnerIdx];
        document.getElementById('resultBox').textContent = '🎉 ' + lastWinner + '! (click their name to remove)';
        renderNameList(); drawWheel(); updateUI();
      }
    }
    animId = requestAnimationFrame(frame);
  }
 
  function resetWheel() {
    if (animId) cancelAnimationFrame(animId);
    spinning = false; angle = 0; removed = new Set(); lastWinner = null;
    if (activeId) allNames = [...classes[activeId].students];
    document.getElementById('resultBox').textContent = allNames.length ? 'Ready to spin!' : 'Add students to spin!';
    renderNameList(); drawWheel(); updateUI();
  }
 
  renderSidebar();
  if (activeId && classes[activeId]) selectClass(activeId);
  else { const ids = Object.keys(classes); if (ids.length) selectClass(ids[0]); }

