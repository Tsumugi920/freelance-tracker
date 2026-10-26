// Freelance Tracker 后端入口：Express 提供 REST API，并托管 client/ 下的前端页面
const express = require('express');
const path = require('path');
const store = require('./store');
const clientsRouter = require('./routes/clients');
const projectsRouter = require('./routes/projects');
const invoicesRouter = require('./routes/invoices');

const app = express();
const PORT = Number(process.env.PORT) || 3022;

store.load();

app.use(express.json());

// 前端静态页面（访问 http://localhost:3022 即可）
app.use(express.static(path.join(__dirname, '..', 'client')));

app.use('/api/clients', clientsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/invoices', invoicesRouter);

// 未匹配到的 API 统一返回 404 JSON
app.use('/api', (req, res) => {
  res.status(404).json({ error: `接口不存在: ${req.method} ${req.originalUrl}` });
});

// 全局错误处理：区分请求体 JSON 解析错误与其他内部错误
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: '请求体不是合法的 JSON' });
  }
  console.error('[server] 内部错误:', err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`Freelance Tracker 已启动: http://localhost:${PORT}`);
  console.log(`数据文件: ${store.DATA_FILE}`);
});
