// --- CONFIGURAÇÕES ---
var TOKEN_SEGURANCA = 'SUA_SENHA_AQUI'; // Mesma senha do secret GOOGLE_APPS_SCRIPT_WEBHOOK_TOKEN
var NOME_ABA = 'Dados'; // Nome da aba na planilha de controle

// Layout da aba "Dados" (11 colunas — alinhado à planilha institucional):
// A=ID | B=NOME_LEAD | C=E-MAIL | D=DATA_VISITA | E=UNIDADE | F=STATUS_ENVIO
// G=Status 7d | H=Status 2d | I=Status Dia | J=Status 30m | K=Envio Imediato

var COL = {
  ID: 1,
  NOME: 2,
  EMAIL: 3,
  DATA_VISITA: 4,
  UNIDADE: 5,
  STATUS_ENVIO: 6,
  STATUS_7D: 7,
  STATUS_2D: 8,
  STATUS_DIA: 9,
  STATUS_30M: 10,
  ENVIO_IMEDIATO: 11
};

var CABECALHO_PLANILHA = [
  'ID',
  'NOME_LEAD',
  'E-MAIL',
  'DATA_VISITA',
  'UNIDADE',
  'STATUS_ENVIO',
  'Status 7d',
  'Status 2d',
  'Status Dia',
  'Status 30m',
  'Envio Imediato'
];

/**
 * RECEPTOR DO WEBHOOK — recebe POST do Supabase (Edge Function email-automation)
 *
 * Payload enviado pelo CRM:
 * {
 *   "token": "...",
 *   "event": "student_registered",
 *   "trigger_type": "student_registered",
 *   "to_email": "lead@email.com",
 *   "to_name": "Maria Silva",
 *   "subject": "Inscrição confirmada - Central",
 *   "html_body": "<div>...</div>",
 *   "from_email": "central@escola.com.br",
 *   "from_name": "Rede de Ensino",
 *   "record": {
 *     "id": "uuid",
 *     "student_id": "uuid",
 *     "student_name": "Maria Silva",
 *     "email": "lead@email.com",
 *     "data_visita": "2026-05-22T14:30:00",
 *     "unit_name": "Central",
 *     "trigger_type": "student_registered"
 *   }
 * }
 */
function doPost(e) {
  var tokenRecebido = (e.parameter && e.parameter.token) || '';

  try {
    var payload = parseWebhookPayload(e);
    if (payload.token) {
      tokenRecebido = payload.token;
    }

    if (tokenRecebido !== TOKEN_SEGURANCA) {
      return jsonResponse({ success: false, error: 'Erro: Token inválido' });
    }

    var lead = extrairDadosLead(payload);
    var sheet = obterAbaDados();

    sheet.appendRow([
      lead.id,
      lead.nome,
      lead.email,
      lead.dataVisita,
      lead.unidade,
      lead.evento,
      'Pendente',
      'Pendente',
      'Pendente',
      'Pendente',
      'Pendente'
    ]);

    var ultimaLinha = sheet.getLastRow();
    var messageId = '';
    var emailEnviado = false;
    var erroEmail = '';

    // E-mails imediatos (inscrição, confirmação de agendamento) vêm com HTML do CRM
    if (payload.subject && payload.html_body && lead.emailValido) {
      try {
        messageId = dispararEmailHtml(
          lead.email,
          payload.subject,
          payload.html_body,
          payload.from_name || 'Equipe de Relacionamento',
          payload.from_email || ''
        );
        emailEnviado = true;
        sheet.getRange(ultimaLinha, COL.ENVIO_IMEDIATO).setValue('Enviado');
      } catch (emailErr) {
        erroEmail = emailErr.message || String(emailErr);
        sheet.getRange(ultimaLinha, COL.ENVIO_IMEDIATO).setValue('Falhou: ' + erroEmail);
      }
    } else if (payload.subject && payload.html_body && !lead.emailValido) {
      sheet.getRange(ultimaLinha, COL.ENVIO_IMEDIATO).setValue('Falhou: e-mail inválido');
      erroEmail = 'E-mail do destinatário não informado ou inválido';
    }

    return jsonResponse({
      success: true,
      message_id: messageId || Utilities.getUuid(),
      event: lead.evento,
      email_sent: emailEnviado,
      email_error: erroEmail || null,
      payload_source: payload._source || 'unknown',
      row: ultimaLinha,
      lead_email: lead.email
    });
  } catch (err) {
    return jsonResponse({ success: false, error: 'Erro: ' + err.message });
  }
}

