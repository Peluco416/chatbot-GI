const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { WELCOME_MESSAGE, getResponse } = require('./menu');

const SESSION_PATH = process.env.SESSION_PATH || './session';

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

client.on('qr', (qr) => {
  console.log('Escaneie o QR code abaixo com o WhatsApp Business:');
  qrcode.generate(qr, { small: true });
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

client.on('message', async (message) => {
  // Ignora mensagens de grupos
  if (message.from.endsWith('@g.us')) return;

  // Ignora mensagens do próprio bot
  if (message.fromMe) return;

  const text = message.body || '';
  const trimmed = text.trim();

  // Primeira mensagem ou mensagem não numérica: boas-vindas + menu
  const isMenuOption = /^[1-8]$/.test(trimmed);

  if (!isMenuOption) {
    await message.reply(WELCOME_MESSAGE);
    return;
  }

  const response = getResponse(trimmed);
  await message.reply(response);
  await message.reply(WELCOME_MESSAGE);
});

client.initialize();
