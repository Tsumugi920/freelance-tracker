// 统一的 API 请求封装与公共工具函数（最先加载，挂到 window 上供各模块使用）
(function () {
  async function request(path, options = {}) {
    const opts = { headers: {}, ...options };
    if (opts.body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(opts.body);
    }
    let res;
    try {
      res = await fetch(path, opts);
    } catch (err) {
      throw new Error('无法连接服务器，请确认后端已启动（npm start）');
    }
    if (!res.ok) {
      let msg = `请求失败（HTTP ${res.status}）`;
      try {
        const body = await res.json();
        if (body && body.error) msg = body.error;
      } catch (_) { /* 响应不是 JSON 时用默认错误信息 */ }
      throw new Error(msg);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  window.API = {
    get: (path) => request(path),
    post: (path, body) => request(path, { method: 'POST', body }),
    put: (path, body) => request(path, { method: 'PUT', body }),
    patch: (path, body) => request(path, { method: 'PATCH', body }),
    del: (path) => request(path, { method: 'DELETE' }),
  };

  // HTML 转义，防止用户输入破坏页面结构
  window.esc = function (value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[ch]));
  };

  window.fmtMoney = function (num) {
    const n = Number(num) || 0;
    return '¥' + n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  };

  window.todayStr = function () {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  window.daysAfter = function (days) {
    const d = new Date(Date.now() + days * 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
})();
