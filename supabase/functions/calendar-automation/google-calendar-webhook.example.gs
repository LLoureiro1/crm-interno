// --- CONFIGURAÇÕES ---
var TOKEN_SEGURANCA = 'SUA_SENHA_AQUI'; // Mesma senha do secret GOOGLE_CALENDAR_WEBHOOK_TOKEN

/**
 * RECEPTOR DO WEBHOOK — recebe POST do Supabase (Edge Function calendar-automation)
 *
 * Payload esperado:
 * {
 *   "token": "...",
 *   "student_name": "João Silva",
 *   "student_email": "joao@email.com",
 *   "interviewer_email": "atendente@alunofirst.com.br",
 *   "appointment_date": "2026-06-20",
 *   "appointment_time": "14:30:00",
 *   "unit_name": "Central",
 *   "modality": "presencial"
 * }
 */
function doPost(e) {
  try {
    var raw = '';
    if (e.postData && e.postData.contents) {
      raw = e.postData.contents;
    } else if (e.parameter && e.parameter.payload) {
      raw = e.parameter.payload;
    }

    if (!raw) {
      return jsonResponse({ success: false, error: 'Payload vazio' });
    }

    var payload = JSON.parse(raw);

    if (payload.token !== TOKEN_SEGURANCA) {
      return jsonResponse({ success: false, error: 'Token inválido' });
    }

    var titulo = "Atendimento: " + (payload.student_name || "Aluno");
    var descricao = "Agendamento criado via CRM.\n\n" +
                    "Aluno: " + payload.student_name + "\n" +
                    "E-mail: " + (payload.student_email || "Não informado") + "\n" +
                    "Unidade: " + (payload.unit_name || "Não informada") + "\n" +
                    "Modalidade: " + (payload.modality || "Não especificada");
    
    // Concatena data e hora para formatar o objeto Date (ex: 2026-06-20T14:30:00)
    var startDateTimeStr = payload.appointment_date + 'T' + payload.appointment_time;
    var startTime = new Date(startDateTimeStr);
    
    // Eventos de atendimento (Padrão 1 hora. Ajuste conforme necessidade)
    var endTime = new Date(startTime.getTime() + (60 * 60 * 1000));

    // Usa a agenda padrão do proprietário do script (Admin/Sistema)
    var calendar = CalendarApp.getDefaultCalendar();
    
    // Configura os convidados
    var convidados = payload.interviewer_email;
    if (payload.student_email && String(payload.student_email).indexOf('@') > 0) {
        // Opcional: Descomente para enviar convite para o aluno também
        // convidados += "," + payload.student_email;
    }

    var event = calendar.createEvent(titulo, startTime, endTime, {
      description: descricao,
      guests: convidados,
      sendInvites: true // Crucial para o evento aparecer na agenda do entrevistador e enviar notificação
    });

    return jsonResponse({
      success: true,
      event_id: event.getId(),
      message: "Evento criado com sucesso"
    });

  } catch (err) {
    Logger.log("Erro: " + err.message);
    return jsonResponse({ success: false, error: err.message });
  }
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Função para testar manualmente a criação do evento executando direto no editor do Apps Script
 */
function testarWebhook() {
  var payload = {
    token: TOKEN_SEGURANCA,
    student_name: "Teste Aluno",
    student_email: "teste@alunofirst.com.br",
    interviewer_email: "seu_email@dominio.com.br", // Mude para o seu e-mail do workspace
    appointment_date: "2026-06-20",
    appointment_time: "10:00:00",
    unit_name: "Central",
    modality: "online"
  };

  var e = {
    postData: { contents: JSON.stringify(payload) }
  };

  var res = doPost(e);
  Logger.log(res.getContent());
}
