# Design System — CRM Apogeu

Referência sintética de tipografia, cores e layout extraída do código (`src/index.css`, `tailwind.config.ts`, `Layout`, `AppSidebar`, componentes UI).

---

## Tipografia

### Família

Não há fonte customizada importada. O app usa a pilha padrão do Tailwind / sistema:

```
ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", …
```

**E-mails transacionais** (`emailTemplateBody.ts`): `Arial, sans-serif`.

### Escala de tamanhos (uso no projeto)

| Token / classe | Tamanho | Uso típico |
|----------------|---------|------------|
| `text-[10px]` | 10px | Labels da sidebar (grupos), nav mobile inferior |
| `text-[11px]` | 11px | Subtítulo da sidebar (“CRM Parceiros”) |
| `text-xs` | 12px | Badges, pills de seção compacta, metadados |
| `text-sm` | 14px | **Corpo padrão**, menu lateral, header, botões |
| `text-base` | 16px | Títulos de listas/tabelas |
| `text-lg` | 18px | Títulos de seção (formulários, gestão) |
| `text-xl` | 20px | Títulos de abas internas |
| `text-2xl` | 24px | Login, confirmação de inscrição |

### Pesos

| Classe | Uso |
|--------|-----|
| `font-medium` | Breadcrumb, nav mobile, nomes de usuário |
| `font-semibold` | Botões CTA, badges, títulos de seção, item ativo sidebar |
| `font-bold` | Logo “APOGEU”, títulos de página/login |

### Outros

- Labels de grupo na sidebar: `uppercase tracking-wider`
- Cabeçalhos de tabela: `uppercase tracking-wide text-gray-400`
- Ícones (Lucide): geralmente `h-4 w-4` (header) ou `h-5 w-5` (nav mobile)

---

## Cores

### Marca Apogeu (hex — uso direto no código)

| Nome | Hex | Uso |
|------|-----|-----|
| Azul primário | `#1437cc` | Breadcrumb, links, gráficos, boot error |
| Azul sidebar | `#1b3472` | Fundo da sidebar |
| Azul sidebar borda | `#132856` | Borda direita da sidebar |
| Laranja destaque | `#ffac1a` | Item ativo menu, CTA “Nova Inscrição”, badge perfil |
| Laranja hover | `#e89b0f` | Hover do CTA sidebar |

### Tokens CSS (`src/index.css`) — tema claro

Valores em HSL; no Tailwind: `hsl(var(--token))`.

| Token | HSL | ≈ Hex | Papel |
|-------|-----|-------|-------|
| `--background` | `0 0% 100%` | `#ffffff` | Fundo base |
| `--foreground` | `222.2 84% 4.9%` | `#020817` | Texto principal |
| `--primary` | `227 82% 44%` | `#1437cc` | Ações, links, pills ativas |
| `--primary-foreground` | `0 0% 100%` | `#ffffff` | Texto sobre primário |
| `--secondary` | `210 40% 96.1%` | `#f1f5f9` | Fundos secundários |
| `--muted` / `--muted-foreground` | `210 40% 96.1%` / `215.4 16.3% 46.9%` | — | Texto/disabled |
| `--destructive` | `353 87% 52%` | `#ef4444` | Erros, desistente |
| `--border` / `--input` | `214.3 31.8% 91.4%` | `#e2e8f0` | Bordas, inputs |
| `--ring` | `227 82% 44%` | `#1437cc` | Focus ring |
| `--radius` | `0.5rem` | 8px | Border radius base |

### Sidebar (tokens + overrides)

| Token / valor | HSL / Hex | Uso |
|---------------|-----------|-----|
| `--sidebar-background` | `230 77% 23%` | Token shadcn |
| Override real | `#1b3472` | `AppSidebar` |
| `--sidebar-primary` | `30 95% 53%` | ≈ laranja |
| `--sidebar-accent` | `38 100% 55%` | Hover/acento |
| Texto sidebar | `text-white/90`, `text-white/60`, `text-white/45` | Hierarquia |
| Overlay hover | `bg-white/10` | Itens de menu |
| Item ativo | `bg-[#ffac1a]` | Nav selecionado |

### Neutros Tailwind (layout)

| Classe | Uso |
|--------|-----|
| `bg-slate-50` | Área de conteúdo principal |
| `bg-white` | Header, nav mobile, cards |
| `border-slate-200` | Header, nav inferior |
| `text-slate-500` / `text-slate-700` | Breadcrumb, nome do usuário |
| `text-gray-800` / `text-gray-900` | Formulários públicos, títulos |

### Status do aluno (`src/utils/studentStatus.ts`)

| Status | Cor | Badge (variant) |
|--------|-----|-----------------|
| Não confirmado | `#94a3b8` | outline |
| Confirmado | `#64748b` | secondary |
| Nenhum agendamento | `#cbd5e1` | outline |
| Atendimento agendado | `#64748b` | secondary |
| Faltou ao atendimento | `#A78BFA` | purple |
| Atendimento recente | `#1437cc` | default (primary) |
| Atend. há +1 semana | `#f97316` | warning |
| Ausente | `#F87171` | ausente |
| Desistente | `#ef4444` | destructive |
| Matriculado | `#22c55e` | success |
| Cadastro inválido | `#000000` | cadastro_invalido |
| Processo anos anteriores | `#999999` | processo_anos_anteriores |

