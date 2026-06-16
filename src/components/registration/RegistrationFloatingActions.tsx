import { useCallback, useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';

function buildWhatsAppHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  if (!digits) return null;
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`;
  return `https://wa.me/${withCountry}`;
}

export function RegistrationFloatingActions() {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [whatsappHref, setWhatsappHref] = useState<string | null>(null);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 300);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const loadCentralPhone = async () => {
      const { data: units } = await supabase.from('units').select('phone, name');
      const central = (units ?? []).find((u) => u.name.toLowerCase() === 'central');

      if (central?.phone) {
        setWhatsappHref(buildWhatsAppHref(central.phone));
      }
    };

    loadCentralPhone();
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toTopBottom = whatsappHref ? 'bottom-20' : 'bottom-6';

  return (
    <>
      {whatsappHref && (
        <Button
          asChild
          size="icon"
          className="fixed bottom-6 right-6 z-30 h-12 w-12 rounded-full bg-[#25D366] shadow-lg hover:bg-[#20bd5a]"
        >
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Falar no WhatsApp da unidade Central"
          >
            <img src="/whatsapp-logo.png" alt="" className="h-6 w-6" aria-hidden />
          </a>
        </Button>
      )}

      {showBackToTop && (
        <Button
          type="button"
          onClick={scrollToTop}
          size="icon"
          className={`fixed ${toTopBottom} right-6 z-30 rounded-full bg-primary shadow-lg hover:bg-primary/90`}
          aria-label="Voltar ao topo"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      )}
    </>
  );
}
