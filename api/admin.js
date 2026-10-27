// api/admin.js — Painel de respostas da pesquisa (protegido por senha)

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'agaitec2024';

async function redisGet(start = 0, end = -1) {
  const url = process.env.REDIS_URL;
  const match = url.match(/redis:\/\/default:(.+)@(.+):(\d+)/);
  if (!match) throw new Error('REDIS_URL inválida');
  const [, password, host] = match;
  const restUrl = `https://${host}`;
  const res = await fetch(`${restUrl}/lrange/pesquisa:respostas/${start}/${end}`, {
    headers: { Authorization: `Bearer ${password}` }
  });
  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  const data = await res.json();
  return (data.result || []).map(item => {
    try { return JSON.parse(decodeURIComponent(item)); }
    catch { return JSON.parse(item); }
  });
}

async function redisCount() {
  const url = process.env.REDIS_URL;
  const match = url.match(/redis:\/\/default:(.+)@(.+):(\d+)/);
  if (!match) throw new Error('REDIS_URL inválida');
  const [, password, host] = match;
  const res = await fetch(`https://${host}/llen/pesquisa:respostas`, {
    headers: { Authorization: `Bearer ${password}` }
  });
  const data = await res.json();
  return data.result || 0;
}

export default async function handler(req, res) {
  // Auth simples via query param: /api/admin?pwd=SENHA
  const pwd = req.query?.pwd;
  if (pwd !== ADMIN_PASSWORD) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(401).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Admin — AgAiTec</title>
<style>
  body{margin:0;background:#0f1117;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:system-ui,sans-serif;}
  .box{background:#1a1d27;border:1px solid #2e3350;border-radius:12px;padding:40px;text-align:center;max-width:360px;width:90%;}
  h2{color:#f5a623;margin:0 0 24px;font-size:20px;}
  input{width:100%;box-sizing:border-box;padding:12px;background:#0f1117;border:1px solid #2e3350;border-radius:8px;color:#e8eaf0;font-size:15px;margin-bottom:16px;}
  button{width:100%;padding:12px;background:#f5a623;border:none;border-radius:8px;font-size:15px;font-weight:700;color:#0f1117;cursor:pointer;}
</style>
</head>
<body>
<div class="box">
  <h2>🔐 Painel Admin</h2>
  <input type="password" id="p" placeholder="Senha" onkeydown="if(event.key==='Enter')auth()"/>
  <button onclick="auth()">Entrar</button>
</div>
<script>function auth(){const p=document.getElementById('p').value;window.location='/api/admin?pwd='+encodeURIComponent(p);}</script>
</body></html>`);
  }

  // Exportar CSV
  if (req.query.export === 'csv') {
    try {
      const respostas = await redisGet();
      const headers = ['timestamp','email','q1','q2','q3','q4','q5','q6','q7','q8','q9','q10','q11','q12','q13','q14','q15','q16','q17','q18','q19','q20','q21','q22','q23','q24','q25','q26','q27'];
      const rows = respostas.map(r => headers.map(h => {
        const val = h === 'timestamp' ? r.timestamp : h === 'email' ? (r.email||'') : (r.respostas?.[h]||'');
        return `"${String(val).replace(/"/g,'""')}"`;
      }).join(','));
      const csv = [headers.join(','), ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="pesquisa-ultima-milha-${new Date().toISOString().slice(0,10)}.csv"`);
      return res.status(200).send('﻿' + csv);
    } catch(e) {
      return res.status(500).json({ error: e.message });
    }
  }

  // Painel HTML
  try {
    const [respostas, total] = await Promise.all([redisGet(), redisCount()]);

    const labels = {
      q1:'Cidade/Estado', q2:'Tipo de operação', q3:'Tempo de atuação', q4:'Vínculo',
      q5:'Veículo', q6:'Diárias por semana', q7:'Horas por dia', q8:'Entregas por dia',
      q9:'Faturamento mensal', q10:'Controle financeiro', q11:'Ferramenta de controle',
      q12:'Ferramenta (texto)', q13:'Maior dificuldade', q14:'Gastos registrados',
      q15:'Combustível', q16:'Manutenção', q17:'Outros gastos', q18:'Sabe lucro líquido',
      q19:'Smartphone', q20:'App desejado', q21:'App prioritário', q22:'Pagamento app',
      q23:'Interesse SmalLog', q24:'Indicaria', q25:'Já usou app parecido',
      q26:'Melhor funcionalidade', q27:'Comentário final'
    };

    const rows = respostas.map((r, i) => {
      const cols = Object.entries(labels).map(([k, label]) => {
        const val = k === 'q12' ? r.q12 : k === 'q17' ? r.q17 : k === 'q27' ? r.q27 : (r.respostas?.[k] || '—');
        return `<td title="${label}">${val || '—'}</td>`;
      }).join('');
      const dt = r.timestamp ? new Date(r.timestamp).toLocaleString('pt-BR') : '—';
      return `<tr><td>${i+1}</td><td>${dt}</td><td>${r.email||'—'}</td>${cols}</tr>`;
    }).join('');

    const headerCols = Object.entries(labels).map(([k,v]) => `<th title="${v}">${k}</th>`).join('');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.status(200).send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Admin — Pesquisa Última Milha</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;background:#0f1117;color:#e8eaf0;font-family:system-ui,sans-serif;font-size:13px;}
  header{background:#1a1d27;border-bottom:1px solid #2e3350;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;}
  header h1{margin:0;font-size:18px;color:#f5a623;}
  header span{color:#8a8faa;font-size:12px;}
  .actions{display:flex;gap:8px;}
  .btn{padding:8px 16px;border-radius:6px;border:none;cursor:pointer;font-size:13px;font-weight:600;}
  .btn-gold{background:#f5a623;color:#0f1117;}
  .btn-out{background:transparent;border:1px solid #2e3350;color:#8a8faa;}
  .wrap{overflow-x:auto;padding:16px 24px;}
  table{border-collapse:collapse;min-width:100%;white-space:nowrap;}
  th{background:#22263a;color:#8a8faa;font-weight:600;padding:8px 12px;text-align:left;position:sticky;top:0;border-bottom:1px solid #2e3350;}
  td{padding:8px 12px;border-bottom:1px solid #1e2133;max-width:220px;overflow:hidden;text-overflow:ellipsis;}
  tr:hover td{background:#1e2133;}
  .empty{text-align:center;padding:64px;color:#8a8faa;}
  .stat{background:#1a1d27;border:1px solid #2e3350;border-radius:8px;padding:16px 24px;margin:16px 24px 0;display:inline-block;}
  .stat strong{color:#f5a623;font-size:28px;display:block;}
  .stat span{color:#8a8faa;font-size:12px;}
</style>
</head>
<body>
<header>
  <div>
    <h1>📊 Pesquisa — Última Milha</h1>
    <span>AgAiTec · SmalLog</span>
  </div>
  <div class="actions">
    <a href="?pwd=${pwd}&export=csv"><button class="btn btn-gold">⬇ Exportar CSV</button></a>
    <a href="?pwd=${pwd}"><button class="btn btn-out">↻ Atualizar</button></a>
  </div>
</header>

<div class="stat">
  <strong>${total}</strong>
  <span>respostas recebidas</span>
</div>

<div class="wrap">
${total === 0 ? '<div class="empty">Nenhuma resposta ainda.</div>' : `
<table>
  <thead><tr><th>#</th><th>Data/Hora</th><th>Email</th>${headerCols}</tr></thead>
  <tbody>${rows}</tbody>
</table>`}
</div>
</body>
</html>`);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
