// 客户模块：客户列表、新增 / 编辑 / 删除
(function () {
  const state = { clients: [], editingId: null };
  const els = {};

  function cacheEls() {
    els.form = document.getElementById('client-form');
    els.id = document.getElementById('client-id');
    els.name = document.getElementById('client-name');
    els.company = document.getElementById('client-company');
    els.email = document.getElementById('client-email');
    els.phone = document.getElementById('client-phone');
    els.notes = document.getElementById('client-notes');
    els.list = document.getElementById('client-list');
    els.submit = document.getElementById('client-submit');
    els.cancel = document.getElementById('client-cancel');
  }

  function render() {
    if (!state.clients.length) {
      els.list.innerHTML = '<div class="card"><p class="empty" style="padding:26px">还没有客户，用上方表单添加第一位客户吧。</p></div>';
      return;
    }
    els.list.innerHTML = state.clients.map((c) => `
      <article class="client-card card">
        <div class="card-title-row">
          <h3>${esc(c.name)}</h3>
          <span class="badge badge-neutral">${esc(c.company || '个人客户')}</span>
        </div>
        <dl class="kv">
          <div><dt>邮箱</dt><dd>${esc(c.email || '—')}</dd></div>
          <div><dt>电话</dt><dd>${esc(c.phone || '—')}</dd></div>
          <div><dt>备注</dt><dd>${esc(c.notes || '—')}</dd></div>
        </dl>
        <div class="card-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-act="edit" data-id="${c.id}">编辑</button>
          <button type="button" class="btn btn-danger-ghost btn-sm" data-act="del" data-id="${c.id}">删除</button>
        </div>
      </article>`).join('');
  }

  function resetForm() {
    state.editingId = null;
    els.id.value = '';
    els.form.reset();
    els.submit.textContent = '添加客户';
    els.cancel.classList.add('hidden');
  }

  function fillForm(c) {
    state.editingId = c.id;
    els.id.value = c.id;
    els.name.value = c.name || '';
    els.company.value = c.company || '';
    els.email.value = c.email || '';
    els.phone.value = c.phone || '';
    els.notes.value = c.notes || '';
    els.submit.textContent = '保存修改';
    els.cancel.classList.remove('hidden');
    els.name.focus();
  }

  async function refresh() {
    state.clients = await API.get('/api/clients');
    render();
  }

  async function onSubmit(e) {
    e.preventDefault();
    const payload = {
      name: els.name.value.trim(),
      company: els.company.value.trim(),
      email: els.email.value.trim(),
      phone: els.phone.value.trim(),
      notes: els.notes.value.trim(),
    };
    if (!payload.name) {
      App.toast('请填写客户名称', 'error');
      return;
    }
    try {
      if (state.editingId) {
        await API.put(`/api/clients/${state.editingId}`, payload);
        App.toast('客户已更新');
      } else {
        await API.post('/api/clients', payload);
        App.toast('客户已添加');
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
    const client = state.clients.find((c) => c.id === Number(btn.dataset.id));
    if (!client) return;

    if (btn.dataset.act === 'edit') {
      fillForm(client);
      return;
    }
    if (btn.dataset.act === 'del') {
      if (!confirm(`确定删除客户「${client.name}」吗？`)) return;
      try {
        await API.del(`/api/clients/${client.id}`);
        App.toast('客户已删除');
        if (state.editingId === client.id) resetForm();
        await App.refresh();
      } catch (err) {
        App.toast(err.message, 'error');
      }
    }
  }

  window.ClientsModule = {
    refresh,
    init() {
      cacheEls();
      els.form.addEventListener('submit', onSubmit);
      els.list.addEventListener('click', onListClick);
      els.cancel.addEventListener('click', resetForm);
    },
  };
})();
