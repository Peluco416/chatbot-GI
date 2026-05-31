const { Client, LocalAuth } = require('whatsapp-web.js');
const QRCode = require('qrcode');
const http = require('http');
const { WELCOME_MESSAGE, MENU_OPTIONS, getResponse } = require('./menu');

const SESSION_PATH = process.env.SESSION_PATH || './session';
const PORT = process.env.PORT || 3000;

let qrImageData = null;

// Servidor HTTP simples para exibir o QR code como imagem
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

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
  puppeteer: {
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  },
});

client.on('qr', async (qr) => {
  qrImageData = await QRCode.toDataURL(qr);
  console.log('QR code disponível em: /qr');
});

client.on('ready', () => {
  console.log('Bot GarageINN conectado e pronto!');
});

client.on('auth_failure', (msg) => {
  console.error('Falha de autenticação:', msg);
});

client.on('disconnected', (reason) => {
  console.warn('Bot desconectado:', reason);
});

// Cooldown por chat para evitar respostas duplicadas (2 segundos)
const lastReply = new Map();

client.on('message_create', async (message) => {
  // Ignora mensagens enviadas pelo próprio bot
  if (message.fromMe) return;

  // Ignora mensagens de grupos
  if (message.from.endsWith('@g.us')) return;

  // Ignora mensagens que não são texto simples
  if (message.type !== 'chat') return;

  // Evita resposta duplicada no mesmo chat em menos de 2s
  const now = Date.now();
  const last = lastReply.get(message.from) || 0;
  if (now - last < 2000) return;
  lastReply.set(message.from, now);

  const text = message.body || '';
  const trimmed = text.trim();

  // Aceita "1" a "8" com possíveis espaços ou pontuação ao redor
  const match = trimmed.match(/^([1-8])[.\s]*$/);

  if (!match) {
    await message.reply(WELCOME_MESSAGE);
    return;
  }

  const response = getResponse(match[1]);
  await message.reply(response);
});

client.initialize();