/**
 * Lê o payload JSON enviado pelo CRM.
 * O Google Apps Script costuma redirecionar POST /exec com 302 e o body JSON se perde;
 * por isso aceitamos também application/x-www-form-urlencoded (campo "payload").
 */
function parseWebhookPayload(e) {
  var raw = '';

  if (e.postData && e.postData.contents) {
    raw = e.postData.contents;
  } else if (e.parameter && e.parameter.payload) {
    raw = e.parameter.payload;
  }

  if (raw) {
    var payload = JSON.parse(raw);
    payload._source = (e.postData && e.postData.contents) ? 'postData.json' : 'parameter.payload';
    return payload;
  }

  if (e.parameter && (e.parameter.to_email || e.parameter.trigger_type || e.parameter.subject)) {
    return {
      token: e.parameter.token || '',
      trigger_type: e.parameter.trigger_type || e.parameter.event || '',
      event: e.parameter.event || e.parameter.trigger_type || '',
      to_email: e.parameter.to_email || '',
      to_name: e.parameter.to_name || '',
      subject: e.parameter.subject || '',
      html_body: e.parameter.html_body || '',
      from_email: e.parameter.from_email || '',
      from_name: e.parameter.from_name || '',
      record: e.parameter.record ? JSON.parse(e.parameter.record) : {},
      _source: 'parameter.flat'
    };
  }

  throw new Error('Corpo da requisição ausente (postData e parameter vazios)');
}

/**
 * Normaliza campos vindos do CRM (record aninhado), webhook legado (campos na raiz)
 * ou Database Webhook do Supabase (record com colunas students).
 */
function extrairDadosLead(payload) {
  var registro = payload.record || {};

  // Database Webhook Supabase envia { type, table, record } sem source/webhook
  if (payload.table === 'students' && payload.record && !payload.trigger_type) {
    registro = payload.record;
    payload.trigger_type = 'student_registered';
    payload.to_email = payload.to_email || registro.email;
    payload.to_name = payload.to_name || registro.student_name;
  }

  if (payload.table === 'appointments' && payload.record && !payload.trigger_type) {
    registro = payload.record;
    payload.trigger_type = 'appointment_scheduled';
  }

  var idAluno = primeiroValor([
    registro.student_id,
    registro.id,
    payload.student_id,
    payload.id
  ]) || 'N/A';

  var nome = primeiroValor([
    registro.student_name,
    registro.nome,
    registro.nome_lead,
    registro.NOME_LEAD,
    registro.to_name,
    payload.to_name,
    payload.nome,
    payload.nome_lead,
    payload.NOME_LEAD
  ]) || 'Não informado';

  var email = primeiroValor([
    payload.to_email,
    registro.to_email,
    registro.recipient_email,
    registro.email,
    registro.email_lead,
    registro.E_MAIL,
    payload.email,
    payload.E_MAIL
  ]) || 'Não informado';

  var dataVisita = primeiroValor([
    registro.data_visita,
    registro.data_agendamento,
    registro.DATA_VISITA,
    payload.data_visita,
    payload.DATA_VISITA,
    montarDataAtendimento(registro)
  ]) || '';

  var unidade = primeiroValor([
    registro.unit_name,
    registro.unidade,
    registro.UNIDADE,
    payload.unit_name,
    payload.unidade,
    payload.UNIDADE
  ]) || 'Geral';

  var evento = primeiroValor([
    payload.trigger_type,
    payload.event,
    registro.trigger_type,
    payload.STATUS_ENVIO
  ]) || '';

  return {
    id: idAluno,
    nome: nome,
    email: email,
    emailValido: email && email !== 'Não informado' && email.indexOf('@') > 0,
    dataVisita: dataVisita,
    unidade: unidade,
    evento: evento
  };
}

