// 统计模块：工时记录 + 收入统计两个面板
(function () {
  const state = { projects: [], entries: [], summary: null };
  const els = {};

  function cacheEls() {
    els.timeForm = document.getElementById('time-form');
    els.timeProject = document.getElementById('time-project');
    els.timeDate = document.getElementById('time-date');
    els.timeHours = document.getElementById('time-hours');
    els.timeNote = document.getElementById('time-note');
    els.timeList = document.getElementById('time-list');
    els.timeSummary = document.getElementById('time-summary');
    els.statCards = document.getElementById('stat-cards');
    els.byMonth = document.getElementById('stat-by-month');
    els.byClient = document.getElementById('stat-by-client');
    els.status = document.getElementById('stat-status');
  }

  function monthPrefix() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  /* ---------- 工时面板 ---------- */

  function renderProjectSelect() {
    const current = els.timeProject.value;
    els.timeProject.innerHTML = '<option value="">请选择项目…</option>' + state.projects.map((p) =>
      `<option value="${p.id}">${esc(p.name)} · ${esc(p.clientName || '未知客户')}</option>`).join('');
    if (current) els.timeProject.value = current;
  }

  function renderTime() {
    renderProjectSelect();

    const totalHours = state.entries.reduce((s, t) => s + t.hours, 0);
    const monthHours = state.entries
      .filter((t) => t.date && t.date.startsWith(monthPrefix()))
      .reduce((s, t) => s + t.hours, 0);
    els.timeSummary.textContent =
      `共 ${state.entries.length} 条记录 · 累计 ${totalHours} 小时 · 本月 ${monthHours} 小时`;

    if (!state.entries.length) {
      els.timeList.innerHTML = '<tr><td colspan="6" class="empty">还没有工时记录，用上方表单登记第一条。</td></tr>';
      return;
    }
    els.timeList.innerHTML = state.entries.map((t) => `
      <tr>
        <td>${esc(t.date)}</td>
        <td><strong>${esc(t.projectName)}</strong></td>
        <td>${esc(t.clientName || '—')}</td>
        <td class="num">${t.hours}h</td>
        <td>${esc(t.note || '—')}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-danger-ghost btn-sm" data-act="del" data-project="${t.projectId}" data-id="${t.id}">删除</button>
        </td>
      </tr>`).join('');
  }

  async function onTimeSubmit(e) {
    e.preventDefault();
    const projectId = Number(els.timeProject.value) || null;
    const hours = els.timeHours.value === '' ? null : Number(els.timeHours.value);
    if (!projectId) {
      App.toast('请选择所属项目', 'error');
      return;
    }
    if (!hours) {
      App.toast('请填写工时', 'error');
      return;
    }
    try {
      await API.post(`/api/projects/${projectId}/time`, {
        date: els.timeDate.value || todayStr(),
        hours,
        note: els.timeNote.value.trim(),
      });
      App.toast(`已记录 ${hours} 小时工时`);
      els.timeHours.value = '';
      els.timeNote.value = '';
      await App.refresh();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  async function onTimeListClick(e) {
    const btn = e.target.closest('button[data-act="del"]');
    if (!btn) return;
    try {
      await API.del(`/api/projects/${btn.dataset.project}/time/${btn.dataset.id}`);
      App.toast('工时记录已删除');
      await App.refresh();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  /* ---------- 收入统计面板 ---------- */

  function renderStats() {
    const s = state.summary;
    if (!s) return;
    const STATUS = window.PROJECT_STATUS || {};

    els.statCards.innerHTML = `
      <div class="stat-card">
        <span class="stat-label">累计开票</span>
        <strong class="stat-value">${fmtMoney(s.totalInvoiced)}</strong>
        <span class="stat-sub">${s.invoiceCount} 张账单 · 本月收款 ${fmtMoney(s.monthPaid)}</span>
      </div>
      <div class="stat-card good">
        <span class="stat-label">已收款</span>
        <strong class="stat-value">${fmtMoney(s.totalPaid)}</strong>
        <span class="stat-sub">本月到账 ${fmtMoney(s.monthPaid)}</span>
      </div>
      <div class="stat-card warn">
        <span class="stat-label">待收款</span>
        <strong class="stat-value">${fmtMoney(s.totalUnpaid)}</strong>
        <span class="stat-sub">${s.unpaidCount} 张未收${s.overdueCount ? ` · ${s.overdueCount} 张已逾期` : ''}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">记录工时</span>
        <strong class="stat-value">${s.totalHours}h</strong>
        <span class="stat-sub">${state.entries.length} 条记录 · 本月 ${state.entries.filter((t) => t.date && t.date.startsWith(monthPrefix())).reduce((x, t) => x + t.hours, 0)}h</span>
      </div>`;

    const maxVal = Math.max(1, ...s.byMonth.flatMap((m) => [m.invoiced, m.paid]));
    els.byMonth.innerHTML = s.byMonth.map((m) => `
      <div class="bar-row">
        <span class="bar-label">${esc(m.month)}</span>
        <div class="bar-track">
          <div class="bar bar-invoiced" style="width:${Math.round((m.invoiced / maxVal) * 100)}%" title="开票 ${fmtMoney(m.invoiced)}"></div>
          <div class="bar bar-paid" style="width:${Math.round((m.paid / maxVal) * 100)}%" title="收款 ${fmtMoney(m.paid)}"></div>
        </div>
        <span class="bar-value">收 ${fmtMoney(m.paid)} / 开 ${fmtMoney(m.invoiced)}</span>
      </div>`).join('');

    if (!s.byClient.length) {
      els.byClient.innerHTML = '<tr><td colspan="3" class="empty">暂无账单数据</td></tr>';
    } else {
      els.byClient.innerHTML = s.byClient.map((c) => `
        <tr>
          <td>${esc(c.clientName)}</td>
          <td class="num" style="color:var(--green)">${fmtMoney(c.paid)}</td>
          <td class="num" style="color:var(--amber)">${fmtMoney(c.unpaid)}</td>
        </tr>`).join('');
    }

    els.status.innerHTML = Object.entries(s.projectsByStatus).map(([key, count]) => {
      const meta = STATUS[key] || { label: key };
      return `<span class="chip">${meta.label} <b>${count}</b></span>`;
    }).join('');
  }

  /* ---------- 刷新 ---------- */

  async function refresh() {
    const [projects, summary] = await Promise.all([
      API.get('/api/projects'),
      API.get('/api/invoices/summary'),
    ]);
    state.projects = projects;
    state.summary = summary;
    state.entries = projects
      .flatMap((p) => (p.timeEntries || []).map((t) => ({
        ...t,
        projectId: p.id,
        projectName: p.name,
        clientName: p.clientName,
      })))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    renderTime();
    renderStats();
  }

  window.StatsModule = {
    refresh,
    init() {
      cacheEls();
      els.timeDate.value = todayStr();
      els.timeForm.addEventListener('submit', onTimeSubmit);
      els.timeList.addEventListener('click', onTimeListClick);
    },
  };
})();
