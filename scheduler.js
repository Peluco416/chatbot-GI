const cron = require('node-cron');
const { getTomorrowEvents, getTodayEventsWithMeet } = require('./calendar');

const REMINDER_HOUR = process.env.REMINDER_HOUR || '9';
const MEET_MINUTES_BEFORE = parseInt(process.env.MEET_MINUTES_BEFORE || '10', 10);
const COPY_PHONE = process.env.COPY_PHONE || '5511947225708@c.us';

// ── Mensagem de lembrete (véspera) ────────────────────────────────────────────

function buildReminderMessage(name, date, time) {
  const timeStr = time || '(horário a confirmar)';
  return (
    `Olá! ${name}\n\n` +
    `Este é um lembrete de que sua consulta está agendada para amanhã, dia ${date}, às ${timeStr}.\n\n` +
    `O link de acesso à consulta será enviado para este WhatsApp antes do horário agendado.\n\n` +
    `Caso tenha alguma dúvida ou precise reagendar, entre em contato conosco.\n\n` +
    `Aguardamos você!`
  );
}

// ── Mensagem com link do Meet (10 min antes) ──────────────────────────────────

function buildMeetMessage(meetLink) {
  return (
    `Olá!\n\n` +
    `Sua consulta está programada para iniciar em aproximadamente ${MEET_MINUTES_BEFORE} minutos.\n\n` +
    `Segue abaixo o link para acesso à consulta:\n\n` +
    `🔗 ${meetLink}\n\n` +
    `Pedimos a gentileza de acessar o link alguns minutos antes do horário agendado para garantir uma conexão tranquila.\n\n` +
    `Em caso de dúvidas, estamos à disposição.\n\n` +
    `Até breve!`
  );
}

// ── Agendador 1: lembrete do dia anterior ─────────────────────────────────────

async function sendReminders(client) {
  console.log('[reminder] Verificando consultas de amanhã...');
  let events;
  try {
    events = await getTomorrowEvents();
  } catch (err) {
    console.error('[reminder] Erro ao buscar eventos:', err.message);
    return;
  }

  if (events.length === 0) {
    console.log('[reminder] Nenhuma consulta com telefone cadastrado para amanhã.');
    return;
  }

  console.log(`[reminder] ${events.length} consulta(s) encontrada(s). Enviando lembretes...`);

  for (const event of events) {
    const msg = buildReminderMessage(event.name, event.date, event.time);
    try {
      await client.sendMessage(event.phone, msg);
      console.log(`[reminder] ✓ Lembrete enviado para ${event.name} — ${event.phone}`);
    } catch (err) {
      console.error(`[reminder] ✗ Falha ao enviar para ${event.name}:`, err.message);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  console.log('[reminder] Lembretes concluídos.');
}

function startReminderScheduler(client) {
  const cronExpr = `0 ${REMINDER_HOUR} * * *`;
  cron.schedule(cronExpr, () => sendReminders(client), { timezone: 'America/Sao_Paulo' });
  console.log(`[reminder] Agendador de véspera iniciado — todo dia às ${REMINDER_HOUR}h (Brasília)`);
}

// ── Agendador 2: link do Meet (N minutos antes da consulta) ──────────────────

// Guarda IDs dos eventos já notificados para não enviar duas vezes.
// Limpa à meia-noite para reiniciar no dia seguinte.
const notifiedMeetEvents = new Set();

async function checkMeetReminders(client) {
  let events;
  try {
    events = await getTodayEventsWithMeet();
  } catch (err) {
    console.error('[meet] Erro ao buscar eventos do dia:', err.message);
    return;
  }

  const now = Date.now();
  const windowMs = MEET_MINUTES_BEFORE * 60 * 1000;

  for (const event of events) {
    if (notifiedMeetEvents.has(event.id)) continue;

    const diff = event.startDate.getTime() - now;

    // Janela: entre (N-0.5) e (N+0.5) minutos antes — tolerância de 30s
    if (diff >= windowMs - 30000 && diff < windowMs + 30000) {
      const msg = buildMeetMessage(event.meetLink);
      try {
        await client.sendMessage(event.phone, msg);
        console.log(`[meet] ✓ Link enviado para ${event.name} — consulta às ${event.time}`);
        notifiedMeetEvents.add(event.id);
      } catch (err) {
        console.error(`[meet] ✗ Falha ao enviar Meet para ${event.name}:`, err.message);
      }
      // Envia cópia do link para o número fixo de controle
      try {
        const copyMsg = `📋 Cópia — ${event.name} (${event.time})\n\n${event.meetLink}`;
        await client.sendMessage(COPY_PHONE, copyMsg);
        console.log(`[meet] ✓ Cópia enviada para ${COPY_PHONE}`);
      } catch (err) {
        console.error(`[meet] ✗ Falha ao enviar cópia:`, err.message);
      }
    }
  }
}

function startMeetReminderScheduler(client) {
  // Verifica a cada minuto se alguma consulta começa em N minutos
  cron.schedule('* * * * *', () => checkMeetReminders(client), { timezone: 'America/Sao_Paulo' });

  // Limpa os IDs notificados à meia-noite para o próximo dia
  cron.schedule('0 0 * * *', () => {
    notifiedMeetEvents.clear();
    console.log('[meet] Lista de notificações resetada para o novo dia.');
  }, { timezone: 'America/Sao_Paulo' });

  console.log(`[meet] Agendador de Meet iniciado — link enviado ${MEET_MINUTES_BEFORE} min antes de cada consulta`);
}

module.exports = { startReminderScheduler, startMeetReminderScheduler, sendReminders };
