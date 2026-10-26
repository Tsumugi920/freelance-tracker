// 数据存取层：所有数据持久化在 server/data.json，读写都经过这里
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');

let data = null;

// 补齐缺失的字段，保证旧文件 / 空文件也能正常工作
function normalize(raw) {
  const out = raw && typeof raw === 'object' ? raw : {};
  if (!Array.isArray(out.clients)) out.clients = [];
  if (!Array.isArray(out.projects)) out.projects = [];
  if (!Array.isArray(out.invoices)) out.invoices = [];
  if (!Array.isArray(out.timeEntries)) out.timeEntries = [];
  if (!out.seq || typeof out.seq !== 'object') out.seq = {};
  for (const kind of ['client', 'project', 'invoice', 'time']) {
    if (!Number.isInteger(out.seq[kind])) out.seq[kind] = 1;
  }
  return out;
}

function load() {
  if (data) return data;
  try {
    data = normalize(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch (err) {
    if (fs.existsSync(DATA_FILE)) {
      try { fs.copyFileSync(DATA_FILE, DATA_FILE + '.bak'); } catch (_) { /* 备份失败不阻塞启动 */ }
      console.warn(`[store] data.json 解析失败（${err.message}），已备份为 data.json.bak 并以空数据启动`);
    }
    data = normalize(null);
    save();
  }
  return data;
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// 自增主键：client / project / invoice / time
function nextId(kind) {
  const d = load();
  const id = d.seq[kind];
  d.seq[kind] = id + 1;
  return id;
}

module.exports = { load, save, nextId, DATA_FILE };
