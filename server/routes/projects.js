// 项目路由：/api/projects 的增删改查 + 工时登记
const express = require('express');
const store = require('../store');

const router = express.Router();

const STATUSES = ['planning', 'in_progress', 'completed', 'paused'];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// 给项目补充展示用的元数据：客户名、开票/收款金额、累计工时、工时明细
function withMeta(data, project) {
  const client = data.clients.find((c) => c.id === project.clientId);
  const invoices = data.invoices.filter((i) => i.projectId === project.id);
  const entries = data.timeEntries.filter((t) => t.projectId === project.id);
  return {
    ...project,
    clientName: client ? client.name : null,
    invoiced: +invoices.reduce((s, i) => s + (Number(i.amount) || 0), 0).toFixed(2),
    paid: +invoices.filter((i) => i.status === 'paid').reduce((s, i) => s + (Number(i.amount) || 0), 0).toFixed(2),
    hours: +entries.reduce((s, t) => s + (Number(t.hours) || 0), 0).toFixed(1),
    timeEntries: entries.slice().sort((a, b) => (a.date < b.date ? 1 : -1)),
  };
}

// 项目列表（附客户名 / 开票收款 / 工时明细）
router.get('/', (req, res) => {
  const data = store.load();
  res.json(data.projects.map((p) => withMeta(data, p)));
});

// 新增项目
router.post('/', (req, res) => {
  const { clientId, name, status, startDate, deadline, fee, hourlyRate, description } = req.body || {};
  const data = store.load();
  if (!data.clients.some((c) => c.id === Number(clientId))) {
    return res.status(400).json({ error: '请选择有效的客户' });
  }
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: '项目名称不能为空' });
  }
  const st = status || 'planning';
  if (!STATUSES.includes(st)) {
    return res.status(400).json({ error: `状态必须是: ${STATUSES.join(' / ')}` });
  }
  const project = {
    id: store.nextId('project'),
    clientId: Number(clientId),
    name: String(name).trim(),
    status: st,
    startDate: startDate || '',
    deadline: deadline || '',
    fee: Number(fee) || 0,
    hourlyRate: Number(hourlyRate) || 0,
    description: String(description || '').trim(),
    createdAt: new Date().toISOString(),
  };
  data.projects.push(project);
  store.save();
  res.status(201).json(withMeta(data, project));
});

// 修改项目（支持局部字段更新，前端常用它来改状态）
router.put('/:id', (req, res) => {
  const data = store.load();
  const project = data.projects.find((p) => p.id === Number(req.params.id));
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const { clientId, name, status, startDate, deadline, fee, hourlyRate, description } = req.body || {};
  if (clientId !== undefined) {
    if (!data.clients.some((c) => c.id === Number(clientId))) {
      return res.status(400).json({ error: '所属客户不存在' });
    }
    project.clientId = Number(clientId);
  }
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: '项目名称不能为空' });
    project.name = String(name).trim();
  }
  if (status !== undefined) {
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ error: `状态必须是: ${STATUSES.join(' / ')}` });
    }
    project.status = status;
  }
  if (startDate !== undefined) project.startDate = startDate || '';
  if (deadline !== undefined) project.deadline = deadline || '';
  if (fee !== undefined) project.fee = Number(fee) || 0;
  if (hourlyRate !== undefined) project.hourlyRate = Number(hourlyRate) || 0;
  if (description !== undefined) project.description = String(description).trim();
  store.save();
  res.json(withMeta(data, project));
});

// 删除项目（连同其账单与工时记录一并删除）
router.delete('/:id', (req, res) => {
  const data = store.load();
  const id = Number(req.params.id);
  const idx = data.projects.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ error: '项目不存在' });
  data.projects.splice(idx, 1);
  data.invoices = data.invoices.filter((i) => i.projectId !== id);
  data.timeEntries = data.timeEntries.filter((t) => t.projectId !== id);
  store.save();
  res.status(204).end();
});

// 登记工时
router.post('/:id/time', (req, res) => {
  const data = store.load();
  const project = data.projects.find((p) => p.id === Number(req.params.id));
  if (!project) return res.status(404).json({ error: '项目不存在' });

  const { date, hours, note } = req.body || {};
  const h = Number(hours);
  if (!Number.isFinite(h) || h <= 0 || h > 24) {
    return res.status(400).json({ error: '工时必须是 0 ~ 24 之间的数字' });
  }
  const entry = {
    id: store.nextId('time'),
    projectId: project.id,
    date: date || todayStr(),
    hours: h,
    note: String(note || '').trim(),
    createdAt: new Date().toISOString(),
  };
  data.timeEntries.push(entry);
  store.save();
  res.status(201).json(entry);
});

// 删除某条工时记录
router.delete('/:id/time/:entryId', (req, res) => {
  const data = store.load();
  const projectId = Number(req.params.id);
  const entryId = Number(req.params.entryId);
  const idx = data.timeEntries.findIndex((t) => t.id === entryId && t.projectId === projectId);
  if (idx === -1) return res.status(404).json({ error: '工时记录不存在' });
  data.timeEntries.splice(idx, 1);
  store.save();
  res.status(204).end();
});

module.exports = router;
