/* =============================================
   js/horas.js — Lógica de la app
   ============================================= */
'use strict';

const Horas = (() => {
    const MONTHS_ORDER = [
        '08-25','09-25','10-25','11-25','12-25',
        '01-26','02-26','03-26','04-26','05-26','06-26','07-26','08-26'
    ];
    const MONTH_LABELS = {
        '08-25':'Agosto 2025','09-25':'Septiembre 2025','10-25':'Octubre 2025',
        '11-25':'Noviembre 2025','12-25':'Diciembre 2025','01-26':'Enero 2026',
        '02-26':'Febrero 2026','03-26':'Marzo 2026','04-26':'Abril 2026',
        '05-26':'Mayo 2026','06-26':'Junio 2026','07-26':'Julio 2026','08-26':'Agosto 2026'
    };

    let _month = null;
    let _tab = 'resumen';
    let _custom = {}; // { 'MM-YY': [{day,task,horas,horario,nota}] }
    let _allDays = [];
    let _data = { tasks: [], days: [] };

    // ─── Init ───────────────────────────────────
    function init() {
        _loadLocal();
        _initMonthSelect();
        _initGist();

        const now = new Date();
        const mmyy = `${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getFullYear()).slice(-2)}`;
        _month = MONTHS_ORDER.includes(mmyy) ? mmyy : MONTHS_ORDER[MONTHS_ORDER.length - 1];
        document.getElementById('month-select').value = _month;
        _render();
    }

    function _loadLocal() {
        try {
            const s = localStorage.getItem('horas-custom');
            if (s) _custom = JSON.parse(s);
        } catch(_) { _custom = {}; }
    }

    function _saveLocal() {
        try { localStorage.setItem('horas-custom', JSON.stringify(_custom)); } catch(_) {}
    }

    function _initMonthSelect() {
        const sel = document.getElementById('month-select');
        sel.replaceChildren();
        MONTHS_ORDER.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = MONTH_LABELS[m] || m;
            sel.appendChild(opt);
        });
        sel.addEventListener('change', e => { _month = e.target.value; _render(); });
    }

    function _initGist() {
        const token = localStorage.getItem('horas-gist-token');
        const gistId = localStorage.getItem('horas-gist-id');
        if (token) { Gist.setToken(token); _setSyncStatus('ok'); }
        if (gistId) Gist.setGistId(gistId);
        if (token && gistId) _loadFromGist();
    }

    // ─── Navigation ─────────────────────────────
    function prevMonth() {
        const i = MONTHS_ORDER.indexOf(_month);
        if (i > 0) { _month = MONTHS_ORDER[i-1]; _syncSelect(); _render(); }
    }
    function nextMonth() {
        const i = MONTHS_ORDER.indexOf(_month);
        if (i < MONTHS_ORDER.length-1) { _month = MONTHS_ORDER[i+1]; _syncSelect(); _render(); }
    }
    function _syncSelect() { document.getElementById('month-select').value = _month; }

    // ─── Tab switch ─────────────────────────────
    function switchTab(tab) {
        _tab = tab;
        ['resumen','diario','semanal','tareas','anadir'].forEach(t => {
            document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
            document.getElementById(`panel-${t}`)?.classList.toggle('active', t === tab);
        });
        _renderTab();
    }

    // ─── Main render ────────────────────────────
    function _render() {
        _data = HORAS_DATA[_month] || { tasks: [], days: [] };
        _allDays = _mergeCustom(_data.days, _custom[_month] || []);
        _renderKpis();
        _renderTab();
        // Update month label
        const lbl = document.getElementById('month-label');
        if (lbl) lbl.textContent = MONTH_LABELS[_month] || _month;
    }

    function _renderTab() {
        switch(_tab) {
            case 'resumen': _renderResumen(); break;
            case 'diario':  _renderDiario(); break;
            case 'semanal': _renderSemanal(); break;
            case 'tareas':  _renderTareas(); break;
            case 'anadir':  _renderAnadir(); break;
        }
    }

    // ─── Merge custom entries ────────────────────
    function _mergeCustom(days, customArr) {
        const merged = days.map(d => ({ day:d.day, entries:[...d.entries], total:d.total }));
        (customArr || []).forEach(entry => {
            const existing = merged.find(d => d.day === entry.day);
            if (existing) {
                existing.entries.push({ ...entry, isCustom:true });
                const tot = existing.entries.reduce((acc,e) => {
                    const h = parseFloat(e.horas); return acc + (isNaN(h)?0:h);
                }, 0);
                existing.total = String(Math.round(tot*100)/100);
            } else {
                merged.push({ day:entry.day, entries:[{ ...entry, isCustom:true }], total:entry.horas });
            }
        });
        merged.sort((a,b) => _dayNum(a.day) - _dayNum(b.day));
        return merged;
    }

    function _dayNum(dayStr) {
        for (const p of dayStr.split(' ')) { if (/^\d+$/.test(p)) return parseInt(p,10); }
        return 999;
    }

    // ─── KPIs ────────────────────────────────────
    function _renderKpis() {
        let total=0, active=0;
        _allDays.forEach(d => {
            const t = parseFloat(d.total);
            if (!isNaN(t) && t > 0) { total+=t; active++; }
        });
        const avg = active > 0 ? total/active : 0;
        _setText('kpi-total', total.toFixed(1)+'h');
        _setText('kpi-dias', String(active));
        _setText('kpi-avg', avg.toFixed(1)+'h');
        _setText('kpi-tareas', String(_data.tasks.length));
    }

    // ─── Tab: Resumen ────────────────────────────
    function _renderResumen() {
        const c = document.getElementById('panel-resumen');
        if (!c) return;
        c.replaceChildren();

        // Task summary table
        if (_data.tasks.length > 0) {
            const sec = _el('div','resumen-section');
            const h = _el('div','panel-subtitle'); h.textContent = 'Resumen de tareas del mes'; sec.appendChild(h);

            const wrap = _el('div','table-wrap');
            const table = document.createElement('table'); table.className='data-table';
            const thead = document.createElement('thead');
            const hr = document.createElement('tr');
            ['Tarea','H. Emp.','H. Est.','Diferencia'].forEach(txt => {
                const th = document.createElement('th');
                th.textContent = txt; hr.appendChild(th);
            });
            thead.appendChild(hr); table.appendChild(thead);

            const tbody = document.createElement('tbody');
            _data.tasks.forEach(t => {
                const tr = document.createElement('tr');
                const tdT = _td(t.task,'cell-task');
                const tdE = _td(t.horas_emp ? t.horas_emp+'h' : '—','cell-num accent-blue');
                const tdEst = _td(t.horas_est ? t.horas_est+'h' : '—','cell-num');
                let difClass = 'cell-num';
                let difText = '—';
                if (t.horas_dif) {
                    const d = parseFloat(t.horas_dif);
                    difText = (d>0?'▼ -':d<0?'▲ +':'')+Math.abs(d)+'h';
                    difClass = 'cell-num ' + (d>0?'accent-red':d<0?'accent-green':'');
                }
                const tdD = _td(difText, difClass);
                tr.append(tdT,tdE,tdEst,tdD); tbody.appendChild(tr);
            });
            table.appendChild(tbody); wrap.appendChild(table); sec.appendChild(wrap); c.appendChild(sec);
        }

        // Hours by task aggregated from daily
        const taskMap = {};
        _allDays.forEach(d => d.entries.forEach(e => {
            const h = parseFloat(e.horas); if(isNaN(h)) return;
            taskMap[e.task] = (taskMap[e.task]||0)+h;
        }));
        const sorted = Object.entries(taskMap).sort((a,b)=>b[1]-a[1]);

        if (sorted.length > 0) {
            const sec2 = _el('div','resumen-section');
            const h2 = _el('div','panel-subtitle'); h2.textContent = 'Horas registradas por tarea'; sec2.appendChild(h2);
            const chart = _el('div','bar-chart');
            const maxH = sorted[0][1];
            sorted.forEach(([task,h]) => {
                const row = _el('div','bar-row');
                const lbl = _el('div','bar-label'); lbl.textContent = task; lbl.title = task;
                const wrap = _el('div','bar-wrap');
                const fill = _el('div','bar-fill'); fill.style.width = ((h/maxH)*100)+'%';
                const val = _el('span','bar-val'); val.textContent = h.toFixed(1)+'h';
                wrap.append(fill,val); row.append(lbl,wrap); chart.appendChild(row);
            });
            sec2.appendChild(chart); c.appendChild(sec2);
        } else {
            c.appendChild(_empty('Sin datos diarios registrados para este mes'));
        }
    }

    // ─── Tab: Diario ─────────────────────────────
    function _renderDiario() {
        const c = document.getElementById('panel-diario');
        if (!c) return;
        c.replaceChildren();
        if (!_allDays.length) { c.appendChild(_empty('Sin datos para este mes')); return; }

        const list = _el('div','day-cards');
        _allDays.forEach(dayData => {
            if (!dayData.entries.length) return;
            const card = _el('div','day-card');
            const hdr = _el('div','day-card-header');
            const title = _el('div','day-card-title'); title.textContent = dayData.day;
            const total = _el('div','day-card-total'); total.textContent = dayData.total ? dayData.total+'h' : '';
            hdr.append(title,total); card.appendChild(hdr);

            const entries = _el('div','day-entries');
            dayData.entries.forEach(e => {
                const row = _el('div','entry-row'+(e.isCustom?' entry-custom':''));
                const time = _el('div','entry-time'); time.textContent = e.horario || '—';
                const task = _el('div','entry-task'); task.textContent = e.task;
                const horas = _el('div','entry-horas'); horas.textContent = e.horas+'h';
                row.append(time,task,horas);
                if (e.nota) {
                    const nota = _el('div','entry-nota'); nota.textContent = e.nota;
                    row.appendChild(nota);
                }
                entries.appendChild(row);
            });
            card.appendChild(entries);
            list.appendChild(card);
        });
        c.appendChild(list);
    }

    // ─── Tab: Semanal ─────────────────────────────
    function _renderSemanal() {
        const c = document.getElementById('panel-semanal');
        if (!c) return;
        c.replaceChildren();
        if (!_allDays.length) { c.appendChild(_empty('Sin datos para este mes')); return; }

        // Group by work weeks (Mon–Fri)
        const DAYS_ES = ['Lunes','Martes','Miércoles','Jueves','Viernes'];
        const weeks = [];
        let week = [], wn = 1;
        _allDays.forEach((d,i) => {
            week.push(d);
            const dayName = d.day.split(' ')[0];
            if (dayName === 'Viernes' || i === _allDays.length-1) {
                weeks.push({num:wn++, days:week}); week=[];
            }
        });
        if (week.length) weeks.push({num:wn,days:week});

        weeks.forEach(w => {
            const wTotal = w.days.reduce((acc,d)=>{ const t=parseFloat(d.total); return acc+(isNaN(t)?0:t); }, 0);
            const sec = _el('div','week-section');
            const hdr = _el('div','week-header');
            const wTitle = _el('div','week-title'); wTitle.textContent = `Semana ${w.num}`;
            const wTot = _el('div','week-total'); wTot.textContent = wTotal.toFixed(1)+'h total';
            hdr.append(wTitle,wTot); sec.appendChild(hdr);

            const grid = _el('div','week-grid');
            w.days.forEach(d => {
                const card = _el('div','week-day-card');
                const dName = _el('div','week-day-name'); dName.textContent = d.day;
                const t = parseFloat(d.total);
                const dH = _el('div','week-day-horas'+((!isNaN(t)&&t>0)?' accent-blue':'')); dH.textContent = isNaN(t)?'—':t+'h';
                card.append(dName,dH);
                const dEntries = _el('div','week-entries');
                d.entries.forEach(e => {
                    const row = _el('div','week-entry');
                    const eTask = _el('span','week-entry-task'); eTask.textContent = e.task; eTask.title = e.task;
                    const eH = _el('span','week-entry-h'); eH.textContent = e.horas+'h';
                    row.append(eTask,eH); dEntries.appendChild(row);
                });
                card.appendChild(dEntries); grid.appendChild(card);
            });
            sec.appendChild(grid); c.appendChild(sec);
        });
    }

    // ─── Tab: Por tareas ──────────────────────────
    function _renderTareas() {
        const c = document.getElementById('panel-tareas');
        if (!c) return;
        c.replaceChildren();

        const taskMap = {};
        _allDays.forEach(d => d.entries.forEach(e => {
            const h = parseFloat(e.horas); if(isNaN(h)) return;
            if(!taskMap[e.task]) taskMap[e.task]={total:0,entries:[]};
            taskMap[e.task].total+=h;
            taskMap[e.task].entries.push({day:d.day,horas:e.horas,horario:e.horario,nota:e.nota});
        }));
        const sorted = Object.entries(taskMap).sort((a,b)=>b[1].total-a[1].total);
        if (!sorted.length) { c.appendChild(_empty('Sin entradas registradas')); return; }

        const maxH = sorted[0][1].total;
        const cards = _el('div','task-cards');
        sorted.forEach(([task,info]) => {
            const card = _el('div','task-card');
            const hdr = _el('div','task-card-header');
            const title = _el('div','task-card-title'); title.textContent = task; title.title = task;
            const tot = _el('div','task-card-total'); tot.textContent = info.total.toFixed(1)+'h';
            hdr.append(title,tot); card.appendChild(hdr);

            const bWrap = _el('div','task-bar-wrap');
            const bFill = _el('div','task-bar-fill'); bFill.style.width = ((info.total/maxH)*100)+'%';
            bWrap.appendChild(bFill); card.appendChild(bWrap);

            const details = document.createElement('details');
            details.className='task-details';
            const summary = document.createElement('summary');
            summary.className='task-details-summary';
            summary.textContent = `${info.entries.length} registros — haz clic para expandir`;
            details.appendChild(summary);

            info.entries.forEach(e => {
                const row = _el('div','task-entry-row');
                const eDay = _el('span','task-entry-day'); eDay.textContent = e.day;
                const eTime = _el('span','task-entry-time'); eTime.textContent = e.horario || '';
                const eH = _el('span','task-entry-h'); eH.textContent = e.horas+'h';
                row.append(eDay,eTime,eH);
                if (e.nota) { const n=_el('div','task-entry-nota'); n.textContent=e.nota; row.appendChild(n); }
                details.appendChild(row);
            });
            card.appendChild(details); cards.appendChild(card);
        });
        c.appendChild(cards);
    }

    // ─── Tab: Añadir ──────────────────────────────
    function _renderAnadir() {
        // Populate day select with days from current month
        const sel = document.getElementById('add-day-select');
        if (!sel) return;
        sel.replaceChildren();
        const data = HORAS_DATA[_month] || { days: [] };
        data.days.forEach(d => {
            const opt = document.createElement('option');
            opt.value = d.day; opt.textContent = d.day; sel.appendChild(opt);
        });
        const newOpt = document.createElement('option');
        newOpt.value = '__custom__'; newOpt.textContent = '+ Escribir día...';
        sel.appendChild(newOpt);
        sel.addEventListener('change', e => {
            const custom = document.getElementById('add-day-custom');
            if (custom) custom.style.display = e.target.value === '__custom__' ? 'block' : 'none';
        });
    }

    function submitTask() {
        const sel = document.getElementById('add-day-select');
        const customDay = document.getElementById('add-day-custom');
        const task = document.getElementById('add-task')?.value?.trim();
        const horas = document.getElementById('add-horas')?.value?.trim();
        const horario = document.getElementById('add-horario')?.value?.trim();
        const nota = document.getElementById('add-nota')?.value?.trim();

        let day = sel?.value;
        if (day === '__custom__') day = customDay?.value?.trim();

        const resultEl = document.getElementById('add-result');
        const showResult = (msg, ok) => {
            if (!resultEl) return;
            resultEl.textContent = msg;
            resultEl.className = 'add-result ' + (ok ? 'ok' : 'err');
        };

        if (!day) return showResult('Selecciona o escribe un día', false);
        if (!task) return showResult('Escribe el nombre de la tarea', false);
        const horasNum = parseFloat(horas);
        if (isNaN(horasNum) || horasNum <= 0) return showResult('Introduce un número de horas válido', false);

        if (!_custom[_month]) _custom[_month] = [];
        _custom[_month].push({ day, task, horas: String(horasNum), horario: horario||'', nota: nota||'' });

        _saveLocal();
        _syncToGist();

        // Clear form
        if (resultEl) resultEl.className = 'add-result';
        ['add-task','add-horas','add-horario','add-nota'].forEach(id => {
            const el = document.getElementById(id); if(el) el.value='';
        });
        if (customDay) customDay.style.display='none';
        if (sel) sel.selectedIndex=0;

        _render();
        switchTab('diario');
        showResult('✓ Entrada añadida correctamente', true);
    }

    // ─── Gist sync ────────────────────────────────
    async function _loadFromGist() {
        _setSyncStatus('loading');
        try {
            const data = await Gist.read();
            if (data) {
                _custom = data;
                _saveLocal();
                _render();
            }
            _setSyncStatus('ok');
        } catch(e) {
            _setSyncStatus('error');
        }
    }

    async function _syncToGist() {
        if (!Gist.isConfigured()) return;
        _setSyncStatus('loading');
        try {
            await Gist.write(_custom);
            _setSyncStatus('ok');
        } catch(e) {
            _setSyncStatus('error');
        }
    }

    function _setSyncStatus(state) {
        const el = document.getElementById('sync-status');
        const txt = document.getElementById('sync-text');
        if (!el) return;
        el.className = 'sync-status sync-' + state;
        const labels = { ok:'Sincronizado', loading:'Sincronizando…', error:'Error Gist', offline:'Sin Gist' };
        if (txt) txt.textContent = labels[state] || state;
    }

    // ─── Gist modal ────────────────────────────────
    function openGistModal() {
        document.getElementById('modal-gist')?.classList.add('active');
        const tok = document.getElementById('gist-token');
        if (tok) tok.value = Gist.getToken() || '';
        const gid = document.getElementById('gist-id');
        if (gid) gid.value = Gist.getGistId() || '';
    }
    function closeGistModal() { document.getElementById('modal-gist')?.classList.remove('active'); }

    async function saveGistConfig() {
        const token = document.getElementById('gist-token')?.value?.trim();
        const gistId = document.getElementById('gist-id')?.value?.trim();
        const statusEl = document.getElementById('gist-modal-status');
        if (!token) { if(statusEl){statusEl.textContent='Introduce un token'; statusEl.className='modal-field-error';} return; }

        if(statusEl){statusEl.textContent='Validando token…'; statusEl.className='modal-field-info';}
        try {
            const user = await Gist.validateToken(token);
            Gist.setToken(token);
            if (gistId) Gist.setGistId(gistId);
            localStorage.setItem('horas-gist-token', token);
            if (gistId) localStorage.setItem('horas-gist-id', gistId);
            if(statusEl){statusEl.textContent=`✓ Conectado como @${user}`; statusEl.className='modal-field-ok';}
            _setSyncStatus('ok');
            await _loadFromGist();
            setTimeout(closeGistModal, 1000);
        } catch(e) {
            if(statusEl){statusEl.textContent='Token inválido: '+e.message; statusEl.className='modal-field-error';}
            _setSyncStatus('error');
        }
    }

    function disconnectGist() {
        localStorage.removeItem('horas-gist-token');
        localStorage.removeItem('horas-gist-id');
        Gist.setToken(null); Gist.setGistId(null);
        _setSyncStatus('offline');
        closeGistModal();
    }

    // ─── Theme ────────────────────────────────────
    function toggleTheme() {
        const html = document.documentElement;
        const current = html.getAttribute('data-theme') || 'dark';
        const next = current === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', next);
        localStorage.setItem('horas-theme', next);
        const moon = document.querySelector('.icon-moon');
        const sun = document.querySelector('.icon-sun');
        if (moon) moon.style.display = next==='dark'?'':'none';
        if (sun)  sun.style.display  = next==='light'?'':'none';
    }

    // ─── DOM helpers ─────────────────────────────
    function _el(tag,cls) { const e=document.createElement(tag); if(cls)e.className=cls; return e; }
    function _td(text,cls) { const td=document.createElement('td'); if(cls)td.className=cls; td.textContent=text; return td; }
    function _setText(id,text) { const e=document.getElementById(id); if(e) e.textContent=text; }
    function _empty(msg) {
        const d=_el('div','empty-state');
        const svgStr='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
        const doc=new DOMParser().parseFromString(svgStr,'image/svg+xml');
        d.appendChild(doc.documentElement);
        const p=_el('p'); p.textContent=msg; d.appendChild(p);
        return d;
    }

    return { init, switchTab, prevMonth, nextMonth, submitTask, openGistModal, closeGistModal, saveGistConfig, disconnectGist, toggleTheme };
})();
