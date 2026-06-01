const TEMPLATE_VAR_PATTERN = /(\{\{[^}]+\}\})/g;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeHtmlPreservingVariables(text: string): string {
  return text.split(TEMPLATE_VAR_PATTERN).map((part) => {
    if (/^\{\{[^}]+\}\}$/.test(part)) return part;
    return escapeHtml(part);
  }).join('');
}

/** Converte HTML do template em texto simples para edição por usuários leigos. */
export function htmlToPlainText(html: string): string {
  if (!html.trim()) return '';

  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)>/gi, '\n\n')
    .replace(/<\/td>/gi, '\t')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<hr[^>]*>/gi, '\n\n---\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  text = text.replace(/[ \t]+\n/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/** Gera HTML padrão de e-mail a partir de texto simples (parágrafos separados por linha em branco). */
export function plainTextToHtml(text: string): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) {
    return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <p></p>
    </div>`;
  }

  const paragraphs = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);

  const inner = paragraphs
    .map((block) => {
      const lines = block.split('\n').map((line) => escapeHtmlPreservingVariables(line.trim()));
      return `      <p>${lines.join('<br/>')}</p>`;
    })
    .join('\n');

  return `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
${inner}
    </div>`;
}
