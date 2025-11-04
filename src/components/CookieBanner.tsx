import React, { useEffect, useState } from 'react';

export const CookieBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('cookie-consent');
      setVisible(consent !== 'accepted');
    } catch {
      // fallback: se localStorage falhar, mostrar o banner
      setVisible(true);
    }
  }, []);

  const acceptCookies = () => {
    try {
      localStorage.setItem('cookie-consent', 'accepted');
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="mx-auto max-w-5xl">
        <div className="m-3 rounded-md bg-gray-900 text-white px-4 py-3 shadow-lg flex items-center justify-between">
          <div className="text-sm">
            Usamos cookies para melhorar sua experiência.{' '}
            <a href="/privacidade" className="underline text-blue-300 hover:text-blue-200">Saiba mais</a>.
          </div>
          <button
            onClick={acceptCookies}
            className="ml-4 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-sm"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;