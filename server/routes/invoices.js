// 账单路由：/api/invoices 的增删改查、收款标记、收入汇总
const express = require('express');
const store = require('../store');

const router = express.Router();

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function validDate(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);
}

// 账单号：INV-<年份>-<三位序号>，取当前年份已有最大序号 +1
function nextInvoiceNumber(data) {
  const prefix = `INV-${new Date().getFullYear()}-`;
  let max = 0;
  for (const inv of data.invoices) {
    if (typeof inv.number === 'string' && inv.number.startsWith(prefix)) {
      const n = parseInt(inv.number.slice(prefix.length), 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// 收入汇总：累计开票/收款/待收款、近 6 个月曲线、客户排行、项目状态分布
// 注意：必须注册在所有 /:id 路由之前，否则 "summary" 会被当成 id
router.get('/summary', (req, res) => {
  const data = store.load();
  const today = todayStr();
  const month = today.slice(0, 7);

  let invoiceCount = 0;
  let totalInvoiced = 0;
  let totalPaid = 0;
  let unpaidCount = 0;
  let overdueCount = 0;
  const byClientMap = new Map();
  const monthMap = new Map();

  for (const inv of data.invoices) {
    invoiceCount += 1;
    totalInvoiced += Number(inv.amount) || 0;

    const client = byClientMap.get(inv.clientId) || { clientId: inv.clientId, paid: 0, unpaid: 0 };
    if (inv.status === 'paid') {
      totalPaid += Number(inv.amount) || 0;
      client.paid += Number(inv.amount) || 0;
      const paidMonth = String(inv.paidDate || '').slice(0, 7);
      if (paidMonth) {
        const bucket = monthMap.get(paidMonth) || { paid: 0, invoiced: 0 };
        bucket.paid += Number(inv.amount) || 0;
        monthMap.set(paidMonth, bucket);
      }
    } else {
      client.unpaid += Number(inv.amount) || 0;
      unpaidCount += 1;
      if (inv.dueDate && inv.dueDate < today) overdueCount += 1;
    }
    byClientMap.set(inv.clientId, client);

    const issuedMonth = String(inv.issuedDate || '').slice(0, 7);
    if (issuedMonth) {
      const bucket = monthMap.get(issuedMonth) || { paid: 0, invoiced: 0 };
      bucket.invoiced += Number(inv.amount) || 0;
      monthMap.set(issuedMonth, bucket);
    }
  }

  // 近 6 个月（含当月），没有数据的月份也补 0
  const byMonth = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const bucket = monthMap.get(key) || { paid: 0, invoiced: 0 };
    byMonth.push({ month: key, invoiced: bucket.invoiced, paid: bucket.paid });
  }

  const clientName = (id) => {
    const c = data.clients.find((x) => x.id === id);
    return c ? c.name : '未知客户';
  };
  const byClient = [...byClientMap.values()]
    .map((c) => ({ ...c, clientName: clientName(c.clientId) }))
    .sort((a, b) => b.paid - a.paid || b.unpaid - a.unpaid);

  const projectsByStatus = { planning: 0, in_progress: 0, completed: 0, paused: 0 };
  for (const p of data.projects) {
    if (projectsByStatus[p.status] !== undefined) projectsByStatus[p.status] += 1;
  }

  const totalHours = data.timeEntries.reduce((s, t) => s + (Number(t.hours) || 0), 0);

  res.json({
    month,
    invoiceCount,
    totalInvoiced: +totalInvoiced.toFixed(2),
    totalPaid: +totalPaid.toFixed(2),
    totalUnpaid: +(totalInvoiced - totalPaid).toFixed(2),
    unpaidCount,
    overdueCount,
    monthPaid: +(monthMap.get(month) || { paid: 0 }).paid,
    totalHours: +totalHours.toFixed(1),
    byMonth,
    byClient,
    projectsByStatus,
  });
});

// 账单列表，支持 ?status=paid|unpaid 与 ?projectId= 过滤
router.get('/', (req, res) => {
  const data = store.load();
  let list = data.invoices;
  if (req.query.status) list = list.filter((i) => i.status === req.query.status);
  if (req.query.projectId) list = list.filter((i) => i.projectId === Number(req.query.projectId));
  res.json(list);
});

// 新开账单：账单号自动生成，客户从关联项目带出，默认未收款
router.post('/', (req, res) => {
  const { projectId, amount, issuedDate, dueDate, note } = req.body || {};
  const data = store.load();
  const project = data.projects.find((p) => p.id === Number(projectId));
  if (!project) return res.status(400).json({ error: '关联项目不存在' });
  const amt = Number(amount);
  if (!Number.isFinite(amt) || amt <= 0) {
    return res.status(400).json({ error: '金额必须是大于 0 的数字' });
  }
  const invoice = {
    id: store.nextId('invoice'),
    number: nextInvoiceNumber(data),
    projectId: project.id,
    clientId: project.clientId,
    amount: +amt.toFixed(2),
    status: 'unpaid',
    issuedDate: validDate(issuedDate) ? issuedDate : todayStr(),
    dueDate: validDate(dueDate) ? dueDate : '',
    paidDate: null,
    note: String(note || '').trim(),
    createdAt: new Date().toISOString(),
  };
  data.invoices.push(invoice);
  store.save();
  res.status(201).json(invoice);
});

// 修改账单（金额 / 日期 / 备注）
router.put('/:id', (req, res) => {
  const data = store.load();
  const invoice = data.invoices.find((i) => i.id === Number(req.params.id));
  if (!invoice) return res.status(404).json({ error: '账单不存在' });

  const { amount, issuedDate, dueDate, note } = req.body || {};
  if (amount !== undefined) {
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      return res.status(400).json({ error: '金额必须是大于 0 的数字' });
    }
    invoice.amount = +amt.toFixed(2);
  }
  if (issuedDate !== undefined) {
    if (!validDate(issuedDate)) return res.status(400).json({ error: '开票日期格式应为 YYYY-MM-DD' });
    invoice.issuedDate = issuedDate;
  }
  if (dueDate !== undefined) {
    if (dueDate !== '' && !validDate(dueDate)) return res.status(400).json({ error: '收款截止格式应为 YYYY-MM-DD' });
    invoice.dueDate = dueDate;
  }
  if (note !== undefined) invoice.note = String(note).trim();
  store.save();
  res.json(invoice);
});

// 标记收款
router.patch('/:id/pay', (req, res) => {
  const data = store.load();
  const invoice = data.invoices.find((i) => i.id === Number(req.params.id));
  if (!invoice) return res.status(404).json({ error: '账单不存在' });
  const { paidDate } = req.body || {};
  invoice.status = 'paid';
  invoice.paidDate = validDate(paidDate) ? paidDate : todayStr();
  store.save();
  res.json(invoice);
});

// 取消收款（误操作回退）
router.patch('/:id/unpay', (req, res) => {
  const data = store.load();
  const invoice = data.invoices.find((i) => i.id === Number(req.params.id));
  if (!invoice) return res.status(404).json({ error: '账单不存在' });
  invoice.status = 'unpaid';
  invoice.paidDate = null;
  store.save();
  res.json(invoice);
});

// 删除账单
router.delete('/:id', (req, res) => {
  const data = store.load();
  const idx = data.invoices.findIndex((i) => i.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ error: '账单不存在' });
  data.invoices.splice(idx, 1);
  store.save();
  res.status(204).end();
});

module.exports = router;