function primeiroValor(valores) {
  for (var i = 0; i < valores.length; i++) {
    var valor = valores[i];
    if (valor !== null && valor !== undefined && String(valor).trim() !== '') {
      return String(valor).trim();
    }
  }
  return '';
}

/**
 * RÉGUA DE LEMBRETES — configure um acionador (relógio) a cada 15 ou 30 minutos
 * Dispara lembretes com base na coluna DATA_VISITA (coluna D)
 */
function enviarLembretesAutomaticos() {
  var sheet = obterAbaDados();
  var dados = sheet.getDataRange().getValues();
  var agora = new Date();

  for (var i = 1; i < dados.length; i++) {
    var linha = i + 1;
    var nome = dados[i][COL.NOME - 1];
    var email = dados[i][COL.EMAIL - 1];
    var dataAtendimento = dados[i][COL.DATA_VISITA - 1];
    var unidade = dados[i][COL.UNIDADE - 1];

    if (!email || email === 'Não informado' || String(email).indexOf('@') < 1 || !dataAtendimento) {
      continue;
    }

    var dataVisita = new Date(dataAtendimento);
    if (isNaN(dataVisita.getTime())) {
      continue;
    }

    var diffHoras = (dataVisita.getTime() - agora.getTime()) / (1000 * 60 * 60);
    var diffDias = diffHoras / 24;
    var diffMinutos = (dataVisita.getTime() - agora.getTime()) / (1000 * 60);

    if (diffDias <= 7 && diffDias > 6 && dados[i][COL.STATUS_7D - 1] === 'Pendente') {
      dispararEmail(
        email,
        'Falta 1 semana para seu atendimento — ' + unidade,
        'Olá ' + nome + ',\n\nFalta uma semana para o seu atendimento na ' + unidade + '.\n\nEstamos ansiosos para recebê-lo(a)!'
      );
      sheet.getRange(linha, COL.STATUS_7D).setValue('Enviado');
    }

    if (diffDias <= 2 && diffDias > 1 && dados[i][COL.STATUS_2D - 1] === 'Pendente') {
      dispararEmail(
        email,
        'Confirmação de atendimento — ' + unidade,
        'Olá ' + nome + ',\n\nSeu atendimento na ' + unidade + ' está marcado para depois de amanhã.\n\nPor favor, confirme sua presença respondendo este e-mail.'
      );
      sheet.getRange(linha, COL.STATUS_2D).setValue('Enviado');
    }

    if (diffHoras <= 12 && diffHoras > 1 && dados[i][COL.STATUS_DIA - 1] === 'Pendente') {
      dispararEmail(
        email,
        'Seu atendimento é hoje! — ' + unidade,
        'Olá ' + nome + ',\n\nLembramos que seu atendimento na ' + unidade + ' é hoje.\n\nTe esperamos!'
      );
      sheet.getRange(linha, COL.STATUS_DIA).setValue('Enviado');
    }

    if (diffMinutos <= 35 && diffMinutos > 0 && dados[i][COL.STATUS_30M - 1] === 'Pendente') {
      dispararEmail(
        email,
        'Estamos te esperando! — ' + unidade,
        'Olá ' + nome + ',\n\nSeu atendimento na ' + unidade + ' começa em breve. Já estamos te aguardando!'
      );
      sheet.getRange(linha, COL.STATUS_30M).setValue('Enviado');
    }
  }
}

