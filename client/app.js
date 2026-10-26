// 应用入口：负责标签页切换、模块初始化与全局刷新
(function () {
  function toast(msg, type) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.className = 'toast show' + (type === 'error' ? ' toast-error' : '');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      el.className = 'toast';
    }, 2600);
  }

  // 全局刷新：任一模块发生变更后，所有面板与下拉框保持一致
  window.App = {
    toast,
    async refresh() {
      await Promise.all([
        ClientsModule.refresh(),
        ProjectsModule.refresh(),
        InvoicesModule.refresh(),
        StatsModule.refresh(),
      ]);
    },
  };

  function switchTab(name) {
    document.querySelectorAll('#tabs .tab').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === name);
    });
    document.querySelectorAll('.panel').forEach((panel) => {
      panel.classList.toggle('active', panel.id === `panel-${name}`);
    });
  }

  async function init() {
    document.getElementById('tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab');
      if (btn) switchTab(btn.dataset.tab);
    });

    ClientsModule.init();
    ProjectsModule.init();
    InvoicesModule.init();
    StatsModule.init();

    try {
      await App.refresh();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
