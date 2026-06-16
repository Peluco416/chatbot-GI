const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WELCOME_MESSAGE, getResponse } = require('./menu');
const { startReminderScheduler, startMeetReminderScheduler } = require('./scheduler');

const LOGO = MessageMedia.fromFilePath(path.join(__dirname, 'logo.jpg'));

const SESSION_PATH = process.env.SESSION_PATH || './session';
const PORT = process.env.PORT || 3000;

if (process.env.RESET_SESSION === 'true' && fs.existsSync(SESSION_PATH)) {
  for (const entry of fs.readdirSync(SESSION_PATH)) {
    fs.rmSync(path.join(SESSION_PATH, entry), { recursive: true, force: true });
  }
  console.log('[debug] sessao antiga apagada (RESET_SESSION=true)');
}

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

// Remove arquivos de lock deixados por um Chrome anterior que crashou,
// senão o novo Chrome se recusa a abrir o mesmo perfil. Também remove
// pastas de cache (não essenciais para o login) que crescem sem limite
// e fazem o Chrome estourar a memória disponível no container.
const LOCK_NAMES = ['SingletonLock', 'SingletonSocket', 'SingletonCookie'];
const CACHE_DIR_NAMES = [
  'Cache', 'Code Cache', 'GPUCache', 'DawnCache', 'DawnGraphiteCache',
  'DawnWebGPUCache', 'GrShaderCache', 'ShaderCache', 'CacheStorage',
];

function cleanChromeProfile(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (CACHE_DIR_NAMES.includes(entry.name)) {
        try {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log('[debug] cache removido:', fullPath);
        } catch (e) {
          console.error('[debug] erro ao remover cache:', fullPath, e.message);
        }
      } else {
        cleanChromeProfile(fullPath);
      }
    } else if (LOCK_NAMES.includes(entry.name)) {
      try {
        fs.unlinkSync(fullPath);
        console.log('[debug] removido lock antigo:', fullPath);
      } catch (e) {
        console.error('[debug] erro ao remover lock:', fullPath, e.message);
      }
    }
  }
}

function createClient() {
  cleanChromeProfile(SESSION_PATH);

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
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-default-apps',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--mute-audio',
        '--no-first-run',
        '--js-flags=--max-old-space-size=256',
      ],
    },
  });

  c.on('qr', async (qr) => {
    qrImageData = await QRCode.toDataURL(qr);
    console.log('QR code disponível em: /qr');
  });

  let recreating = false;
  const scheduleRecreate = (reason) => {
    if (recreating) return;
    recreating = true;
    console.warn('Reiniciando bot (' + reason + ')... reconectando em 5s...');
    setTimeout(() => {
      try { c.destroy(); } catch (_) {}
      createClient();
    }, 5000);
  };

  c.on('ready', () => {
    console.log('Bot GarageINN conectado e pronto!');
    console.log('[debug] Numero conectado:', c.info && c.info.wid ? c.info.wid.user : '(desconhecido)');
    startReminderScheduler(c);
    startMeetReminderScheduler(c);

    if (c.pupPage) {
      c.pupPage.on('error', (e) => {
        console.error('[debug] pupPage error:', e.message);
        scheduleRecreate('pagina do navegador travou');
      });
      c.pupPage.on('close', () => {
        console.error('[debug] pupPage fechou!');
        scheduleRecreate('pagina do navegador fechou');
      });
    }
  });

  c.on('message', (message) => {
    console.log('[debug] message recebida de', message.from, '| tipo:', message.type, '| corpo:', message.body);
  });

  c.on('auth_failure', (msg) => {
    console.error('Falha de autenticação:', msg);
  });

  c.on('disconnected', (reason) => {
    console.warn('Bot desconectado:', reason);
    scheduleRecreate('desconectado: ' + reason);
  });

  const lastReply = new Map();
  // Guarda quem já recebeu o menu de boas-vindas
  const welcomed = new Set();

  c.on('message_create', async (message) => {
    console.log('[debug] message_create de', message.from, '| fromMe:', message.fromMe, '| tipo:', message.type, '| corpo:', message.body);
    if (message.fromMe) return;
    if (message.from.endsWith('@g.us')) return;
    if (message.type !== 'chat') return;

    const now = Date.now();
    const last = lastReply.get(message.from) || 0;
    if (now - last < 2000) return;
    lastReply.set(message.from, now);

    const text = message.body || '';
    const trimmed = text.trim();
    const match = trimmed.match(/^([1-9])[.\s]*$/);

    try {
      // Primeiro contato: envia logo + menu independente do que digitou
      if (!welcomed.has(message.from)) {
        welcomed.add(message.from);
        try {
          const chat = await message.getChat();
          console.log('[debug] enviando logo+menu para', message.from);
          await chat.sendMessage(LOGO, { caption: WELCOME_MESSAGE });
          console.log('[debug] logo+menu enviados com sucesso');
        } catch (mediaErr) {
          console.warn('Falha ao enviar logo, enviando só texto:', mediaErr.stack || mediaErr.message);
          await message.reply(WELCOME_MESSAGE);
          console.log('[debug] texto de boas-vindas enviado com sucesso');
        }
        return;
      }

      // Contatos seguintes: só responde se for opção válida (1-9)
      if (!match) {
        console.log('[debug] mensagem nao corresponde a opcao 1-9, ignorando');
        return;
      }

      const response = getResponse(match[1]);
      console.log('[debug] enviando resposta da opcao', match[1]);
      await message.reply(response);
      console.log('[debug] resposta enviada com sucesso');
    } catch (err) {
      console.error('Erro ao responder mensagem:', err.stack || err.message);
    }
  });

  console.log('[debug] chamando c.initialize()...');
  c.initialize()
    .then(() => console.log('[debug] c.initialize() resolveu com sucesso'))
    .catch((err) => console.error('[debug] c.initialize() rejeitou:', err && err.stack ? err.stack : err));
  return c;
}

createClient();
