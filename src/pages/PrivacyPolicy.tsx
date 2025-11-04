import React from 'react';

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-4">Política de Privacidade</h1>
        <p className="text-gray-700 mb-4">
          Valorizamos a proteção dos seus dados pessoais. Esta Política de Privacidade explica como coletamos,
          utilizamos e protegemos as informações fornecidas pelos candidatos durante o processo de inscrição.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Coleta e Uso de Dados</h2>
        <p className="text-gray-700 mb-2">
          Os dados coletados no formulário de inscrição (como nome, dados de contato e informações acadêmicas)
          são utilizados exclusivamente para fins de inscrição, atendimento ao candidato e comunicação sobre o
          Processo de Admissão 2026.

          Os dados poderão ser mantidos por tempo indeterminado, enquanto houver interesse legítimo da instituição em manter contato com os inscritos, respeitando sempre o direito de exclusão mediante solicitação.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Compartilhamento</h2>
        <p className="text-gray-700 mb-2">
          Não compartilhamos suas informações com terceiros, exceto quando exigido por lei ou para cumprimento de
          obrigações legais.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Segurança</h2>
        <p className="text-gray-700 mb-2">
          Adotamos medidas de segurança técnicas e organizacionais para proteger seus dados contra acessos não
          autorizados, uso indevido, alteração e destruição.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Direitos dos Titulares</h2>
        <p className="text-gray-700 mb-2">
          Conforme a LGPD, você pode solicitar acesso, correção, atualização ou exclusão de seus dados, bem como
          revogar consentimento. Para exercer seus direitos, entre em contato pelos canais oficiais da instituição como email e telefone.
        </p>

        <h2 className="text-xl font-semibold text-gray-900 mt-6 mb-2">Cookies</h2>
        <p className="text-gray-700 mb-2">
          Utilizamos cookies para melhorar sua experiência de navegação. Você pode aceitar ou rejeitar o uso de
          cookies por meio do banner exibido no site.
        </p>

        <p className="text-sm text-gray-600 mt-6">
          Última atualização: {new Date().toLocaleDateString('pt-BR')}
        </p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;