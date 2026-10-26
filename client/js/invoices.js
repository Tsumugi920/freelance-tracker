// 账单模块：开账单、收款标记、编辑删除、状态筛选
(function () {
  const state = { invoices: [], projects: [], filter: 'all', editingId: null };
  const els = {};

  function cacheEls() {
    els.form = document.getElementById('invoice-form');
    els.id = document.getElementById('invoice-id');
    els.project = document.getElementById('invoice-project');
    els.amount = document.getElementById('invoice-amount');
    els.issued = document.getElementById('invoice-issued');
    els.due = document.getElementById('invoice-due');
    els.note = document.getElementById('invoice-note');
    els.list = document.getElementById('invoice-list');
    els.submit = document.getElementById('invoice-submit');
    els.cancel = document.getElementById('invoice-cancel');
    els.filters = document.getElementById('invoice-filters');
  }

  function isOverdue(inv) {
    return inv.status === 'unpaid' && inv.dueDate && inv.dueDate < todayStr();
  }

  function projectById(id) {
    return state.projects.find((p) => p.id === id) || null;
  }

  function renderProjectSelect() {
    const current = els.project.value;
    els.project.innerHTML = '<option value="">请选择项目…</option>' + state.projects.map((p) =>
      `<option value="${p.id}">${esc(p.name)} · ${esc(p.clientName || '未知客户')}</option>`).join('');
    if (current) els.project.value = current;
  }

  function render() {
    const counts = {
      all: state.invoices.length,
      unpaid: state.invoices.filter((i) => i.status === 'unpaid').length,
      paid: state.invoices.filter((i) => i.status === 'paid').length,
    };
    els.filters.querySelectorAll('.filter-btn').forEach((btn) => {
      const key = btn.dataset.filter;
      btn.textContent = { all: '全部', unpaid: '未收款', paid: '已收款' }[key] + `（${counts[key]}）`;
      btn.classList.toggle('active', state.filter === key);
    });

    const filtered = state.invoices.filter((i) => state.filter === 'all' || i.status === state.filter);
    if (!filtered.length) {
      els.list.innerHTML = `<tr><td colspan="9" class="empty">${state.invoices.length ? '当前筛选下没有账单。' : '还没有账单，用上方表单开第一张。'}</td></tr>`;
      return;
    }

    els.list.innerHTML = filtered.map((inv) => {
      const project = projectById(inv.projectId);
      const overdue = isOverdue(inv);
      const statusBadge = inv.status === 'paid'
        ? '<span class="badge st-completed">已收款</span>'
        : (overdue ? '<span class="badge st-overdue">已逾期</span>' : '<span class="badge st-unpaid">未收款</span>');
      return `
      <tr>
        <td class="mono">${esc(inv.number)}</td>
        <td>${esc(project ? project.name : '（项目已删除）')}</td>
        <td>${esc(project ? project.clientName || '—' : '—')}</td>
        <td class="num"><strong>${fmtMoney(inv.amount)}</strong></td>
        <td>${statusBadge}</td>
        <td>${esc(inv.issuedDate || '—')}</td>
        <td class="${overdue ? 'text-danger' : ''}">${esc(inv.dueDate || '—')}${overdue ? '<br><span class="small">已逾期</span>' : ''}</td>
        <td>${esc(inv.paidDate || '—')}</td>
        <td class="actions-cell">
          <div class="row-actions">
            ${inv.status === 'unpaid'
              ? `<button type="button" class="btn btn-primary btn-sm" data-act="pay" data-id="${inv.id}">标记收款</button>`
              : `<button type="button" class="btn btn-ghost btn-sm" data-act="unpay" data-id="${inv.id}">取消收款</button>`}
            <button type="button" class="btn btn-ghost btn-sm" data-act="edit" data-id="${inv.id}">编辑</button>
            <button type="button" class="btn btn-danger-ghost btn-sm" data-act="del" data-id="${inv.id}">删除</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function setDefaults() {
    els.issued.value = todayStr();
    els.due.value = daysAfter(30);
  }

  function resetForm() {
    state.editingId = null;
    els.id.value = '';
    els.form.reset();
    els.project.disabled = false;
    setDefaults();
    els.submit.textContent = '开账单';
    els.cancel.classList.add('hidden');
  }

  function fillForm(inv) {
    state.editingId = inv.id;
    els.id.value = inv.id;
    els.project.value = String(inv.projectId);
    els.project.disabled = true; // 编辑时不允许换关联项目
    els.amount.value = inv.amount;
    els.issued.value = inv.issuedDate || '';
    els.due.value = inv.dueDate || '';
    els.note.value = inv.note || '';
    els.submit.textContent = '保存账单';
    els.cancel.classList.remove('hidden');
  }

  async function refresh() {
    const [invoices, projects] = await Promise.all([
      API.get('/api/invoices'),
      API.get('/api/projects'),
    ]);
    state.invoices = invoices;
    state.projects = projects;
    renderProjectSelect();
    render();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      amount: els.amount.value === '' ? null : Number(els.amount.value),
      issuedDate: els.issued.value,
      dueDate: els.due.value,
      note: els.note.value.trim(),
    };
    try {
      if (state.editingId) {
        await API.put(`/api/invoices/${state.editingId}`, payload);
        App.toast('账单已更新');
      } else {
        await API.post('/api/invoices', { ...payload, projectId: Number(els.project.value) || null });
        App.toast('账单已开具');
      }
      resetForm();
      await App.refresh();
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  async function onListClick(e) {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const inv = state.invoices.find((i) => i.id === Number(btn.dataset.id));
    if (!inv) return;

    try {
      if (btn.dataset.act === 'pay') {
        await API.patch(`/api/invoices/${inv.id}/pay`, {});
        App.toast(`「${inv.number}」已标记收款 ${fmtMoney(inv.amount)}`);
        await App.refresh();
      } else if (btn.dataset.act === 'unpay') {
        await API.patch(`/api/invoices/${inv.id}/unpay`, {});
        App.toast(`「${inv.number}」已取消收款`);
        await App.refresh();
      } else if (btn.dataset.act === 'edit') {
        fillForm(inv);
      } else if (btn.dataset.act === 'del') {
        if (!confirm(`确定删除账单「${inv.number}」吗？`)) return;
        await API.del(`/api/invoices/${inv.id}`);
        App.toast('账单已删除');
        if (state.editingId === inv.id) resetForm();
        await App.refresh();
      }
    } catch (err) {
      App.toast(err.message, 'error');
    }
  }

  // 选择项目后，把金额预填为“项目报酬 − 已开票”的剩余部分
  function onProjectChange() {
    if (state.editingId) return;
    const project = projectById(Number(els.project.value));
    if (!project) return;
    const remaining = (project.fee || 0) - (project.invoiced || 0);
    els.amount.value = remaining > 0 ? remaining : (project.fee || '');
    if (!els.issued.value) setDefaults();
  }

  function onFilterClick(e) {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    state.filter = btn.dataset.filter;
    render();
  }

  window.InvoicesModule = {
    refresh,
    init() {
      cacheEls();
      setDefaults();
      els.form.addEventListener('submit', onSubmit);
      els.list.addEventListener('click', onListClick);
      els.filters.addEventListener('click', onFilterClick);
      els.project.addEventListener('change', onProjectChange);
      els.cancel.addEventListener('click', resetForm);
    },
  };
})();
