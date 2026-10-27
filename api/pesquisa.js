// api/pesquisa.js — Vercel Serverless Function
// Recebe respostas da pesquisa, salva no Redis (Upstash), envia email via Resend

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Upstash Redis via ioredis-compatible URL
async function redisPush(value) {
  const url = process.env.REDIS_URL;
  // Upstash aceita comandos via HTTP REST
  // URL formato: redis://default:PASSWORD@HOST:PORT
  const match = url.match(/redis:\/\/default:(.+)@(.+):(\d+)/);
  if (!match) throw new Error('REDIS_URL inválida');

  const [, password, host] = match;
  const restUrl = `https://${host}`;

  const res = await fetch(`${restUrl}/rpush/pesquisa:respostas/${encodeURIComponent(JSON.stringify(value))}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${password}`
    }
  });

  if (!res.ok) throw new Error(`Redis error: ${res.status}`);
  return res.json();
}

function emailHtml(payload) {
  const emailVal = payload.email || '';
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f1117;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#1a1d27;border-radius:12px;overflow:hidden;border:1px solid #2e3350;">

        <tr>
          <td style="padding:32px 32px 24px;text-align:center;border-bottom:1px solid #2e3350;">
            <p style="margin:0 0 2px;font-size:22px;font-weight:700;color:#f5a623;font-family:Georgia,'Times New Roman',serif;">AgAiTec</p>
            <p style="margin:0;font-size:9px;letter-spacing:3px;color:#8a8faa;text-transform:uppercase;">UM PONTO NA EVOLUÇÃO</p>
          </td>
        </tr>

        <tr>
          <td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:22px;color:#e8eaf0;font-weight:700;line-height:1.3;">
              Obrigado pela sua participação! 🙏
            </h1>
            <p style="margin:0 0 16px;font-size:15px;color:#c5c8d8;line-height:1.6;">
              Você acabou de contribuir com uma pesquisa importante sobre o dia a dia do pequeno operador de última milha no Brasil.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#c5c8d8;line-height:1.6;">
              Cada resposta ajuda a construir um retrato mais fiel da realidade de quem sustenta a entrega no país.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="background:#22263a;border-radius:10px;border:1px solid #f5a62340;margin:0 0 24px;">
              <tr>
                <td style="padding:24px;">
                  <p style="margin:0 0 8px;font-size:11px;letter-spacing:2px;color:#f5a623;text-transform:uppercase;font-weight:700;">Convite especial</p>
                  <h2 style="margin:0 0 12px;font-size:18px;color:#e8eaf0;font-weight:700;line-height:1.3;">
                    Teste o SmalLog antes de todo mundo
                  </h2>
                  <p style="margin:0 0 16px;font-size:14px;color:#c5c8d8;line-height:1.6;">
                    O <strong style="color:#f5a623;">SmalLog</strong> é uma ferramenta criada para o operador de última milha: controle de entregas, gestão de custos e visibilidade real sobre o que fica no bolso no final do dia.
                  </p>
                  <p style="margin:0 0 20px;font-size:14px;color:#c5c8d8;line-height:1.6;">
                    Estamos formando um grupo inicial de teste — <strong style="color:#e8eaf0;">acesso gratuito, sem compromisso</strong>. Quem participou da pesquisa tem prioridade.
                  </p>
                  <table cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:#f5a623;border-radius:8px;">
                        <a href="https://smallog.app" target="_blank"
                           style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0f1117;text-decoration:none;">
                          Quero testar o SmalLog →
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0;font-size:13px;color:#8a8faa;line-height:1.6;">
              Qualquer dúvida, responda este e-mail.<br>
              Equipe AgAiTec · SmalLog
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:16px 32px;border-top:1px solid #2e3350;text-align:center;">
            <p style="margin:0;font-size:11px;color:#8a8faa;">
              Você recebeu este e-mail porque participou da pesquisa<br>
              <em>O Pequeno Operador de Última Milha no Brasil</em>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const payload = req.body;
    if (!payload || !payload.respostas) {
      return res.status(400).json({ error: 'Payload inválido' });
    }

    // Salvar no Redis
    await redisPush({ ...payload, _savedAt: new Date().toISOString() });

    // Enviar email se houver endereço válido
    const email = payload.email?.trim();
    let emailSent = false;

    if (email && email.includes('@')) {
      await resend.emails.send({
        from: 'SmalLog · AgAiTec <onboarding@resend.dev>',
        to: email,
        replyTo: 'contato@agaitecnology.com',
        subject: 'Obrigado por participar — e um convite especial 🙌',
        html: emailHtml(payload)
      });
      emailSent = true;
    }

    return res.status(200).json({ ok: true, emailSent });

  } catch (err) {
    console.error('[api/pesquisa]', err);
    return res.status(500).json({ error: 'Erro interno', detail: err.message });
  }
}
