import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { getAuthActionLabel } from '@/utils/authActivityLog';
import type { Enums, Tables } from '@/integrations/supabase/types';

type AuthLogRow = Tables<'user_auth_logs'> & {
  profiles: Pick<Tables<'profiles'>, 'name' | 'email' | 'profile'> | null;
};

const PROFILE_LABELS: Record<Enums<'user_profile'>, string> = {
  admin: 'Admin',
  direcao: 'Direção',
  entrevistador: 'Entrevistador',
  padrao: 'Padrão',
};

type UserAuthActivitySectionProps = {
  logs: AuthLogRow[];
  loading: boolean;
};

export function UserAuthActivitySection({ logs, loading }: UserAuthActivitySectionProps) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Carregando registros de acesso...</p>;
  }

  if (logs.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum registro de acesso no período.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Perfil</TableHead>
            <TableHead>Ação</TableHead>
            <TableHead>Data e hora</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => (
            <TableRow key={log.id}>
              <TableCell>
                <div className="font-medium text-foreground">{log.profiles?.name ?? '—'}</div>
                <div className="text-xs text-muted-foreground">{log.profiles?.email ?? '—'}</div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {log.profiles?.profile ? PROFILE_LABELS[log.profiles.profile] : '—'}
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    log.action === 'login'
                      ? 'default'
                      : log.action === 'logout'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {getAuthActionLabel(log.action)}
                </Badge>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {new Date(log.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export type { AuthLogRow };
