const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const CALENDAR_ID = process.env.CALENDAR_ID || 'narayanne.peluco@gmail.com';
const CREDENTIALS_PATH = path.join(__dirname, 'google-credentials.json');
const TOKEN_PATH = path.join(__dirname, 'google-token.json');

function loadCredentials() {
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf8'));
  }
  throw new Error(
    'Credenciais Google não encontradas. Configure GOOGLE_CREDENTIALS_JSON ou crie google-credentials.json'
  );
}

function loadToken() {
  if (process.env.GOOGLE_TOKEN_JSON) {
    return JSON.parse(process.env.GOOGLE_TOKEN_JSON);
  }
  if (fs.existsSync(TOKEN_PATH)) {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  }
  return null;
}

function saveToken(token) {
  try {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(token, null, 2));
  } catch (e) {
    console.warn('[calendar] Não foi possível salvar token atualizado:', e.message);
  }
}

function buildOAuthClient() {
  const credentials = loadCredentials();
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

async function getAuthClient() {
  const oAuth2Client = buildOAuthClient();
  const token = loadToken();
  if (!token) {
    throw new Error(
      'Token Google não encontrado. Execute "npm run setup" localmente para autorizar o acesso.'
    );
  }
  oAuth2Client.setCredentials(token);

  // Persiste o token quando ele for renovado automaticamente
  oAuth2Client.on('tokens', (newTokens) => {
    if (newTokens.refresh_token) token.refresh_token = newTokens.refresh_token;
    Object.assign(token, newTokens);
    saveToken(token);
  });

  return oAuth2Client;
}

// Extrai número de telefone do texto e retorna no formato WhatsApp (55XXXXXXXXXXX@c.us)
function parsePhone(text) {
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  // Aceita: 55 + 10 ou 11 dígitos (com DDD), ou direto 10 ou 11 dígitos
  const match = digits.match(/^(55)?(\d{10,11})$/) || digits.match(/(55)?(\d{10,11})/);
  if (!match) return null;
  return `55${match[2]}@c.us`;
}

function formatDate(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatTime(isoStr) {
  const d = new Date(isoStr);
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Sao_Paulo',
  });
}

function extractMeetLink(event) {
  if (event.hangoutLink) return event.hangoutLink;
  const entries = event.conferenceData?.entryPoints || [];
  const video = entries.find((ep) => ep.entryPointType === 'video');
  return video?.uri || null;
}

async function listEvents(timeMin, timeMax) {
  const auth = await getAuthClient();
  const calendar = google.calendar({ version: 'v3', auth });
  const res = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  return res.data.items || [];
}

// Retorna [day offset] dias a partir de hoje (0 = hoje, 1 = amanhã)
function dayWindow(offset) {
  const spDate = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  const [y, m, d] = spDate.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, d + offset, 3, 0, 0)); // 00:00 SP = 03:00 UTC
  const end = new Date(Date.UTC(y, m - 1, d + offset + 1, 3, 0, 0));
  return { start, end };
}

async function getTomorrowEvents() {
  const { start, end } = dayWindow(1);
  const events = await listEvents(start, end);

  return events
    .map((event) => {
      const name = (event.summary || 'Paciente').trim();
      const phone = parsePhone(event.description || '');
      const isAllDay = !event.start.dateTime;
      const startStr = event.start.dateTime || event.start.date;

      return {
        name,
        phone,
        date: formatDate(startStr),
        time: isAllDay ? null : formatTime(event.start.dateTime),
      };
    })
    .filter((e) => e.phone);
}

// Retorna eventos de hoje com link do Meet, startDate como objeto Date e telefone
async function getTodayEventsWithMeet() {
  const { start, end } = dayWindow(0);
  const events = await listEvents(start, end);

  return events
    .filter((event) => event.start.dateTime) // descarta eventos de dia inteiro
    .map((event) => {
      const name = (event.summary || 'Paciente').trim();
      const phone = parsePhone(event.description || '');
      const meetLink = extractMeetLink(event);
      const startDate = new Date(event.start.dateTime);

      return {
        id: event.id,
        name,
        phone,
        meetLink,
        startDate,
        time: formatTime(event.start.dateTime),
      };
    })
    .filter((e) => e.phone && e.meetLink);
}

module.exports = { getTomorrowEvents, getTodayEventsWithMeet, buildOAuthClient };
