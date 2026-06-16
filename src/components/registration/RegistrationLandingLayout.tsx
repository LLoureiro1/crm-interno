import { ReactNode } from 'react';

const HERO_BG = '/mock-crianca.png';

const HIGHLIGHTS = [
  {
    emoji: '📚',
    title: 'Formação completa',
    description:
      'Do berçário ao pré-vestibular e pré-militar, com estrutura para cada etapa.',
  },
  {
    emoji: '💛',
    title: 'Acolhimento e cuidado',
    description:
      'Ambientes seguros, estimulantes e equipe pedagógica dedicada a cada aluno.',
  },
  {
    emoji: '🎯',
    title: 'Acompanhamento individual',
    description:
      'Orientação pedagógica e suporte personalizado ao longo da jornada escolar.',
  },
  {
    emoji: '🏆',
    title: 'Resultados comprovados',
    description:
      'Milhares de aprovações em universidades e concursos militares em todo o país.',
  },
] as const;

const STATS = [
  { value: '5 mil+', label: 'Alunos na rede' },
  { value: '6', label: 'Cidades' },
  { value: '25+', label: 'Anos de história' },
] as const;

interface RegistrationLandingLayoutProps {
  children: ReactNode;
  unitName?: string | null;
}

export function RegistrationLandingLayout({
  children,
  unitName,
}: RegistrationLandingLayoutProps) {
  return (
    <div className="min-h-svh bg-white">
      <section
        className="relative flex min-h-[min(100svh,900px)] items-center justify-center bg-cover bg-center px-4 py-12 sm:px-6 lg:px-8"
        style={{ backgroundImage: `url(${HERO_BG})` }}
      >
        <div className="absolute inset-0 bg-[#132856]/5" aria-hidden />
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#132856]/25 via-[#1b3472]/75 to-[#1437cc]/65"
          aria-hidden
        />

        <div className="relative z-10 w-full max-w-2xl">
          <div className="mb-6 rounded-2xl bg-[#132856]/8 px-5 py-6 text-center text-white shadow-xl backdrop-blur-md ring-1 ring-white/15 sm:px-8">
            <img
              src="/logo_apogeu_nobg.png"
              alt="Rede de Ensino Apogeu"
              className="mx-auto mb-4 h-16 w-auto object-contain drop-shadow-lg sm:h-20"
            />
            <h1 className="text-2xl font-bold leading-tight drop-shadow-sm sm:text-3xl lg:text-4xl">
              Dê o primeiro passo com o{' '}
              <span className="text-[#ffac1a]">Apogeu</span>
            </h1>
            <p className="mx-auto mt-3 max-w-lg text-sm font-medium text-white sm:text-base">
              {unitName
                ? `Inscrição para a unidade ${unitName}. Preencha o formulário e nossa equipe entrará em contato.`
                : 'Mais que uma escola, um legado de conquistas. Deixe seus dados para iniciar o Processo de Admissão 2026.'}
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/20 bg-white shadow-2xl ring-1 ring-black/10">
            {children}
          </div>
        </div>
      </section>

      <section className="bg-white px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-10 text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-[#ffac1a]">
              Por que escolher o Apogeu
            </p>
            <h2 className="mt-2 text-2xl font-bold text-[#1437cc] sm:text-3xl">
              O que faz o Apogeu único
            </h2>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {HIGHLIGHTS.map(({ emoji, title, description }) => (
              <article
                key={title}
                className="rounded-2xl bg-slate-100 px-5 py-8 text-center"
              >
                <div className="mb-4 text-5xl leading-none" aria-hidden>
                  {emoji}
                </div>
                <h3 className="text-base font-bold text-[#1437cc] sm:text-lg">{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-600">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-[#1b3472] px-4 py-12 text-white sm:px-6">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-10 sm:gap-16">
          {STATS.map(({ value, label }) => (
            <div key={label} className="text-center">
              <p className="text-3xl font-bold text-[#ffac1a] sm:text-4xl">{value}</p>
              <p className="mt-1 text-sm text-white/75">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-4 py-6 text-center">
        <img
          src="/logo_apogeu_nobg.png"
          alt="Apogeu"
          className="mx-auto mb-2 h-8 w-auto opacity-80"
        />
        <p className="text-xs text-slate-500">
          © {new Date().getFullYear()} Rede de Ensino Apogeu. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}
