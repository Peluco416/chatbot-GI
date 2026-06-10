const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const http = require('http');
const path = require('path');
const { WELCOME_MESSAGE, getResponse } = require('./menu');

const LOGO = MessageMedia.fromFilePath(path.join(__dirname, 'logo.jpg'));

const SESSION_PATH = process.env.SESSION_PATH || './session';
const PORT = process.env.PORT || 3000;

let qrImageData = null;

// Evita crash por erros não tratados — loga e continua
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});

const server = http.createServer(async (req, res) => {
  if (req.url === '/qr') {
    if (!qrImageData) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end('<h2>QR code ainda não disponível. Aguarde alguns segundos e recarregue.</h2>');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
      <html><body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;padding:40px">
        <h2>GarageINN — Escaneie com o WhatsApp Business</h2>
        <img src="${qrImageData}" style="width:300px;height:300px"/>
        <p>Vá em <b>Configurações → Aparelhos conectados → Conectar aparelho</b></p>
        <p><small>Esta página atualiza automaticamente.</small></p>
        <script>setTimeout(()=>location.reload(),10000)</script>
      </body></html>
    `);
    return;
  }
  res.writeHead(302, { Location: '/qr' });
  res.end();
});

server.listen(PORT, () => {
  console.log(`Servidor QR disponível na porta ${PORT}`);
});

function createClient() {
  try {
    const puppeteer = require('puppeteer');
    console.log('[debug] puppeteer executablePath:', puppeteer.executablePath());
    console.log('[debug] CHROME_PATH env:', process.env.CHROME_PATH || '(not set)');
  } catch (e) {
    console.error('[debug] erro ao resolver puppeteer executablePath:', e.message);
  }

  const c = new Client({
    authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
    puppeteer: {
      ...(process.env.CHROME_PATH && { executablePath: process.env.CHROME_PATH }),
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    },
  });

  c.on('qr', async (qr) => {
    qrImageData = await QRCode.toDataURL(qr);
    console.log('QR code disponível em: /qr');
  });

  c.on('ready', () => {
    console.log('Bot GarageINN conectado e pronto!');
  });

  c.on('auth_failure', (msg) => {
    console.error('Falha de autenticação:', msg);
  });

  c.on('disconnected', (reason) => {
    console.warn('Bot desconectado:', reason, '— reconectando em 10s...');
    setTimeout(() => {
      try { c.destroy(); } catch (_) {}
      createClient();
    }, 10000);
  });

  const lastReply = new Map();
  // Guarda quem já recebeu o menu de boas-vindas
  const welcomed = new Set();

  c.on('message_create', async (message) => {
    if (message.fromMe) return;
    if (message.from.endsWith('@g.us')) return;
    if (message.type !== 'chat') return;

    const now = Date.now();
    const last = lastReply.get(message.from) || 0;
    if (now - last < 2000) return;
    lastReply.set(message.from, now);

    const text = message.body || '';
    const trimmed = text.trim();
    const match = trimmed.match(/^([1-8])[.\s]*$/);

    try {
      // Primeiro contato: envia logo + menu independente do que digitou
      if (!welcomed.has(message.from)) {
        welcomed.add(message.from);
        try {
          const chat = await message.getChat();
          await chat.sendMessage(LOGO, { caption: WELCOME_MESSAGE });
        } catch (mediaErr) {
          console.warn('Falha ao enviar logo, enviando só texto:', mediaErr.message);
          await message.reply(WELCOME_MESSAGE);
        }
        return;
      }

      // Contatos seguintes: só responde se for opção válida (1-8)
      if (!match) return;

      const response = getResponse(match[1]);
      await message.reply(response);
    } catch (err) {
      console.error('Erro ao responder mensagem:', err.message);
    }
  });

  console.log('[debug] chamando c.initialize()...');
  c.initialize()
    .then(() => console.log('[debug] c.initialize() resolveu com sucesso'))
    .catch((err) => console.error('[debug] c.initialize() rejeitou:', err && err.stack ? err.stack : err));
  return c;
}

createClient();
