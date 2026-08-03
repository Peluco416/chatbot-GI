const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const http = require('http');
const path = require('path');
const fs = require('fs');
const { WELCOME_MESSAGE, getResponse } = require('./menu');

const SESSION_PATH = process.env.SESSION_PATH || './session';
const PORT = process.env.PORT || 3000;
const LOGO_PATH = path.join(__dirname, 'logo.jpg');

if (process.env.RESET_SESSION === 'true' && fs.existsSync(SESSION_PATH)) {
  for (const entry of fs.readdirSync(SESSION_PATH)) {
    fs.rmSync(path.join(SESSION_PATH, entry), { recursive: true, force: true });
  }
  console.log('Sessão antiga apagada (RESET_SESSION=true)');
}

let qrImageData = null;

const baileysLogger = {
  level: 'silent',
  trace: () => {}, debug: () => {}, info: () => {}, warn: () => {},
  error: (m) => console.error('[baileys]', typeof m === 'object' ? m.msg || '' : m),
  fatal: (m) => console.error('[baileys fatal]', m),
  child: function () { return this; },
};

const server = http.createServer((req, res) => {
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
        <script>setTimeout(()=>location.reload(),25000)</script>
      </body></html>
    `);
    return;
  }
  res.writeHead(302, { Location: '/qr' });
  res.end();
});

server.listen(PORT, () => console.log(`Servidor QR disponível na porta ${PORT}`));

const welcomed = new Set();
const lastReply = new Map();

function getTextBody(msg) {
  return (
    msg.message?.conversation ||
    msg.message?.extendedTextMessage?.text ||
    msg.message?.imageMessage?.caption ||
    msg.message?.videoMessage?.caption ||
    ''
  );
}

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);

  let version;
  try {
    ({ version } = await fetchLatestBaileysVersion());
  } catch {
    version = [2, 3000, 1015901307];
  }

  const sock = makeWASocket({
    version,
    auth: state,
    logger: baileysLogger,
    printQRInTerminal: false,
    browser: ['GarageINN Bot', 'Chrome', '120.0'],
    getMessage: async () => ({ conversation: '' }),
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      qrImageData = await QRCode.toDataURL(qr);
      console.log('QR code disponível em: /qr');
    }

    if (connection === 'open') {
      qrImageData = null;
      console.log('Bot GarageINN conectado e pronto!');
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = code === DisconnectReason.loggedOut;
      console.warn(`Conexão fechada (código: ${code}) — reconectando em 5s...`);
      if (loggedOut) {
        console.warn('Sessão encerrada pelo WhatsApp — aguardando novo scan de QR code...');
      }
      setTimeout(() => connectToWhatsApp(), 5000);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    console.log('messages.upsert type:', type, 'count:', messages.length);
    if (type !== 'notify') return;

    for (const msg of messages) {
      try {
        const jid = msg.key.remoteJid;
        console.log('msg de:', jid, '| fromMe:', msg.key.fromMe, '| tipo:', Object.keys(msg.message || {})[0]);

        if (!jid) continue;
        if (msg.key.fromMe) continue;
        if (jid.endsWith('@g.us')) continue;

        const now = Date.now();
        const last = lastReply.get(jid) || 0;
        if (now - last < 2000) continue;
        lastReply.set(jid, now);

        const text = getTextBody(msg).trim();
        const match = text.match(/^([1-9])[.\s]*$/);

        if (!welcomed.has(jid)) {
          welcomed.add(jid);
          try {
            const logoBuffer = fs.readFileSync(LOGO_PATH);
            console.log('Enviando logo para', jid, '- tamanho:', logoBuffer.length);
            await sock.sendMessage(jid, { image: logoBuffer, caption: WELCOME_MESSAGE });
            console.log('Logo enviado com sucesso');
          } catch (mediaErr) {
            console.warn('Falha ao enviar logo:', mediaErr.message);
            await sock.sendMessage(jid, { text: WELCOME_MESSAGE });
            console.log('Texto de boas-vindas enviado');
          }
          continue;
        }

        if (!match) continue;

        const response = getResponse(match[1]);
        await sock.sendMessage(jid, { text: response });
      } catch (err) {
        console.error('Erro ao responder:', err.message);
      }
    }
  });
}

process.on('uncaughtException', (err) => console.error('[uncaughtException]', err.message));
process.on('unhandledRejection', (reason) => console.error('[unhandledRejection]', reason?.message || reason));

connectToWhatsApp();