### Superfícies semânticas (formulários / confirmação)

| Contexto | Classes |
|----------|---------|
| Login | `bg-blue-50` |
| Sucesso | `bg-green-50`, `text-green-800` |
| Info / prova | `bg-blue-50`, `border-blue-200` |
| Alerta | `bg-yellow-50`, `text-yellow-800` |
| Erro campo | `text-red-600`, `border-red-500` |

### E-mail HTML

- Largura máxima: `600px`
- Fonte: Arial
- Links/tabelas internas: `#2563eb` (links), `#f3f4f6` (thead)

---

## Layout

### Arquitetura da shell (dashboard autenticado)

```
┌─────────────────────────────────────────────────────────┐
│ Sidebar (desktop) │ Header sticky (h-14)              │
│ 16rem / 3rem icon │ Breadcrumb + pills + perfil       │
├───────────────────┼─────────────────────────────────────┤
│                   │ Conteúdo (bg-slate-50)              │
│                   │ padding: 16 → 24 → 32px            │
│                   │                                     │
├───────────────────┴─────────────────────────────────────┤
│ MobileTabNav fixo (bottom, só < md)                     │
└─────────────────────────────────────────────────────────┘
```

**Componentes:** `SidebarProvider` → `AppSidebar` + `SidebarInset` → `LayoutHeader` + conteúdo + `MobileTabNav`.

### Dimensões

| Elemento | Valor |
|----------|-------|
| Sidebar expandida | `16rem` (256px) |
| Sidebar recolhida (ícone) | `3rem` (48px) |
| Sidebar mobile (drawer) | `18rem`, max `85vw` |
| Header | `h-14` (56px); `min-h-14` quando há pills |
| Container Tailwind | `center`, padding `2rem`, `2xl: 1400px` |
| Cards login/inscrição | `max-w-md` / `max-w-2xl` |

### Espaçamento do conteúdo

| Breakpoint | Padding |
|------------|---------|
| Mobile | `p-4`, `pb-20` (espaço nav inferior + safe area) |
| `md` | `p-6` |
| `lg` | `p-8` |

Safe area: `env(safe-area-inset-bottom)` na nav mobile e padding inferior.

### Breakpoints

| Nome | Largura | Comportamento |
|------|---------|---------------|
| Mobile | `< 768px` | Sidebar oculta; drawer via trigger; bottom tab nav |
| `md`+ | `≥ 768px` | Sidebar fixa; header com perfil visível |
| `lg`+ | `≥ 1024px` | Pills compactas em relatórios estratégicos |

Hook: `useIsMobile()` → `max-width: 767px`.

### Header

- Sticky `top-0 z-20`
- `border-b border-slate-200 bg-white shadow-sm`
- Pills de seção: `rounded-full`, ativo = `bg-primary text-primary-foreground`, inativo = `border-primary/20 text-primary`
- Badge perfil: `bg-[#ffac1a]/15 text-[#1437cc]`

### Sidebar

- Collapsible em modo ícone (`collapsible="icon"`)
- Grupos: “Gestão”, “Sistema”
- Cards internos: `rounded-lg bg-white/[0.04] ring-1 ring-white/10`
- CTA “Nova Inscrição”: full width, laranja, oculto quando sidebar recolhida

### Nav mobile inferior

- `fixed bottom-0 z-30`
- `border-t border-slate-200 bg-white shadow-lg`
- Ícone `h-5 w-5` + label `text-[10px]`
- Ativo: `text-primary`; inativo: `text-slate-500`

### Componentes base (shadcn/ui)

| Componente | Padrão |
|------------|--------|
| Button | `rounded-md text-sm font-medium`; alturas `h-9` / `h-10` / `h-11` |
| Badge | `rounded-full text-xs font-semibold px-2.5 py-0.5` |
| Card | fundo `card`, radius via `--radius` |
| Input | borda `border-input`, focus `ring-ring` |
| Border radius | `lg: 8px`, `md: 6px`, `sm: 4px` |

### Páginas públicas (login / inscrição)

- Layout centrado vertical: `min-h-screen flex items-center justify-center`
- Login: `bg-blue-50`, card `max-w-md`
- Confirmação inscrição: `bg-gray-100`, card `max-w-2xl`

### Impressão

- Classe `.proposal-print-area` para propostas
- Página A4, margem `12mm`

---

## Stack de UI

- **Tailwind CSS** + **shadcn/ui** (Radix)
- **Lucide React** (ícones)
- **next-themes** (dark mode configurado em CSS; uso limitado no app)
- Logo: `/logo_apogeu_nobg.png`

---

## Referências no código

| Assunto | Arquivo |
|---------|---------|
| Tokens CSS | `src/index.css` |
| Mapeamento Tailwind | `tailwind.config.ts` |
| Shell principal | `src/components/Layout.tsx` |
| Sidebar | `src/components/AppSidebar.tsx` |
| Nav mobile | `src/components/MobileTabNav.tsx` |
| Cores de status | `src/utils/studentStatus.ts` |
| Badges | `src/components/ui/badge.tsx` |
| Botões | `src/components/ui/button.tsx` |
