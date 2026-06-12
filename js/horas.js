"use strict";

const Horas = (function () {
  let _month = "";
  let _tab = "mensual";
  let _custom = { tickets: [], months: {} };
  let MONTHS_ORDER = [];
  let MONTH_LABELS = {};

  function _generateMonths() {
    MONTHS_ORDER = [];
    MONTH_LABELS = {};

    let startYear = 25;
    let endYear = 30; // Pre-generar hasta 2030

    const ms = [
      "",
      "ENERO",
      "FEBRERO",
      "MARZO",
      "ABRIL",
      "MAYO",
      "JUNIO",
      "JULIO",
      "AGOSTO",
      "SEPTIEMBRE",
      "OCTUBRE",
      "NOVIEMBRE",
      "DICIEMBRE",
    ];

    for (let y = startYear; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const yy = String(y).padStart(2, "0");
        const key = `${mm}-${yy}`;
        MONTHS_ORDER.push(key);
        MONTH_LABELS[key] = `${ms[m]} 20${yy}`;
      }
    }
  }

  function init() {
    _loadLocal();
    _initGist();
  }

  function _onDataLoaded() {
    _migrateTickets();
    _generateMonths();
    _initMonthSelect();

    const now = new Date();
    const mmyy = `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getFullYear()).slice(-2)}`;
    _month = MONTHS_ORDER.includes(mmyy)
      ? mmyy
      : MONTHS_ORDER[MONTHS_ORDER.length - 1];
    _syncSelect();
    _render();

    // Remove global loader after everything has finished rendering (artificial delay for bank-like feel)
    setTimeout(() => {
      document.body.classList.remove("is-sync-loading");
    }, 600);
  }

  function _migrateTickets() {
    if (!_custom.months) return;
    Object.keys(_custom.months).forEach((mKey) => {
      const mData = _custom.months[mKey];
      if (!mData.tickets) {
        mData.tickets = [];
        const tSet = new Set();
        Object.keys(mData).forEach((id) => {
          if (id !== "tickets" && !mData[id].deleted && mData[id].task) {
            tSet.add(mData[id].task);
          }
        });
        mData.tickets = Array.from(tSet);
      }
    });
  }

  function _loadLocal() {
    try {
      const s = localStorage.getItem("horas-custom");
      if (s) {
        const c = JSON.parse(s);
        // Migración si venía del formato anterior
        if (!c.months) {
          _custom = { tickets: [], months: c };
        } else {
          _custom = c;
        }
      }
    } catch (_) { }
  }

  function _saveLocal() {
    try {
      localStorage.setItem("horas-custom", JSON.stringify(_custom));
    } catch (_) { }
  }

  function _initMonthSelect() {
    const selY = document.getElementById("month-select-y");
    const selM = document.getElementById("month-select-m");
    if (selY) {
      selY.replaceChildren();
      for (let y = 25; y <= 30; y++) {
        const opt = document.createElement("option");
        opt.value = String(y).padStart(2, "0");
        opt.textContent = "20" + y;
        selY.appendChild(opt);
      }
      selY.addEventListener("change", (e) => {
        if (selM) {
          _month = selM.value + "-" + e.target.value;
          _render();
        }
      });
    }
    if (selM) {
      selM.addEventListener("change", (e) => {
        if (selY) {
          _month = e.target.value + "-" + selY.value;
          _render();
        }
      });
    }
  }

  function _initGist() {
    const token = localStorage.getItem("horas-gist-token");
    const gistId = localStorage.getItem("horas-gist-id");
    if (token) {
      Gist.setToken(token);
      _setSyncStatus("ok");
    }
    if (gistId) Gist.setGistId(gistId);
    if (token && gistId) {
      _loadFromGist();
    } else {
      _onDataLoaded();
    }
  }

  function prevMonth() {
    const i = MONTHS_ORDER.indexOf(_month);
    if (i > 0) {
      _month = MONTHS_ORDER[i - 1];
      _syncSelect();
      _render();
    }
  }

  function nextMonth() {
    const i = MONTHS_ORDER.indexOf(_month);
    if (i < MONTHS_ORDER.length - 1) {
      _month = MONTHS_ORDER[i + 1];
      _syncSelect();
      _render();
    }
  }

  function _syncSelect() {
    const [m, y] = _month.split("-");
    const selM = document.getElementById("month-select-m");
    const selY = document.getElementById("month-select-y");
    if (selM) selM.value = m;
    if (selY) selY.value = y;
  }

  function switchTab(tabId) {
    _tab = tabId;
    const tabs = ["mensual", "tareas", "anadir"];
    tabs.forEach((t) => {
      const btn = document.getElementById(`tab-${t}`);
      const panel = document.getElementById(`panel-${t}`);
      if (btn && panel) {
        if (t === tabId) {
          btn.classList.add("active");
          panel.classList.add("active");
          panel.style.display = "block";
        } else {
          btn.classList.remove("active");
          panel.classList.remove("active");
          panel.style.display = "none";
        }
      }
    });
    _render();
  }

  function parseHoras(str) {
    if (!str) return 0;
    // Split on: comma, semicolon, or " y " / " & " (with surrounding spaces)
    // Do NOT split on bare spaces so "07:00 - 08:00" stays intact
    const ranges = str.split(/[,;]|\s+[y&]\s+/);
    let total = 0;
    ranges.forEach((r) => {
      r = r.trim();
      const m = r.match(
        /(\d{1,2})[:\.]?(\d{2})?\s*[-a]\s*(\d{1,2})[:\.]?(\d{2})?/,
      );
      if (m) {
        let h1 = parseInt(m[1] || 0),
          m1 = parseInt(m[2] || 0);
        let h2 = parseInt(m[3] || 0),
          m2 = parseInt(m[4] || 0);
        if (h1 < 6 && h2 >= 12 && !r.includes("-")) h1 += 12;
        if (h2 < h1) h2 += 12;
        total += h2 + m2 / 60 - (h1 + m1 / 60);
      }
    });
    return Math.round(total * 10) / 10;
  }

  function _getMonthlyData() {
    const base = { tasks: [], days: [] };
    if (!_custom.months[_month]) return base;

    const cust = _custom.months[_month];

    Object.keys(cust).forEach((id) => {
      if (id === "tickets" || id === "ticketEstimadas") return;
      const mod = cust[id];
      if (!mod || typeof mod !== "object" || Array.isArray(mod) || !mod.day) return;
      if (mod.deleted) return;

      let day = base.days.find((d) => d.day === mod.day);
      if (!day) {
        const numMatch = mod.day.match(/\d+/);
        const n = numMatch ? parseInt(numMatch[0]) : 999;
        day = { day: mod.day, entries: [], n };
        base.days.push(day);
      }
      mod.id = id;
      day.entries.push(mod);
    });

    base.days.sort((a, b) => (a.n || 0) - (b.n || 0));

    // Ordenar entradas de cada día por hora de inicio del horario
    const _getStartMin = (horario) => {
      if (!horario || horario === "-" || horario === "—" || horario === "Jornada completa") return Infinity;
      const m = horario.match(/(\d{1,2})[:\.]?(\d{2})?/);
      if (!m) return Infinity;
      return parseInt(m[1] || 0) * 60 + parseInt(m[2] || 0);
    };
    base.days.forEach((d) => {
      d.entries.sort((a, b) => _getStartMin(a.horario) - _getStartMin(b.horario));
    });

    base.days.forEach((d) => {
      let s = 0;
      d.entries.forEach((e) => (s += parseFloat(e.horas || 0)));
      d.total = s > 0 ? s.toString() : "";
    });

    const tMap = {};
    base.days.forEach((d) => {
      d.entries.forEach((e) => {
        if (e.task && e.estado === "normal") {
          if (!tMap[e.task]) tMap[e.task] = 0;
          tMap[e.task] += parseFloat(e.horas || 0);
        }
      });
    });

    Object.keys(tMap).forEach((k) => {
      base.tasks.push({ task: k, horas_emp: tMap[k].toString() });
    });
    base.tasks.sort(
      (a, b) => parseFloat(b.horas_emp) - parseFloat(a.horas_emp),
    );

    return base;
  }

  function _render() {
    const lbl = MONTH_LABELS[_month] || _month;
    document.getElementById("month-label").textContent = lbl;

    const data = _getMonthlyData();
    _renderKPIs(data);
    _renderResumen(data);

    if (_tab === "mensual") _renderMensual(data);
    else if (_tab === "tareas") _renderTareas(data);
    else if (_tab === "anadir") _renderAnadir(data);
  }

  function _renderKPIs(data) {
    let th = 0;
    let tConVacas = 0;
    let tConFest = 0;

    data.days.forEach((d) => {
      d.entries.forEach((e) => {
        const h = parseFloat(e.horas || 0);
        if (e.estado === "normal") {
          th += h;
          tConVacas += h;
          tConFest += h;
        } else if (e.estado === "vacaciones") {
          tConVacas += h;
          tConFest += h;
        } else if (e.estado === "festivol" || e.estado === "festivon") {
          tConFest += h;
        }
      });
    });

    document.getElementById("kpi-total").textContent =
      th > 0 ? th.toFixed(1) : "0";
    document.getElementById("kpi-con-vacas").textContent =
      tConVacas > 0 ? tConVacas.toFixed(1) : "0";
    document.getElementById("kpi-con-fest").textContent =
      tConFest > 0 ? tConFest.toFixed(1) : "0";
  }

  function getTaskColor(str) {
    if (!str || str === "Ausencia / Festivo") return "var(--accent-blue)";

    // Normalizar para que tickets de otros meses compartan color sin importar espacios/mayúsculas
    const normalizedStr = str.trim().toLowerCase();

    let hash = 0;
    for (let i = 0; i < normalizedStr.length; i++) {
      hash = normalizedStr.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Multiplicar por un primo como 137 (aproximación al ángulo áureo) separa muchísimo los colores contiguos
    const hue = Math.abs(hash * 137) % 360;
    return `hsl(${hue}, 80%, 65%)`;
  }

  function toggleTodoElDia() {
    const cb = document.getElementById("add-todo-dia");
    const horInp = document.getElementById("add-horario");
    if (cb && horInp) {
      if (cb.checked) {
        horInp.dataset.oldVal = horInp.value;
        horInp.value = "Jornada completa";
        horInp.disabled = true;
      } else {
        horInp.value = horInp.dataset.oldVal || "";
        horInp.disabled = false;
      }
    }
  }

  function _renderResumen(data) {
    const p = document.getElementById("fixed-resumen");

    const estMap = (_custom.months[_month] && _custom.months[_month].ticketEstimadas) || {};

    let html = `
        <div class="card mb-5">
            <div class="card-header d-flex justify-between align-center">
                <span class="card-title">Gestión de Tickets</span>
            </div>
            <div class="d-flex gap-2 align-center justify-between mt-4" style="flex-wrap: wrap;">
                <div class="d-flex gap-2">
                    <button class="btn btn-primary" onclick="Horas.openCreateModal()">Crear ticket</button>
                    <button class="btn btn-primary" onclick="Horas.openCloneModal()" style="background:var(--accent-purple,#7c3aed); border-color:var(--accent-purple,#7c3aed);">
                        Clonar ticket
                    </button>
                </div>
                <button class="btn btn-outline" style="color:var(--text-secondary); border-color:var(--glass-border);" onclick="Horas.exportToMD()" title="Exportar tabla a Markdown">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" style="margin-right:6px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Exportar Tabla
                </button>
            </div>`;

    if (!_custom.months[_month]) _custom.months[_month] = { tickets: [] };
    const monthTickets = (_custom.months[_month].tickets || []).filter(
      (t) => t !== "Ausencia / Festivo",
    );

    if (monthTickets.length > 0) {
      const taskHoursMap = {};
      let totalMes = 0;
      data.tasks.forEach((t) => {
        taskHoursMap[t.task] = parseFloat(t.horas_emp);
        totalMes += parseFloat(t.horas_emp);
      });

      html += `
        <div class="d-flex align-center" style="margin-top:1.25rem; padding:0 0 0.5rem 0; border-bottom:1px solid var(--border-color); font-size:0.72rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-secondary);">
          <span style="flex:1;">Ticket</span>
          <span style="min-width:90px; text-align:center;">Ded.</span>
          <span style="min-width:90px; text-align:center;">Est.</span>
          <span style="min-width:90px; text-align:center;">Dif.</span>
          <span style="width:72px; flex-shrink:0;"></span>
        </div>`;

      const sortedTickets = [...monthTickets].sort((a, b) => a.localeCompare(b));

      sortedTickets.forEach((t) => {
        const hDed = taskHoursMap[t] || 0;
        const hEst = estMap[t] != null ? parseFloat(estMap[t]) : null;
        const hDif = hEst != null ? (hDed - hEst) : null;
        const w = Math.min(100, (hDed / Math.max(totalMes, 1)) * 100);
        const color = getTaskColor(t);

        let difColor = "var(--text-secondary)";
        let difText = "\u2014";
        if (hDif !== null) {
          difText = (hDif >= 0 ? "+" : "") + hDif.toFixed(1) + "h";
          difColor = hDif > 0 ? "var(--accent-red)" : (hDif < 0 ? "var(--accent-green, #4ade80)" : "var(--text-secondary)");
        }

        const estText = hEst != null ? hEst.toFixed(1) + "h" : "\u2014";
        const estColor = hEst != null ? "var(--text-secondary)" : "rgba(255,255,255,0.25)";
        const tEsc = t.replace(/\'/g, "\\\'").replace(/"/g, "&quot;");

        html += `
          <div class="d-flex flex-column" style="border-bottom:1px solid var(--border-color);">
            <div class="d-flex align-center" style="padding:0.75rem 0; gap:0;">
              <svg style="margin-right:8px; color:${color}; flex-shrink:0;" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="4" fill="currentColor"></circle>
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z"></path>
              </svg>
              <span style="font-weight:500; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t}</span>
              <span style="min-width:90px; text-align:center; color:${color}; font-weight:700; font-size:0.9rem;">${hDed > 0 ? hDed.toFixed(1) + "h" : "0h"}</span>
              <span style="min-width:90px; text-align:center; color:${estColor}; font-size:0.9rem; font-weight:${hEst != null ? '600' : '400'};">${estText}</span>
              <span style="min-width:90px; text-align:center; color:${difColor}; font-size:0.9rem; font-weight:600;">${difText}</span>
              <div class="d-flex gap-1" style="width:72px; flex-shrink:0; justify-content:flex-end; padding-left:8px;">
                <button title="Editar" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; border:1px solid var(--glass-border); background:transparent; cursor:pointer; color:var(--text-secondary); transition:all 0.15s;" onmouseover="this.style.borderColor='rgba(99,102,241,0.5)';this.style.color='var(--accent-blue-light)'" onmouseout="this.style.borderColor='var(--glass-border)';this.style.color='var(--text-secondary)'" onclick="Horas.editTicket('${tEsc}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button title="Eliminar" style="display:flex; align-items:center; justify-content:center; width:28px; height:28px; border-radius:6px; border:1px solid var(--glass-border); background:transparent; cursor:pointer; color:var(--text-secondary); transition:all 0.15s;" onmouseover="this.style.borderColor='rgba(239,68,68,0.5)';this.style.color='var(--accent-red)'" onmouseout="this.style.borderColor='var(--glass-border)';this.style.color='var(--text-secondary)'" onclick="Horas.deleteTicket('${tEsc}')">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>
            <div style="padding:0 0 0.6rem 24px;">
              <div class="task-bar-wrap m-0" style="height:5px;">
                <div style="width:${w}%; height:100%; background:${color}; border-radius:3px; transition:width 0.4s ease;"></div>
              </div>
            </div>
          </div>`;
      });
    } else {
      html += `<div class="empty-state w-100" style="border:none; margin-top:1rem;">No hay tickets dados de alta.</div>`;
    }

    html += `</div>`;
    p.innerHTML = html;
  }

  function openCreateModal() {
    const modal = document.getElementById("create-ticket-modal");
    if (!modal) return;
    const nameEl = document.getElementById("new-ticket-name");
    const estEl = document.getElementById("new-ticket-estimadas");
    if (nameEl) nameEl.value = "";
    if (estEl) estEl.value = "";
    modal.classList.add("active");
    setTimeout(() => { if (nameEl) nameEl.focus(); }, 80);
  }

  function closeCreateModal() {
    const modal = document.getElementById("create-ticket-modal");
    if (modal) modal.classList.remove("active");
  }

  function addTicket() {
    const nameEl = document.getElementById("new-ticket-name");
    const estEl = document.getElementById("new-ticket-estimadas");
    const val = nameEl ? nameEl.value.trim() : "";
    const estVal = estEl ? estEl.value.trim() : "";
    if (!val) return;

    if (!_custom.months[_month]) _custom.months[_month] = { tickets: [] };
    if (!_custom.months[_month].tickets) _custom.months[_month].tickets = [];
    if (!_custom.months[_month].ticketEstimadas) _custom.months[_month].ticketEstimadas = {};
    if (!_custom.months[_month].tickets.includes(val)) {
      _custom.months[_month].tickets.push(val);
    }
    if (estVal !== "" && !isNaN(parseFloat(estVal))) {
      _custom.months[_month].ticketEstimadas[val] = parseFloat(estVal);
    }

    closeCreateModal();
    _saveLocal();
    _pushSync();
    _render();
  }

  // (duplicate addTicket removed — see definition above)

  async function updateTicketEstimadas(tName) {
    const current = (_custom.months[_month] && _custom.months[_month].ticketEstimadas && _custom.months[_month].ticketEstimadas[tName] != null)
      ? String(_custom.months[_month].ticketEstimadas[tName])
      : "";
    const res = await customPrompt("Horas estimadas para \"" + tName + "\" (deja vacío para quitar):", current);
    if (res === null) return; // cancelado
    if (!_custom.months[_month]) _custom.months[_month] = { tickets: [] };
    if (!_custom.months[_month].ticketEstimadas) _custom.months[_month].ticketEstimadas = {};
    const trimmed = res.trim();
    if (trimmed === "" || isNaN(parseFloat(trimmed))) {
      delete _custom.months[_month].ticketEstimadas[tName];
    } else {
      _custom.months[_month].ticketEstimadas[tName] = parseFloat(trimmed);
    }
    _saveLocal();
    _pushSync();
    _render();
  }

  function customPrompt(message, defaultValue = "") {
    return new Promise((resolve) => {
      const modal = document.getElementById("prompt-modal");
      const text = document.getElementById("prompt-modal-text");
      const input = document.getElementById("prompt-modal-input");
      const btnCancel = document.getElementById("prompt-modal-cancel");
      const btnOk = document.getElementById("prompt-modal-ok");

      text.textContent = message;
      input.value = defaultValue;
      modal.classList.add("active");
      input.focus();

      const cleanup = () => {
        modal.classList.remove("active");
        btnCancel.onclick = null;
        btnOk.onclick = null;
        input.onkeydown = null;
      };

      btnCancel.onclick = () => {
        cleanup();
        resolve(null);
      };

      btnOk.onclick = () => {
        cleanup();
        resolve(input.value);
      };

      input.onkeydown = (e) => {
        if (e.key === "Enter") {
          cleanup();
          resolve(input.value);
        } else if (e.key === "Escape") {
          cleanup();
          resolve(null);
        }
      };
    });
  }

  function customConfirm(message) {
    return new Promise((resolve) => {
      const modal = document.getElementById("confirm-modal");
      const text = document.getElementById("confirm-modal-text");
      const btnCancel = document.getElementById("confirm-modal-cancel");
      const btnOk = document.getElementById("confirm-modal-ok");

      text.textContent = message;
      modal.classList.add("active");

      const cleanup = () => {
        modal.classList.remove("active");
        btnCancel.onclick = null;
        btnOk.onclick = null;
      };

      btnCancel.onclick = () => {
        cleanup();
        resolve(false);
      };

      btnOk.onclick = () => {
        cleanup();
        resolve(true);
      };
    });
  }

  function editTicket(oldName) {
    // Open the edit modal pre-filled with current values
    const modal = document.getElementById("edit-ticket-modal");
    if (!modal) return;
    const nameEl = document.getElementById("edit-ticket-name");
    const estEl = document.getElementById("edit-ticket-estimadas");
    if (nameEl) nameEl.value = oldName;
    const curEst = (_custom.months[_month] && _custom.months[_month].ticketEstimadas && _custom.months[_month].ticketEstimadas[oldName] != null)
      ? _custom.months[_month].ticketEstimadas[oldName]
      : "";
    if (estEl) estEl.value = curEst;
    modal.dataset.oldName = oldName;
    modal.classList.add("active");
    setTimeout(() => { if (nameEl) nameEl.focus(); }, 80);
  }

  function closeEditModal() {
    const modal = document.getElementById("edit-ticket-modal");
    if (modal) modal.classList.remove("active");
  }

  function saveEditTicket() {
    const modal = document.getElementById("edit-ticket-modal");
    if (!modal) return;
    const oldName = modal.dataset.oldName || "";
    const nameEl = document.getElementById("edit-ticket-name");
    const estEl = document.getElementById("edit-ticket-estimadas");
    const newName = nameEl ? nameEl.value.trim() : "";
    const estVal = estEl ? estEl.value.trim() : "";

    if (!newName) return;

    const t = newName;

    // Update name in tickets list
    if (_custom.months[_month] && _custom.months[_month].tickets) {
      const idx = _custom.months[_month].tickets.indexOf(oldName);
      if (idx !== -1) _custom.months[_month].tickets[idx] = t;
    }

    // Update all entries using this ticket in the current month
    if (_custom.months[_month]) {
      Object.keys(_custom.months[_month]).forEach((k) => {
        if (k === "tickets" || k === "ticketEstimadas") return;
        const dayObj = _custom.months[_month][k];
        if (Array.isArray(dayObj)) {
          dayObj.forEach((e) => { if (e.task === oldName) e.task = t; });
        }
      });
    }

    // Update / remove estimated hours
    if (!_custom.months[_month].ticketEstimadas) _custom.months[_month].ticketEstimadas = {};
    // Remove old key if name changed
    if (oldName !== t && _custom.months[_month].ticketEstimadas[oldName] != null) {
      _custom.months[_month].ticketEstimadas[t] = _custom.months[_month].ticketEstimadas[oldName];
      delete _custom.months[_month].ticketEstimadas[oldName];
    }
    if (estVal !== "" && !isNaN(parseFloat(estVal))) {
      _custom.months[_month].ticketEstimadas[t] = parseFloat(estVal);
    } else {
      delete _custom.months[_month].ticketEstimadas[t];
    }

    closeEditModal();
    _saveLocal();
    _pushSync();
    _onDataLoaded();
  }

  async function deleteTicket(tName) {
    const ok = await customConfirm(
      `¿Seguro que quieres eliminar el ticket "${tName}" Y TODAS SUS HORAS REGISTRADAS este mes?`,
    );
    if (!ok) return;

    // Remove from tickets list
    if (_custom.months[_month] && _custom.months[_month].tickets) {
      const idx = _custom.months[_month].tickets.indexOf(tName);
      if (idx !== -1) {
        _custom.months[_month].tickets.splice(idx, 1);
      }
    }

    // Remove all entries for this ticket
    if (_custom.months[_month]) {
      Object.keys(_custom.months[_month]).forEach((k) => {
        if (k === "tickets") return;
        const dayObj = _custom.months[_month][k];
        if (Array.isArray(dayObj)) {
          for (let i = dayObj.length - 1; i >= 0; i--) {
            if (dayObj[i].task === tName) dayObj.splice(i, 1);
          }
          // If day has no entries left, you could delete the day, but it's fine to leave empty array
        }
      });
    }

    _saveLocal();
    _pushSync();
    _onDataLoaded();
  }

  function openCloneModal() {
    const cMonth = document.getElementById("clone-month");
    const cYear = document.getElementById("clone-year");
    const modal = document.getElementById("clone-modal");
    if (!cMonth || !cYear || !modal) return;

    // Build available months and years that have tickets
    const keys = Object.keys(_custom.months).filter((k) => {
      const ts = _custom.months[k].tickets || [];
      const valid = ts.filter((x) => x !== "Ausencia / Festivo");
      return valid.length > 0 && k !== _month;
    });

    const years = new Set();
    keys.forEach((k) => years.add(k.split("-")[1]));

    // Sort years ascending
    const sortedYears = Array.from(years).sort(
      (a, b) => parseInt(a) - parseInt(b),
    );
    let yHtml = "";
    sortedYears.forEach((y) => (yHtml += `<option value="${y}">${y}</option>`));
    cYear.innerHTML = yHtml;

    // Set to current month's year if possible or the latest
    const currentYear = _month.split("-")[1];
    if (sortedYears.includes(currentYear)) {
      cYear.value = currentYear;
    } else if (sortedYears.length > 0) {
      cYear.value = sortedYears[sortedYears.length - 1];
    }

    updateCloneMonthOptions(keys);
    updateCloneSelect();

    modal.classList.add("active");
  }

  function updateCloneMonthOptions(allKeys) {
    const cYear = document.getElementById("clone-year").value;
    const cMonth = document.getElementById("clone-month");
    const monthNames = [
      "Enero",
      "Febrero",
      "Marzo",
      "Abril",
      "Mayo",
      "Junio",
      "Julio",
      "Agosto",
      "Septiembre",
      "Octubre",
      "Noviembre",
      "Diciembre",
    ];

    // find all months in allKeys that match the year
    const monthsInYear = allKeys
      .filter((k) => k.split("-")[1] === cYear)
      .map((k) => k.split("-")[0]);
    const sortedMonths = monthsInYear.sort((a, b) => parseInt(a) - parseInt(b));

    let mHtml = "";
    sortedMonths.forEach((m) => {
      mHtml += `<option value="${m}-${cYear}">${monthNames[parseInt(m) - 1]}</option>`;
    });
    cMonth.innerHTML = mHtml;
  }

  function updateCloneSelect(isYearChange = false) {
    const allKeys = Object.keys(_custom.months).filter((k) => {
      const ts = _custom.months[k].tickets || [];
      const valid = ts.filter((x) => x !== "Ausencia / Festivo");
      return valid.length > 0 && k !== _month;
    });

    if (isYearChange) {
      updateCloneMonthOptions(allKeys);
    }

    const cMonth = document.getElementById("clone-month");
    const targetMonthKey = cMonth ? cMonth.value : null;

    const tSel = document.getElementById("clone-ticket-select");
    const cloneBtn = document.querySelector("#clone-modal .btn-primary");
    let html = "";
    let hasTickets = false;

    if (
      targetMonthKey &&
      _custom.months[targetMonthKey] &&
      _custom.months[targetMonthKey].tickets
    ) {
      const ts = _custom.months[targetMonthKey].tickets.filter(
        (t) => t !== "Ausencia / Festivo",
      );
      ts.forEach((t) => {
        html += `<option value="${t}">${t}</option>`;
      });
      if (ts.length > 0) hasTickets = true;
    }

    if (!hasTickets) {
      html = `<option value="">No hay tickets disponibles</option>`;
      tSel.disabled = true;
      if (cloneBtn) cloneBtn.disabled = true;
    } else {
      tSel.disabled = false;
      if (cloneBtn) cloneBtn.disabled = false;
    }

    tSel.innerHTML = html;
  }

  function cloneTicket() {
    const cTicket = document.getElementById("clone-ticket-select");
    if (!cTicket) return;
    const val = cTicket.value;
    if (val) {
      if (!_custom.months[_month]) _custom.months[_month] = { tickets: [] };
      if (!_custom.months[_month].tickets) _custom.months[_month].tickets = [];
      if (!_custom.months[_month].tickets.includes(val)) {
        _custom.months[_month].tickets.push(val);
        _saveLocal();
        _pushSync();
        _render();
      }
    }
    closeCloneModal();
  }

  function closeCloneModal() {
    const modal = document.getElementById("clone-modal");
    if (modal) modal.classList.remove("active");
  }

  function _renderMensual(data) {
    const p = document.getElementById("panel-mensual");
    if (data.days.length === 0) {
      p.innerHTML =
        '<div class="empty-state">No hay registros mensuales.</div>';
      return;
    }

    let html = "";
    let curWeek = [];
    let curWeekTotal = 0;

    const flush = () => {
      if (curWeek.length === 0) return;

      // Calculate actual week of the month for the first day in curWeek
      const match = curWeek[0].day.match(/\d+/);
      const firstDayNum = match ? parseInt(match[0]) : 1;
      const [mmStr, yyStr] = _month.split("-");
      const firstDateOfMonth = new Date(
        2000 + parseInt(yyStr),
        parseInt(mmStr) - 1,
        1,
      );
      const wDayFirst =
        firstDateOfMonth.getDay() === 0 ? 6 : firstDateOfMonth.getDay() - 1;
      const weekOfMonth = Math.floor((firstDayNum + wDayFirst - 1) / 7) + 1;

      html += `<div class="week-section mt-4">
                <div class="d-flex justify-between align-center mb-3" style="border-bottom:1px solid var(--border-color); padding-bottom:0.5rem;">
                  <h3 class="m-0" style="color:var(--text-secondary); font-size:1rem;">Semana ${weekOfMonth}</h3>
                  <span class="accent-blue" style="font-weight:600;">${curWeekTotal}h</span>
                </div>
                <div class="day-cards">`;

      curWeek.forEach((d) => {
        const mm = _month.split("-")[0];
        const isIntensiva = mm === "07" || mm === "08";
        const dayTotal = parseFloat(d.total || 0);
        const showWarn = isIntensiva && dayTotal > 7;
        const totalColor = showWarn
          ? "color:var(--accent-orange)"
          : "color:var(--accent-blue-light)";
        const warnIcon = showWarn
          ? `<span title="Límite jornada intensiva superado" style="font-size:0.8rem;margin-right:0.25rem;">⚠️</span>`
          : "";

        html += `<div class="card">
                  <div class="card-header d-flex justify-between align-center" style="padding-bottom: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); margin-bottom: 0.5rem;">
                      <span class="card-title" style="font-size: 0.95rem; font-weight: 700;">${d.day}</span>
                      <span class="card-total" style="font-weight: 600; font-size: 0.85rem; ${totalColor}">${warnIcon}${d.total || 0}h</span>
                  </div>`;
        d.entries.forEach((e) => {
          const est = e.estado && e.estado !== "normal" ? e.estado : "";
          const estCls = est ? `entry-row entry-${est}` : "entry-row";
          let badgeText = est.toUpperCase();
          if (badgeText === "FESTIVON" || badgeText === "FESTIVOL")
            badgeText = "FESTIVO";

          const estBadge = est
            ? `<span class="badge badge-${est}">${badgeText}</span> `
            : "";

          const tColor = getTaskColor(e.task || "");
          const taskBadge =
            e.task && e.task !== "Ausencia / Festivo"
              ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background-color:${tColor};margin-right:6px;box-shadow:0 0 4px ${tColor}"></span>`
              : "";

          const editIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
          const delIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;

          let horarioText =
            e.horario && e.horario !== "-" && e.horario !== "—"
              ? e.horario
              : "";
          if (horarioText === "Jornada completa") {
            const mm = _month.split("-")[0];
            const isIntensiva = mm === "07" || mm === "08";
            const isFriday = d.day.startsWith("Viernes");
            if (isIntensiva) {
              horarioText = "08:00 - 15:00";
            } else {
              horarioText = isFriday
                ? "07:00 - 14:00"
                : "08:00 - 15:00, 16:00 - 18:00";
            }
          }
          const noTimeCls = horarioText ? "" : " entry-no-time";
          const finalNota =
            e.nota && e.nota !== "Recuperado del histórico" ? e.nota : "";

          html += `
                    <div class="${estCls}${noTimeCls}">
                        ${horarioText ? `<div class="entry-time">${horarioText}</div>` : `<div class="entry-time d-none"></div>`}
                        <div class="entry-info">
                            <div class="entry-task">${estBadge}${taskBadge}${e.task || "—"}</div>
                            ${finalNota ? `<div class="entry-nota">${finalNota}</div>` : ""}
                        </div>
                        <div class="entry-horas">
                            <span style="margin-right:0.75rem; color:${tColor}; font-weight:600;">${e.horas}h</span>
                            <div class="entry-actions">
                                <button onclick="Horas.editEntry('${e.id}')" title="Editar" class="btn-icon">${editIcon}</button>
                                <button onclick="Horas.deleteEntry('${e.id}')" title="Borrar" class="btn-icon">${delIcon}</button>
                            </div>
                        </div>
                    </div>`;
        });
        html += `</div>`;
      });
      html += `</div></div>`;
      curWeek = [];
      curWeekTotal = 0;
    };

    data.days.forEach((d) => {
      if (!d.entries || d.entries.length === 0) return;

      if (curWeek.length > 0) {
        const match = d.day.match(/\d+/);
        const num = match ? parseInt(match[0]) : 1;
        const prevMatch = curWeek[curWeek.length - 1].day.match(/\d+/);
        const prevNum = prevMatch ? parseInt(prevMatch[0]) : 1;

        const [mmStr, yyStr] = _month.split("-");
        const y = 2000 + parseInt(yyStr);
        const m = parseInt(mmStr) - 1;

        const currDate = new Date(y, m, num);
        const prevDate = new Date(y, m, prevNum);

        const currWDay = currDate.getDay() === 0 ? 6 : currDate.getDay() - 1;
        const prevWDay = prevDate.getDay() === 0 ? 6 : prevDate.getDay() - 1;

        const mondayOfCurr = num - currWDay;
        const mondayOfPrev = prevNum - prevWDay;

        if (mondayOfCurr > mondayOfPrev) {
          flush();
        }
      }

      curWeek.push(d);
      curWeekTotal += parseFloat(d.total || 0);
    });
    flush();
    p.innerHTML = html;
  }

  function _renderTareas(data) {
    const p = document.getElementById("panel-tareas");
    const tasks = {};
    data.days.forEach((d) => {
      if (!d.entries) return;
      d.entries.forEach((e) => {
        if (!e.task || e.task === "Ausencia / Festivo") return;
        if (!tasks[e.task]) tasks[e.task] = { horas: 0, days: [] };
        tasks[e.task].horas += parseFloat(e.horas || 0);
        tasks[e.task].days.push({
          day: d.day,
          horas: e.horas,
          desc: e.nota || e.horario || "",
        });
      });
    });

    const arr = Object.keys(tasks)
      .map((k) => ({ t: k, h: tasks[k].horas, d: tasks[k].days }))
      .sort((a, b) => b.h - a.h);
    if (arr.length === 0) {
      p.innerHTML =
        '<div class="empty-state">No hay desglose por tareas.</div>';
      return;
    }

    let html = '<div class="day-cards">';
    arr.forEach((i) => {
      const color = getTaskColor(i.t);
      html += `<div class="card">
                <div class="card-header"><span class="card-title" style="color:${color}">${i.t}</span><span class="card-total"> - ${i.h}h</span></div>
                <div class="d-flex flex-column" style="margin-top:0.5rem;gap:4px">`;
      i.d.forEach((dd) => {
        html += `<div class="d-flex justify-between" style="font-size:0.8rem;padding:4px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
                    <span style="color:var(--text-muted)">${dd.day} ${dd.desc ? `(${dd.desc})` : ""}</span>
                    <span style="color:var(--text-secondary)">${dd.horas}h</span>
                </div>`;
      });
      html += `</div></div>`;
    });
    html += "</div>";
    p.innerHTML = html;
  }

  function _renderAnadir(data) {
    const tSel = document.getElementById("add-task");
    const dInp = document.getElementById("add-day-date");

    if (dInp) {
      const [mm, yy] = _month.split("-");
      const year = 2000 + parseInt(yy, 10);
      const month = parseInt(mm, 10);

      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDayObj = new Date(year, month, 0);
      const lastDay = `${year}-${String(month).padStart(2, "0")}-${String(lastDayObj.getDate()).padStart(2, "0")}`;

      dInp.min = firstDay;
      dInp.max = lastDay;

      if (!dInp.value || dInp.value < firstDay || dInp.value > lastDay) {
        const now = new Date();
        if (now.getFullYear() === year && now.getMonth() + 1 === month) {
          dInp.value = `${year}-${String(month).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
        } else {
          dInp.value = firstDay;
        }
      }
    }

    const oldTask = tSel.value;
    tSel.replaceChildren();
    const defOpt = document.createElement("option");
    defOpt.value = "";
    defOpt.textContent = "Selecciona un ticket (créalo primero en el Resumen)";
    tSel.appendChild(defOpt);

    if (!_custom.months[_month]) _custom.months[_month] = { tickets: [] };
    const monthTickets = _custom.months[_month].tickets || [];

    monthTickets.forEach((t) => {
      const o = document.createElement("option");
      o.value = t;
      o.textContent = t;
      tSel.appendChild(o);
    });
    if (oldTask && monthTickets.includes(oldTask)) tSel.value = oldTask;

    const stSel = document.getElementById("add-estado");
    const horInp = document.getElementById("add-horario");
    const cbTodo = document.getElementById("add-todo-dia");

    if (stSel && horInp) {
      stSel.onchange = (e) => {
        if (e.target.value !== "normal") {
          horInp.disabled = true;
          horInp.value = "";
          if (cbTodo) {
            cbTodo.checked = false;
            cbTodo.disabled = true;
          }
          const hasAusencia = Array.from(tSel.options).some(
            (o) => o.value === "Ausencia / Festivo",
          );
          if (!hasAusencia) {
            const opt = document.createElement("option");
            opt.value = "Ausencia / Festivo";
            opt.textContent = "Ausencia / Festivo";
            tSel.appendChild(opt);
          }
          tSel.value = "Ausencia / Festivo";
        } else {
          if (cbTodo) cbTodo.disabled = false;
          if (!cbTodo || !cbTodo.checked) {
            horInp.disabled = false;
          }
        }
      };
      if (stSel.value !== "normal") {
        stSel.dispatchEvent(new Event("change"));
      }
    }
  }

  function editEntry(id) {
    const data = _getMonthlyData();
    let entry = null;
    for (let d of data.days) {
      const f = d.entries.find((x) => x.id === id);
      if (f) {
        entry = f;
        entry.dayLabel = d.day;
        break;
      }
    }
    if (!entry) return;

    switchTab("anadir");
    document.getElementById("form-subtitle").textContent = "Editar entrada";
    document.getElementById("add-edit-id").value = id;
    document.getElementById("btn-add-cancel").style.display = "inline-block";

    const [mm, yy] = _month.split("-");
    const year = 2000 + parseInt(yy, 10);
    const num = entry.dayLabel.replace(/\D/g, "");
    if (num) {
      document.getElementById("add-day-date").value =
        `${year}-${mm}-${num.padStart(2, "0")}`;
    }

    document.getElementById("add-estado").value = entry.estado || "normal";
    document.getElementById("add-task").value = entry.task || "";
    document.getElementById("add-horario").value = entry.horario || "";
    document.getElementById("add-nota").value = entry.nota || "";
  }

  function cancelEdit() {
    document.getElementById("form-subtitle").textContent =
      "Nueva entrada de horas";
    document.getElementById("add-edit-id").value = "";
    document.getElementById("btn-add-cancel").style.display = "none";
    document.getElementById("add-task").value = "";

    const horInp = document.getElementById("add-horario");
    horInp.value = "";
    horInp.disabled = false;
    delete horInp.dataset.oldVal;

    const cbTodo = document.getElementById("add-todo-dia");
    if (cbTodo) {
      cbTodo.checked = false;
      cbTodo.disabled = false;
    }

    document.getElementById("add-nota").value = "";

    const stSel = document.getElementById("add-estado");
    stSel.value = "normal";
    stSel.dispatchEvent(new Event("change"));
  }

  function deleteEntry(id) {
    if (!confirm("¿Seguro que quieres borrar esta entrada?")) return;
    if (!_custom.months[_month]) _custom.months[_month] = {};
    delete _custom.months[_month][id];
    _saveLocal();
    _pushSync();
    _render();
  }

  function submitTask() {
    const res = document.getElementById("add-result");
    if (!res) return;
    try {
      const dateVal = document.getElementById("add-day-date").value;

      if (!dateVal) {
        res.innerHTML = `<div class="modal-field-error">Falta seleccionar la fecha</div>`;
        return;
      }

      // Parse as local date to avoid UTC offset shifting the day (e.g. UTC+2)
      const [dYear, dMon, dDay] = dateVal.split("-").map(Number);
      const dObj = new Date(dYear, dMon - 1, dDay);
      const dayNames = [
        "Domingo",
        "Lunes",
        "Martes",
        "Miércoles",
        "Jueves",
        "Viernes",
        "Sábado",
      ];
      const day = `${dayNames[dObj.getDay()]} ${dObj.getDate()}`;

      let task = document.getElementById("add-task").value.trim();
      let horario = document.getElementById("add-horario").value.trim();
      const nota = document.getElementById("add-nota").value.trim();
      const estado = document.getElementById("add-estado").value;
      const idToEdit = document.getElementById("add-edit-id").value;

      if (!day) {
        res.innerHTML = `<div class="modal-field-error">Falta el día</div>`;
        return;
      }

      let horas = 0;
      if (estado !== "normal" || horario === "Jornada completa") {
        if (estado !== "normal") {
          task = "Ausencia / Festivo";
          horario = "-";
        }
        const [mmStr] = _month.split("-");
        const mm = parseInt(mmStr, 10);
        const isIntensiva = mm === 7 || mm === 8;
        if (isIntensiva) {
          horas = 7;
          if (estado === "normal" && horario === "Jornada completa") {
            horario = "08:00 - 15:00";
          }
        } else {
          const isFriday = dObj.getDay() === 5;
          horas = isFriday ? 7 : 9;
          if (estado === "normal" && horario === "Jornada completa") {
            horario = isFriday ? "07:00 - 14:00" : "08:00 - 15:00, 16:00 - 18:00";
          }
        }
      } else {
        horas = parseHoras(horario);

        // Descuento parón 14:00-15:00: L-J, sept-jun, horario manual normal
        const paronMm = parseInt(_month.split("-")[0], 10);
        const paronIsIntensiva = paronMm === 7 || paronMm === 8;
        const paronDow = dObj.getDay(); // 0=Dom,1=Lun..4=Jue,5=Vie
        if (!paronIsIntensiva && paronDow >= 1 && paronDow <= 4) {
          const paronRanges = horario.split(/[,;]|\s+[y&]\s+/);
          let paronDeduccion = 0;
          paronRanges.forEach((r) => {
            r = r.trim();
            const pm = r.match(
              /(\d{1,2})[:\.]?(\d{2})?\s*[-a]\s*(\d{1,2})[:\.]?(\d{2})?/,
            );
            if (pm) {
              const ph1 = parseInt(pm[1] || 0) + parseInt(pm[2] || 0) / 60;
              const ph2 = parseInt(pm[3] || 0) + parseInt(pm[4] || 0) / 60;
              // El rango cruza completamente el parón (empieza antes de las 14 y acaba después de las 15)
              if (ph1 < 14 && ph2 > 15) {
                paronDeduccion += 1;
              }
            }
          });
          if (paronDeduccion > 0) {
            horas = Math.round((horas - paronDeduccion) * 10) / 10;
          }
        }

        if (horas <= 0) {
          if (!horario) {
            res.innerHTML = `<div class="modal-field-error">El horario es obligatorio para calcular las horas.</div>`;
          } else {
            res.innerHTML = `<div class="modal-field-error">No se pudieron calcular las horas. Revisa el formato del horario (ej: 08:00 - 17:00).</div>`;
          }
          return;
        }
      }

      if (!_custom.months) _custom.months = {};
      if (!_custom.months[_month]) _custom.months[_month] = {};

      const data = { day, task, horas, horario, nota, estado };
      const id = idToEdit || `cust_${Date.now()}`;
      _custom.months[_month][id] = data;

      res.innerHTML = `<div class="modal-field-ok">${idToEdit ? "Modificado" : "Añadido"} correctamente (+${horas}h)</div>`;
      _saveLocal();
      _pushSync();
      setTimeout(() => {
        res.innerHTML = "";
        cancelEdit();
        switchTab("mensual");
      }, 1000);
    } catch (err) {
      console.error("[submitTask] Error inesperado:", err);
      if (res) res.innerHTML = `<div class="modal-field-error">Error inesperado: ${err.message}</div>`;
    }
  }

  function exportToMD() {
    const data = _getMonthlyData();
    let mdContent = "";
    let total = 0;
    data.tasks.forEach((t) => {
      const horasNum = parseFloat(t.horas_emp);
      total += horasNum;
      mdContent += `| ${t.task} | ${horasNum}h |\n`;
    });
    mdContent += `|---|---|\n`;
    mdContent += `| Total horas | ${total}h |\n`;

    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, mdContent], {
      type: "text/markdown;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Reporte_${_month}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // -- GIST & THEME
  function openGistModal() {
    document.getElementById("modal-gist").classList.add("active");
    document.getElementById("gist-token").value = Gist.getToken() || "";
    document.getElementById("gist-id").value = Gist.getGistId() || "";
  }

  function closeGistModal() {
    document.getElementById("modal-gist").classList.remove("active");
    document.getElementById("gist-modal-status").innerHTML = "";
  }

  function _setSyncStatus(status) {
    const c = document.getElementById("sync-status");
    const t = document.getElementById("sync-text");
    c.className = "sync-status";
    if (status === "ok") {
      c.classList.add("sync-online");
      t.textContent = "Gist Sync OK";
    } else if (status === "syncing") {
      c.classList.add("sync-syncing");
      t.textContent = "Sincronizando...";
    } else {
      c.classList.add("sync-offline");
      t.textContent = "Sin Gist";
    }
  }

  async function saveGistConfig() {
    const token = document.getElementById("gist-token").value.trim();
    const gid = document.getElementById("gist-id").value.trim();
    const st = document.getElementById("gist-modal-status");

    if (!token) {
      st.innerHTML =
        '<div class="modal-field-error">El token es obligatorio.</div>';
      return;
    }

    st.innerHTML =
      '<div class="modal-field-info">Verificando conexión...</div>';
    Gist.setToken(token);

    try {
      if (gid) {
        Gist.setGistId(gid);
        await Gist.read();
        st.innerHTML =
          '<div class="modal-field-ok">Conectado a Gist existente.</div>';
      } else {
        // write() ya se encarga de crear el gist si no hay gistId configurado.
        await Gist.write(_custom);
        st.innerHTML = `<div class="modal-field-ok">Nuevo Gist creado (ID: ${Gist.getGistId()})</div>`;
      }

      localStorage.setItem("horas-gist-token", token);
      localStorage.setItem("horas-gist-id", Gist.getGistId());
      _setSyncStatus("ok");
      setTimeout(() => {
        closeGistModal();
        _loadFromGist();
      }, 1500);
    } catch (e) {
      st.innerHTML = `<div class="modal-field-error">Error: ${e.message}</div>`;
      _setSyncStatus("error");
    }
  }

  function disconnectGist() {
    localStorage.removeItem("horas-gist-token");
    localStorage.removeItem("horas-gist-id");
    Gist.setToken(null);
    Gist.setGistId(null);
    _setSyncStatus("offline");
    closeGistModal();
  }

  function exportData() {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(_custom, null, 2));
    const a = document.createElement("a");
    a.href = dataStr;
    a.download = `horas_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const json = JSON.parse(e.target.result);
        if (!json.months) throw new Error("Formato inválido");
        _custom = json;
        _saveLocal();
        _pushSync();
        _onDataLoaded();
        document.getElementById("gist-modal-status").innerHTML =
          '<div class="modal-field-ok">Datos importados correctamente.</div>';
      } catch (err) {
        document.getElementById("gist-modal-status").innerHTML =
          '<div class="modal-field-error">Error al importar: archivo no válido.</div>';
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  async function _loadFromGist() {
    _setSyncStatus("syncing");
    try {
      const data = await Gist.read();
      if (data) {
        if (!data.months) {
          // Migración si leemos de gist antiguo
          _custom = { tickets: [], months: data };
        } else {
          _custom = data;
        }
        _saveLocal();
        _onDataLoaded();
      }
      _setSyncStatus("ok");
    } catch (e) {
      console.error("Error loading gist", e);
      _setSyncStatus("error");
    }
  }

  async function _pushSync() {
    if (!Gist.getToken() || !Gist.getGistId()) return;
    _setSyncStatus("syncing");
    try {
      await Gist.write(_custom);
      _setSyncStatus("ok");
    } catch (e) {
      console.error("Error writing gist", e);
      _setSyncStatus("error");
    }
  }

  function toggleTheme() {
    const el = document.documentElement;
    const cur = el.getAttribute("data-theme") || "dark";
    const next = cur === "dark" ? "light" : "dark";
    el.setAttribute("data-theme", next);
    localStorage.setItem("horas-theme", next);

    const moon = document.querySelector(".icon-moon");
    const sun = document.querySelector(".icon-sun");
    if (moon) moon.style.display = next === "dark" ? "" : "none";
    if (sun) sun.style.display = next === "light" ? "" : "none";
  }

  return {
    init,
    prevMonth,
    nextMonth,
    switchTab,
    toggleTheme,
    submitTask,
    editEntry,
    deleteEntry,
    cancelEdit,
    addTicket,
    openCreateModal,
    closeCreateModal,
    updateTicketEstimadas,
    editTicket,
    closeEditModal,
    saveEditTicket,
    deleteTicket,
    openGistModal,
    closeGistModal,
    saveGistConfig,
    disconnectGist,
    exportData,
    importData,
    exportToMD,
    updateCloneSelect,
    cloneTicket,
    openCloneModal,
    closeCloneModal,
    toggleTodoElDia,
  };
})();
