import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ContactLists from "./pages/ContactLists";
import Index from "./pages/Index";
import Registration from "./pages/Registration";
import StudentProfile from "./pages/StudentProfile";
import SetPassword from "./pages/SetPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Confirmation from './components/registration/Confirmation';
import PrivacyPolicy from './pages/PrivacyPolicy';
import ErrorBoundary from "./components/ErrorBoundary";
import { DOMErrorPrevention } from "./components/DOMErrorPrevention";
import { useTrackingCode } from "./hooks/useTrackingCode";
import { CookieBanner } from "./components/CookieBanner";

const queryClient = new QueryClient();

// Componente de fallback simples para erros não relacionados a removeChild
const ErrorFallback = () => (
  <div className="flex items-center justify-center h-screen bg-red-50">
    <div className="text-center p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-xl font-bold text-red-600 mb-2">Algo deu errado</h2>
      <p className="mb-4">Ocorreu um erro inesperado. Por favor, tente recarregar a página.</p>
      <button 
        onClick={() => window.location.reload()} 
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
      >
        Recarregar
      </button>
    </div>
  </div>
);

// Componente interno para inicializar o tracking dentro do BrowserRouter
const TrackingProvider = ({ children }: { children: React.ReactNode }) => {
  // Inicializa o sistema de tracking de códigos
  useTrackingCode();
  
  return <>{children}</>;
};

const App = () => (
  <DOMErrorPrevention>
    <ErrorBoundary fallback={<ErrorFallback />}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <TrackingProvider>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/inscricao/:unitSlug" element={<Registration />} />
                <Route path="/inscricao" element={<Registration />} />
                <Route path="/privacidade" element={<PrivacyPolicy />} />
                <Route path="/student/:id" element={<StudentProfile />} />
                <Route path="/set-password" element={<SetPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/confirmacao" element={<Confirmation />} />
                <Route path="/contact-lists" element={<ContactLists />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
              <CookieBanner />
            </TrackingProvider>
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </DOMErrorPrevention>
);

export default App;