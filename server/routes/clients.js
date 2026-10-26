// 客户路由：/api/clients 的增删改查
const express = require('express');
const store = require('../store');

const router = express.Router();

// 客户列表
router.get('/', (req, res) => {
  const data = store.load();
  res.json(data.clients);
});

// 新增客户
router.post('/', (req, res) => {
  const { name, company, email, phone, notes } = req.body || {};
  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: '客户名称不能为空' });
  }
  const data = store.load();
  const client = {
    id: store.nextId('client'),
    name: String(name).trim(),
    company: String(company || '').trim(),
    email: String(email || '').trim(),
    phone: String(phone || '').trim(),
    notes: String(notes || '').trim(),
    createdAt: new Date().toISOString(),
  };
  data.clients.push(client);
  store.save();
  res.status(201).json(client);
});

// 修改客户
router.put('/:id', (req, res) => {
  const data = store.load();
  const client = data.clients.find((c) => c.id === Number(req.params.id));
  if (!client) return res.status(404).json({ error: '客户不存在' });

  const { name, company, email, phone, notes } = req.body || {};
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ error: '客户名称不能为空' });
    client.name = String(name).trim();
  }
  if (company !== undefined) client.company = String(company).trim();
  if (email !== undefined) client.email = String(email).trim();
  if (phone !== undefined) client.phone = String(phone).trim();
  if (notes !== undefined) client.notes = String(notes).trim();
  store.save();
  res.json(client);
});

// 删除客户（其名下仍有项目时拒绝，避免产生孤儿数据）
router.delete('/:id', (req, res) => {
  const data = store.load();
  const id = Number(req.params.id);
  const idx = data.clients.findIndex((c) => c.id === id);
  if (idx === -1) return res.status(404).json({ error: '客户不存在' });
  if (data.projects.some((p) => p.clientId === id)) {
    return res.status(400).json({ error: '该客户名下仍有项目，请先删除或转移这些项目' });
  }
  data.clients.splice(idx, 1);
  store.save();
  res.status(204).end();
});

module.exports = router;
