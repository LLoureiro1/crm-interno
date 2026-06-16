const TEMPLATE_VAR_PATTERN = /(\{\{[^}]+\}\})/g;

const BLOCK_TAGS = new Set(['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH']);

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

function getTextBlocks(root: HTMLElement): HTMLElement[] {
  const blocks: HTMLElement[] = [];

  const walk = (node: Element) => {
    for (const child of Array.from(node.children)) {
      if (BLOCK_TAGS.has(child.tagName)) {
        blocks.push(child as HTMLElement);
      } else {
        walk(child);
      }
    }
  };

  walk(root);
  return blocks;
}

function updateInlineTextContent(el: HTMLElement, plain: string): void {
  const parts = plain.split(TEMPLATE_VAR_PATTERN).filter((part) => part.length > 0);
  let partIdx = 0;

  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      while (partIdx < parts.length && /^\{\{/.test(parts[partIdx])) {
        partIdx += 1;
      }
      if (partIdx < parts.length && !/^\{\{/.test(parts[partIdx])) {
        node.textContent = parts[partIdx];
        partIdx += 1;
      }
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE) return;

    const element = node as HTMLElement;
    const onlyText = element.textContent?.trim() ?? '';

    if (element.children.length === 0 && /^\{\{[^}]+\}\}$/.test(onlyText)) {
      while (partIdx < parts.length && !/^\{\{/.test(parts[partIdx])) {
        partIdx += 1;
      }
      if (partIdx < parts.length && /^\{\{/.test(parts[partIdx])) {
        element.textContent = parts[partIdx];
        partIdx += 1;
      }
      return;
    }

    for (const child of Array.from(node.childNodes)) {
      walk(child);
    }
  };

  walk(el);
}

function setBlockPlainText(el: HTMLElement, plain: string): void {
  const normalized = plain.replace(/\r\n/g, '\n').trim();
  if (!normalized) return;

  const anchor = el.querySelector('a');
  if (anchor && el.querySelectorAll('a').length === 1) {
    const anchorText = anchor.textContent?.trim() ?? '';
    const blockText = el.textContent?.trim() ?? '';
    if (anchorText === blockText || el.children.length === 1) {
      anchor.textContent = normalized.replace(/\n+/g, ' ');
      return;
    }
  }

  if (el.children.length > 0) {
    updateInlineTextContent(el, normalized);
    return;
  }

  el.innerHTML = normalized
    .split('\n')
    .map((line) => escapeHtmlPreservingVariables(line.trim()))
    .join('<br/>');
}

/** Aplica edições de texto simples sem recriar tags, estilos ou botões. */
export function mergePlainTextIntoHtml(html: string, plainText: string): string {
  if (!html.trim()) return plainTextToHtml(plainText);
  if (typeof DOMParser === 'undefined') return html;

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div data-email-root>${html}</div>`, 'text/html');
  const root = doc.querySelector('[data-email-root]') as HTMLElement | null;
  if (!root) return html;

  const blocks = getTextBlocks(root);
  const newParagraphs = plainText
    .replace(/\r\n/g, '\n')
    .trim()
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (blocks.length === 0 || newParagraphs.length === 0) {
    return html;
  }

  const limit = Math.min(blocks.length, newParagraphs.length);
  for (let i = 0; i < limit; i += 1) {
    setBlockPlainText(blocks[i], newParagraphs[i]);
  }

  return root.innerHTML;
}
