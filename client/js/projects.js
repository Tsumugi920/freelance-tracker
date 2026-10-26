// 项目模块：项目列表（状态 / 截止 / 报酬）、增删改、状态快捷切换
(function () {
  const STATUS = {
    planning: { label: '未开始', cls: 'st-planning' },
    in_progress: { label: '进行中', cls: 'st-inprogress' },
    completed: { label: '已完成', cls: 'st-completed' },
    paused: { label: '已暂停', cls: 'st-paused' },
  };
  window.PROJECT_STATUS = STATUS; // 供统计模块复用

  const state = { projects: [], clients: [], editingId: null };
  const els = {};

  function cacheEls() {
    els.form = document.getElementById('project-form');
    els.id = document.getElementById('project-id');
    els.client = document.getElementById('project-client');
    els.name = document.getElementById('project-name');
    els.status = document.getElementById('project-status');
    els.fee = document.getElementById('project-fee');
    els.rate = document.getElementById('project-rate');
    els.start = document.getElementById('project-start');
    els.deadline = document.getElementById('project-deadline');
    els.desc = document.getElementById('project-desc');
    els.list = document.getElementById('project-list');
    els.submit = document.getElementById('project-submit');
    els.cancel = document.getElementById('project-cancel');
  }

  function renderClientSelect() {
    const current = els.client.value;
    els.client.innerHTML = '<option value="">请选择客户…</option>' + state.clients.map((c) =>
      `<option value="${c.id}">${esc(c.name)}${c.company ? `（${esc(c.company)}）` : ''}</option>`).join('');
    if (current) els.client.value = current;
  }

  function isOverdue(p) {
    return Boolean(p.deadline) && p.deadline < todayStr() && p.status !== 'completed';
  }

  function render() {
    if (!state.projects.length) {
      els.list.innerHTML = '<tr><td colspan="8" class="empty">还没有项目，用上方表单创建第一个项目。</td></tr>';
      return;
    }
    els.list.innerHTML = state.projects.map((p) => {
      const st = STATUS[p.status] || { label: p.status, cls: 'st-planning' };
      const overdue = isOverdue(p);
      return `
      <tr>
        <td><strong>${esc(p.name)}</strong>${p.description ? `<br><span class="muted small">${esc(p.description)}</span>` : ''}</td>
        <td>${esc(p.clientName || '—')}</td>
        <td><span class="badge ${st.cls}">${st.label}</span></td>
        <td class="${overdue ? 'text-danger' : ''}">${esc(p.deadline || '—')}${overdue ? '<br><span class="small">已逾期</span>' : ''}</td>
        <td class="num">${fmtMoney(p.fee)}${p.hourlyRate ? `<br><span class="muted small">时薪 ${fmtMoney(p.hourlyRate)}/h</span>` : ''}</td>
        <td class="num">${fmtMoney(p.invoiced)}<br><span class="muted small">已收 ${fmtMoney(p.paid)}</span></td>
        <td class="num">${p.hours ? p.hours + 'h' : '—'}</td>
        <td class="actions-cell">
          <div class="row-actions">
            <select class="status-select" data-act="status" data-id="${p.id}" title="切换状态">
              ${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${v.label}</option>`).join('')}
            </select>
            <button type="button" class="btn btn-ghost btn-sm" data-act="edit" data-id="${p.id}">编辑</button>
            <button type="button" class="btn btn-danger-ghost btn-sm" data-act="del" data-id="${p.id}">删除</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  function resetForm() {
    state.editingId = null;
    els.id.value = '';
    els.form.reset();
    els.submit.textContent = '新增项目';
    els.cancel.classList.add('hidden');
  }

  function fillForm(p) {
    state.editingId = p.id;
    els.id.value = p.id;
    els.client.value = String(p.clientId);
    els.name.value = p.name || '';
    els.status.value = p.status;
    els.fee.value = p.fee || '';
    els.rate.value = p.hourlyRate || '';
    els.start.value = p.startDate || '';
    els.deadline.value = p.deadline || '';
    els.desc.value = p.description || '';
    els.submit.textContent = '保存修改';
    els.cancel.classList.remove('hidden');
    els.name.focus();
  }

  async function refresh() {
    const [projects, clients] = await Promise.all([
      API.get('/api/projects'),
      API.get('/api/clients'),
    ]);
    state.projects = projects;
    state.clients = clients;
    renderClientSelect();
    render();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      clientId: Number(els.client.value) || null,
      name: els.name.value.trim(),
      status: els.status.value,
      fee: els.fee.value === '' ? 0 : Number(els.fee.value),
      hourlyRate: els.rate.value === '' ? 0 : Number(els.rate.value),
      startDate: els.start.value,
      deadline: els.deadline.value,
      description: els.desc.value.trim(),
    };
    if (!payload.clientId) {
      App.toast('请选择所属客户', 'error');
      return;
    }
    if (!payload.name) {
      App.toast('请填写项目名称', 'error');
      return;
    }
    try {
      if (state.editingId) {
        await API.put(`/api/projects/${state.editingId}`, payload);
        App.toast('项目已更新');
      } else {
        await API.post('/api/projects', payload);
        App.toast('项目已创建');
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
    const project = state.projects.find((p) => p.id === Number(btn.dataset.id));
    if (!project) return;

    if (btn.dataset.act === 'edit') {
      fillForm(project);
      return;
    }
    if (btn.dataset.act === 'del') {
      if (!confirm(`删除项目「${project.name}」会同时删除它的账单与工时记录，确定吗？`)) return;
      try {
        await API.del(`/api/projects/${project.id}`);
        App.toast('项目已删除');
        if (state.editingId === project.id) resetForm();
        await App.refresh();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    }
  }

  async function onStatusChange(e) {
    const sel = e.target.closest('select[data-act="status"]');
    if (!sel) return;
    const project = state.projects.find((p) => p.id === Number(sel.dataset.id));
    if (!project || project.status === sel.value) return;
    try {
      await API.put(`/api/projects/${project.id}`, {
        clientId: project.clientId,
        name: project.name,
        status: sel.value,
        startDate: project.startDate,
        deadline: project.deadline,
        fee: project.fee,
        hourlyRate: project.hourlyRate,
        description: project.description,
      });
      App.toast(`「${project.name}」状态已更新`);
      await App.refresh();
    } catch (err) {
      App.toast(err.message, 'error');
      await refresh(); // 失败时还原下拉框
    }
  }

  window.ProjectsModule = {
    refresh,
    init() {
      cacheEls();
      els.form.addEventListener('submit', onSubmit);
      els.list.addEventListener('click', onListClick);
      els.list.addEventListener('change', onStatusChange);
      els.cancel.addEventListener('click', resetForm);
    },
  };
})();
