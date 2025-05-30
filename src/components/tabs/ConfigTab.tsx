
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const ConfigTab = () => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Configurações do Sistema</h2>
        <p className="text-gray-600">Gerencie usuários, unidades, turmas e configurações gerais</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Gestão de Usuários</CardTitle>
            <CardDescription>Cadastre e gerencie usuários do sistema</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Em desenvolvimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gestão de Unidades</CardTitle>
            <CardDescription>Cadastre e gerencie unidades escolares</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Em desenvolvimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gestão de Turmas</CardTitle>
            <CardDescription>Cadastre e gerencie turmas e séries</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Em desenvolvimento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upload de Notas</CardTitle>
            <CardDescription>Faça upload das planilhas de notas</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-gray-500">Em desenvolvimento</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