function obterAbaDados() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(NOME_ABA);

  if (!sheet) {
    sheet = ss.insertSheet(NOME_ABA);
    sheet.appendRow(CABECALHO_PLANILHA);
    return sheet;
  }

  // Garante cabeçalho mínimo se a aba existir mas estiver vazia
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(CABECALHO_PLANILHA);
  }

  return sheet;
}

function montarDataAtendimento(registro) {
  if (registro.appointment_date && registro.appointment_time) {
    var hora = String(registro.appointment_time).substring(0, 5);
    return registro.appointment_date + 'T' + hora + ':00';
  }
  if (registro.interview_date) {
    return registro.interview_date;
  }
  if (registro.exam_date && registro.exam_time) {
    var examHora = String(registro.exam_time).substring(0, 5);
    return registro.exam_date + 'T' + examHora + ':00';
  }
  return '';
}

function dispararEmail(to, subject, body) {
  if (to && to !== 'Não informado' && String(to).indexOf('@') > 0) {
    GmailApp.sendEmail(to, subject, body, { name: 'Equipe de Relacionamento' });
  }
}

function dispararEmailHtml(to, subject, htmlBody, fromName, fromEmail) {
  var options = {
    htmlBody: htmlBody,
    name: fromName || 'Equipe de Relacionamento'
  };

  if (fromEmail) {
    options.from = fromEmail;
  }

  try {
    GmailApp.sendEmail(to, subject, '', options);
  } catch (err) {
    // Se o alias "from" não estiver configurado no Gmail, tenta sem remetente customizado
    if (fromEmail && String(err.message || err).indexOf('from') >= 0) {
      delete options.from;
      GmailApp.sendEmail(to, subject, '', options);
    } else {
      throw err;
    }
  }

  return Utilities.getUuid();
}

/**
 * Teste manual no editor do Apps Script (Executar → testarWebhook)
 * Simula o payload enviado pela Edge Function email-automation.
 */
function testarWebhook() {
  var payload = {
    token: TOKEN_SEGURANCA,
    event: 'student_registered',
    trigger_type: 'student_registered',
    to_email: 'seu_email@gmail.com',
    to_name: 'Teste CRM',
    subject: 'Teste — Inscrição confirmada',
    html_body: '<div style="font-family:Arial,sans-serif"><h2>Teste CRM</h2><p>E-mail transacional HTML.</p></div>',
    from_email: '',
    from_name: 'Rede de Ensino APOGEU',
    record: {
      id: 'teste-uuid',
      student_id: 'teste-uuid',
      student_name: 'Teste CRM',
      email: 'seu_email@gmail.com',
      phone: '(11) 99999-9999',
      data_visita: '2026-06-01T10:00:00',
      unit_name: 'Central',
      unidade: 'Central',
      trigger_type: 'student_registered'
    }
  };

  var e = {
    parameter: { token: TOKEN_SEGURANCA },
    postData: { contents: JSON.stringify(payload) }
  };

  var resultado = doPost(e);
  Logger.log(resultado.getContent());
}

/** Testa envio via form-urlencoded (mesmo formato usado pelo CRM como fallback). */
function testarWebhookForm() {
  var payload = {
    token: TOKEN_SEGURANCA,
    event: 'student_registered',
    trigger_type: 'student_registered',
    to_email: 'seu_email@gmail.com',
    to_name: 'Teste CRM Form',
    subject: 'Teste Form — Inscrição confirmada',
    html_body: '<div><p>Teste via form-urlencoded</p></div>',
    from_name: 'Rede de Ensino APOGEU',
    record: {
      student_id: 'teste-form',
      student_name: 'Teste CRM Form',
      email: 'seu_email@gmail.com',
      unit_name: 'Central',
      trigger_type: 'student_registered'
    }
  };

  var e = {
    parameter: {
      token: TOKEN_SEGURANCA,
      payload: JSON.stringify(payload)
    },
    postData: null
  };

  var resultado = doPost(e);
  Logger.log(resultado.getContent());
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
