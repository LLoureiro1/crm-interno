import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Enums, Tables } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Mail, Save } from 'lucide-react';
import { htmlToPlainText, plainTextToHtml } from '@/utils/emailTemplateBody';

type BodyViewMode = 'text' | 'html' | 'preview';

type EmailTriggerType = Enums<'email_trigger_type'>;
type EmailQueueStatus = Enums<'email_queue_status'>;
type EmailIntegration = Tables<'email_integrations'>;
type EmailIntegrationForm = Pick<
  EmailIntegration,
  'unit_id' | 'sender_email' | 'sender_name' | 'webhook_url' | 'is_active'
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};
type EmailTemplate = Tables<'email_templates'>;
type EmailQueueItem = Pick<
  Tables<'email_queue'>,
  | 'id'
  | 'trigger_type'
  | 'to_email'
  | 'subject'
  | 'status'
  | 'scheduled_for'
  | 'sent_at'
  | 'error_message'
  | 'created_at'
  | 'opened_at'
  | 'opened_count'
>;

interface Unit {
  id: string;
  name: string;
}

const TRIGGER_LABELS: Record<EmailTriggerType, string> = {
  student_registered: 'Nova inscrição',
  appointment_scheduled: 'Agendamento confirmado (inscrito)',
  appointment_scheduled_staff:
    '[INTERNO] Aviso ao colaborador — novo atendimento na agenda',
  appointment_reminder_same_day: 'Lembrete no dia do atendimento',
  exam_reminder_1_day_before: 'Lembrete 1 dia antes da prova',
  attended_over_a_week_ago: 'Atendido há mais de uma semana',
  missed_appointment_reschedule: 'Faltou ao atendimento — reagendar',
};

const STATUS_LABELS: Record<EmailQueueStatus, string> = {
  pending: 'Pendente',
  sending: 'Enviando',
  sent: 'Enviado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

const TEMPLATE_VARIABLES = [
  '{{student_name}}',
  '{{responsible_name}}',
  '{{email}}',
  '{{tracking_code}}',
  '{{status}}',
  '{{class_name}}',
  '{{unit_name}}',
  '{{unit_address}}',
  '{{unit_city}}',
  '{{unit_phone}}',
  '{{appointment_date}}',
  '{{appointment_time}}',
  '{{appointment_modality}}',
  '{{interviewer_name}}',
  '{{exam_date}}',
  '{{exam_time}}',
  '{{reschedule_link}}',
];

const PREVIEW_SAMPLE_DATA: Record<string, string> = {
  student_name: 'Maria Silva',
  responsible_name: 'João Silva',
  email: 'maria.silva@email.com',
  tracking_code: 'ABC12345',
  status: 'confirmado',
  class_name: '6º Ano A',
  unit_name: 'Unidade Centro',
  unit_address: 'Rua Exemplo, 100',
  unit_city: 'São Paulo',
  unit_phone: '(11) 99999-9999',
  appointment_date: '22/05/2026',
  appointment_time: '14:30',
  appointment_modality: 'Presencial',
  interviewer_name: 'Ana Coordenadora',
  exam_date: '23/05/2026',
  exam_time: '09:00',
};

function renderTemplatePreview(template: string, overrides: Record<string, string> = {}): string {
  const context = { ...PREVIEW_SAMPLE_DATA, ...overrides };

  return template.replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (_match, key: string) => {
    return context[key] ?? `[${key}]`;
  });
}

export const EmailAutomationManagement = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('default');
  const [integration, setIntegration] = useState<EmailIntegrationForm>({
    unit_id: null,
    sender_email: '',
    sender_name: '',
    webhook_url: '',
    is_active: true,
  });
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedTrigger, setSelectedTrigger] = useState<EmailTriggerType>('student_registered');
  const [queueItems, setQueueItems] = useState<EmailQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingIntegration, setSavingIntegration] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [bodyViewMode, setBodyViewMode] = useState<BodyViewMode>('text');
  const [plainTextBody, setPlainTextBody] = useState('');

  const unitFilter = selectedUnitId === 'default' ? null : selectedUnitId;

  const selectedUnit = useMemo(
    () => units.find((unit) => unit.id === selectedUnitId),
    [units, selectedUnitId],
  );

  const previewOverrides = useMemo(
    () => ({
      unit_name: selectedUnit?.name ?? PREVIEW_SAMPLE_DATA.unit_name,
    }),
    [selectedUnit],
  );

  const currentTemplate = useMemo(
    () => templates.find((template) => template.trigger_type === selectedTrigger),
    [templates, selectedTrigger],
  );

  const [templateForm, setTemplateForm] = useState({
    name: '',
    subject: '',
    html_body: '',
    is_active: true,
    send_at_hour: 8,
    send_at_minute: 0,
  });

  const previewSubject = useMemo(
    () => renderTemplatePreview(templateForm.subject, previewOverrides),
    [templateForm.subject, previewOverrides],
  );

  const previewHtmlBody = useMemo(
    () => renderTemplatePreview(templateForm.html_body, previewOverrides),
    [templateForm.html_body, previewOverrides],
  );

  useEffect(() => {
    void loadInitialData();
  }, []);

  useEffect(() => {
    void loadUnitData();
  }, [selectedUnitId]);

  useEffect(() => {
    if (!currentTemplate) {
      setTemplateForm({
        name: TRIGGER_LABELS[selectedTrigger],
        subject: '',
        html_body: '',
        is_active: true,
        send_at_hour: 8,
        send_at_minute: 0,
      });
      setPlainTextBody('');
      return;
    }

    const htmlBody = currentTemplate.html_body;
    setTemplateForm({
      name: currentTemplate.name,
      subject: currentTemplate.subject,
      html_body: htmlBody,
      is_active: currentTemplate.is_active,
      send_at_hour: currentTemplate.send_at_hour,
      send_at_minute: currentTemplate.send_at_minute,
    });
    setPlainTextBody(htmlToPlainText(htmlBody));
  }, [currentTemplate, selectedTrigger]);

  const handleBodyViewModeChange = (value: string) => {
    const mode = value as BodyViewMode;
    if (mode === 'text') {
      setPlainTextBody(htmlToPlainText(templateForm.html_body));
    }
    setBodyViewMode(mode);
  };

  const handlePlainTextBodyChange = (value: string) => {
    setPlainTextBody(value);
    setTemplateForm((prev) => ({ ...prev, html_body: plainTextToHtml(value) }));
  };

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [{ data: unitsData }, { data: queueData }] = await Promise.all([
        supabase.from('units').select('id, name').order('name'),
        supabase
          .from('email_queue')
          .select(
            'id, trigger_type, to_email, subject, status, scheduled_for, sent_at, error_message, created_at, opened_at, opened_count',
          )
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      setUnits(unitsData ?? []);
      setQueueItems(queueData ?? []);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao carregar configurações de e-mail');
    } finally {
      setLoading(false);
    }
  };

  const loadUnitData = async () => {
    let integrationQuery = supabase.from('email_integrations').select('*').limit(1);
    let templatesQuery = supabase.from('email_templates').select('*').order('trigger_type');

    if (unitFilter) {
      integrationQuery = integrationQuery.eq('unit_id', unitFilter);
      templatesQuery = templatesQuery.eq('unit_id', unitFilter);
    } else {
      integrationQuery = integrationQuery.is('unit_id', null);
      templatesQuery = templatesQuery.is('unit_id', null);
    }

    const [{ data: integrationData }, { data: templatesData }] = await Promise.all([
      integrationQuery.maybeSingle(),
      templatesQuery,
    ]);

    setIntegration(
      integrationData
        ? {
            ...integrationData,
            webhook_url: integrationData.webhook_url ?? '',
          }
        : {
            unit_id: unitFilter,
            sender_email: '',
            sender_name: '',
            webhook_url: '',
            is_active: true,
          },
    );
    setTemplates(templatesData ?? []);
  };

  const saveIntegration = async () => {
    if (!integration.sender_email.trim()) {
      toast.error('Informe o e-mail remetente do Google Workspace');
      return;
    }

    setSavingIntegration(true);
    try {
      const payload = {
        unit_id: unitFilter,
        sender_email: integration.sender_email.trim(),
        sender_name: integration.sender_name.trim(),
        webhook_url: integration.webhook_url?.trim() || null,
        is_active: integration.is_active,
        updated_at: new Date().toISOString(),
      };

      if (integration.id) {
        const { error } = await supabase
          .from('email_integrations')
          .update(payload)
          .eq('id', integration.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('email_integrations')
          .insert(payload)
          .select('*')
          .single();
        if (error) throw error;
        setIntegration(data);
      }

      toast.success('Integração salva com sucesso');
      await loadUnitData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar integração');
    } finally {
      setSavingIntegration(false);
    }
  };

  const saveTemplate = async () => {
    if (!templateForm.subject.trim() || !templateForm.html_body.trim()) {
      toast.error('Preencha assunto e corpo HTML do template');
      return;
    }

    setSavingTemplate(true);
    try {
      const payload = {
        unit_id: unitFilter,
        trigger_type: selectedTrigger,
        name: templateForm.name.trim() || TRIGGER_LABELS[selectedTrigger],
        subject: templateForm.subject,
        html_body: templateForm.html_body,
        is_active: templateForm.is_active,
        send_at_hour: templateForm.send_at_hour,
        send_at_minute: templateForm.send_at_minute,
        updated_at: new Date().toISOString(),
      };

      if (currentTemplate?.id) {
        const { error } = await supabase
          .from('email_templates')
          .update(payload)
          .eq('id', currentTemplate.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('email_templates').insert(payload);
        if (error) throw error;
      }

      toast.success('Template salvo com sucesso');
      await loadUnitData();
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar template');
    } finally {
      setSavingTemplate(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-gray-500">Carregando automação de e-mails...</p>;
  }

  return (
    <Tabs defaultValue="integration" className="min-w-0 space-y-4">
      <TabsList>
        <TabsTrigger value="integration">Integração</TabsTrigger>
        <TabsTrigger value="templates">Templates</TabsTrigger>
        <TabsTrigger value="queue">Fila de envios</TabsTrigger>
      </TabsList>

      <TabsContent value="integration" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Padrão (todas as unidades)</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          Os e-mails são enviados via <strong>Google Apps Script (Web App)</strong>.
          O CRM monta o HTML e envia para o webhook do Workspace, que registra na planilha e dispara o e-mail.
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="webhook_url">URL do Web App (Google Apps Script)</Label>
            <Input
              id="webhook_url"
              type="url"
              placeholder="https://script.google.com/macros/s/AKfycb.../exec"
              value={integration.webhook_url ?? ''}
              onChange={(event) =>
                setIntegration((prev) => ({ ...prev, webhook_url: event.target.value }))
              }
            />
            <p className="text-xs text-gray-500">
              Deixe em branco para usar a URL padrão configurada no secret{' '}
              <code>GOOGLE_APPS_SCRIPT_WEBHOOK_URL</code> do Supabase.
              O token de segurança fica no secret <code>GOOGLE_APPS_SCRIPT_WEBHOOK_TOKEN</code>.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="sender_email">E-mail remetente (Google Workspace)</Label>
            <Input
              id="sender_email"
              type="email"
              placeholder="noreply@escola.com.br"
              value={integration.sender_email}
              onChange={(event) =>
                setIntegration((prev) => ({ ...prev, sender_email: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sender_name">Nome do remetente</Label>
            <Input
              id="sender_name"
              placeholder="Escola Exemplo"
              value={integration.sender_name}
              onChange={(event) =>
                setIntegration((prev) => ({ ...prev, sender_name: event.target.value }))
              }
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={integration.is_active}
            onCheckedChange={(checked) =>
              setIntegration((prev) => ({ ...prev, is_active: checked }))
            }
          />
          <Label>Integração ativa</Label>
        </div>

        <Button onClick={saveIntegration} disabled={savingIntegration}>
          <Save className="mr-2 h-4 w-4" />
          {savingIntegration ? 'Salvando...' : 'Salvar integração'}
        </Button>
      </TabsContent>

      <TabsContent value="templates" className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Unidade</Label>
            <Select value={selectedUnitId} onValueChange={setSelectedUnitId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Padrão (fallback)</SelectItem>
                {units.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Evento</Label>
            <Select
              value={selectedTrigger}
              onValueChange={(value) => setSelectedTrigger(value as EmailTriggerType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="rounded-md border bg-gray-50 p-3 text-sm text-gray-600">
          Variáveis disponíveis: {TEMPLATE_VARIABLES.join(', ')}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="template_name">Nome interno</Label>
            <Input
              id="template_name"
              value={templateForm.name}
              onChange={(event) =>
                setTemplateForm((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="template_subject">Assunto</Label>
            <Input
              id="template_subject"
              value={templateForm.subject}
              onChange={(event) =>
                setTemplateForm((prev) => ({ ...prev, subject: event.target.value }))
              }
            />
          </div>
        </div>

        {selectedTrigger === 'appointment_scheduled_staff' && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
            <strong>E-mail interno (colaborador):</strong> este template é enviado apenas ao
            usuário do sistema designado como entrevistador/atendente do agendamento. Não use
            linguagem voltada à família do inscrito. O assunto padrão inclui{' '}
            <code className="rounded bg-amber-100 px-1">[INTERNO — Colaborador]</code> para
            deixar claro no inbox que é aviso da equipe.
          </div>
        )}

        {selectedTrigger !== 'student_registered' &&
          selectedTrigger !== 'appointment_scheduled' &&
          selectedTrigger !== 'appointment_scheduled_staff' && (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="send_at_hour">Horário de envio (lembretes)</Label>
              <Input
                id="send_at_hour"
                type="number"
                min={0}
                max={23}
                value={templateForm.send_at_hour}
                onChange={(event) =>
                  setTemplateForm((prev) => ({
                    ...prev,
                    send_at_hour: Number(event.target.value),
                  }))
                }
              />
              <p className="text-xs text-gray-500">Horário de Brasília (UTC-3). Ex.: 8 = envio às 8h no Brasil.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="send_at_minute">Minuto</Label>
              <Input
                id="send_at_minute"
                type="number"
                min={0}
                max={59}
                value={templateForm.send_at_minute}
                onChange={(event) =>
                  setTemplateForm((prev) => ({
                    ...prev,
                    send_at_minute: Number(event.target.value),
                  }))
                }
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Corpo do e-mail</Label>
            <Tabs value={bodyViewMode} onValueChange={handleBodyViewModeChange}>
              <TabsList className="h-8">
                <TabsTrigger value="text" className="px-2 text-xs sm:px-3">
                  Texto
                </TabsTrigger>
                <TabsTrigger value="html" className="px-2 text-xs sm:px-3">
                  Código HTML
                </TabsTrigger>
                <TabsTrigger value="preview" className="px-2 text-xs sm:px-3">
                  Visualização
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {bodyViewMode === 'text' ? (
            <div className="space-y-2">
              <Textarea
                id="template_text"
                className="min-h-[320px] text-sm leading-relaxed"
                value={plainTextBody}
                onChange={(event) => handlePlainTextBodyChange(event.target.value)}
                placeholder={'Olá, {{student_name}}!\n\nSua inscrição na {{unit_name}} foi recebida...'}
              />
              <p className="text-xs text-gray-500">
                Edite apenas o texto. Use uma linha em branco entre parágrafos. Variáveis como{' '}
                <code className="rounded bg-gray-100 px-1">{'{{student_name}}'}</code> são
                preservadas e refletem automaticamente no HTML e na visualização. Formatação
                avançada (cores, tabelas) permanece na aba Código HTML.
              </p>
            </div>
          ) : bodyViewMode === 'html' ? (
            <Textarea
              id="template_html"
              className="min-h-[320px] font-mono text-sm"
              value={templateForm.html_body}
              onChange={(event) =>
                setTemplateForm((prev) => ({ ...prev, html_body: event.target.value }))
              }
            />
          ) : (
            <div className="overflow-hidden rounded-lg border bg-white shadow-sm">
              <div className="border-b bg-gray-50 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                  Pré-visualização
                </p>
                <p className="mt-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">De:</span>{' '}
                  {integration.sender_name || 'Escola'}{' '}
                  {integration.sender_email ? `<${integration.sender_email}>` : '<noreply@escola.com.br>'}
                </p>
                <p className="mt-1 text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Assunto:</span>{' '}
                  {previewSubject || 'Sem assunto'}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  Variáveis preenchidas com dados de exemplo para visualização.
                </p>
              </div>
              <div
                className="min-h-[320px] bg-white p-6"
                dangerouslySetInnerHTML={{
                  __html: previewHtmlBody || '<p style="color:#9ca3af">Nenhum conteúdo para exibir.</p>',
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={templateForm.is_active}
            onCheckedChange={(checked) =>
              setTemplateForm((prev) => ({ ...prev, is_active: checked }))
            }
          />
          <Label>Template ativo</Label>
        </div>

        <Button onClick={saveTemplate} disabled={savingTemplate}>
          <Mail className="mr-2 h-4 w-4" />
          {savingTemplate ? 'Salvando...' : 'Salvar template'}
        </Button>
      </TabsContent>

      <TabsContent value="queue" className="min-w-0">
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Assunto</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Aberto em</TableHead>
              <TableHead>Envio</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queueItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-gray-500">
                  Nenhum e-mail na fila ainda.
                </TableCell>
              </TableRow>
            ) : (
              queueItems.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{TRIGGER_LABELS[item.trigger_type]}</TableCell>
                  <TableCell>{item.to_email}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{item.subject}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === 'sent'
                          ? 'default'
                          : item.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {STATUS_LABELS[item.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {item.opened_at ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-green-600">
                          {new Date(item.opened_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </span>
                        {item.opened_count && item.opened_count > 1 && (
                          <span className="text-[10px] text-gray-400">
                            {item.opened_count} aberturas
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(item.scheduled_for).toLocaleString('pt-BR')}</TableCell>
                  <TableCell className="max-w-[200px] truncate text-red-600">
                    {item.error_message ?? '-'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        </div>
      </TabsContent>
    </Tabs>
  );
};
