# Sistema de Gerenciamento de Origens de Inscrição

## Visão Geral

O sistema de origens de inscrição permite que administradores configurem opções personalizadas de origem para cada unidade da escola. Isso permite rastrear de onde vêm as inscrições e analisar a efetividade de diferentes canais de marketing.

## Funcionalidades

### 🎯 **Para Administradores**

#### Acesso à Interface
1. Faça login como administrador
2. Vá para a aba **"Configurações"**
3. Clique na aba **"Origens"**

#### Gerenciar Origens por Unidade
- **Selecionar Unidade**: Escolha a unidade para gerenciar suas origens
- **Criar Nova Origem**: Adicione novas opções de origem
- **Editar Origem**: Modifique labels e configurações existentes
- **Ativar/Desativar**: Controle quais origens aparecem no formulário
- **Reordenar**: Organize a ordem de exibição das opções
- **Excluir**: Remova origens não utilizadas

#### Campos da Origem
- **Chave da Origem**: Identificador único (ex: `instagram`, `google_search`)
- **Label da Origem**: Texto exibido no formulário (ex: "Instagram", "Pesquisa no Google")
- **Ordem de Exibição**: Número que define a posição na lista
- **Status Ativo**: Se a origem está disponível para seleção

### 📝 **Para Usuários (Formulário de Inscrição)**

#### Experiência do Usuário
1. Acesse a página de inscrição
2. Preencha os dados pessoais e acadêmicos
3. Na seção **"Como você conheceu o Apogeu?"**, selecione uma opção
4. Complete a inscrição

#### Comportamento Dinâmico
- As opções carregam automaticamente baseadas na unidade selecionada
- Apenas origens ativas são exibidas
- As opções aparecem na ordem configurada pelo administrador

## Estrutura do Banco de Dados

### Tabela `unit_registration_sources`
```sql
- id: UUID (chave primária)
- unit_id: UUID (referência à unidade)
- source_key: TEXT (chave única da origem)
- source_label: TEXT (label para exibição)
- is_active: BOOLEAN (se está ativa)
- sort_order: INTEGER (ordem de exibição)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### Tabela `students`
```sql
- registration_source_id: UUID (referência à origem escolhida)
```

## Exemplos de Configuração

### Unidade Centro
```
1. Instagram
2. Pesquisa no Google
3. Facebook
4. Indicação de amigo/familiar
5. Panfleto/folheto
6. Outdoor/banner
7. Rádio
8. TV
9. Site institucional
10. WhatsApp Business
11. Outro
```

### Unidade Zona Sul
```
1. Instagram
2. Pesquisa no Google
3. Indicação de amigo/familiar
4. Panfleto/folheto
5. WhatsApp Business
6. YouTube
7. Outro
```

## Relatórios e Análises

### Queries Úteis

#### Relatório de Origem por Unidade
```sql
SELECT 
  u.name as unidade,
  urs.source_label as origem,
  COUNT(s.id) as total_inscricoes,
  ROUND(COUNT(s.id) * 100.0 / SUM(COUNT(s.id)) OVER (PARTITION BY u.id), 2) as percentual
FROM students s
JOIN unit_registration_sources urs ON urs.id = s.registration_source_id
JOIN units u ON u.id = urs.unit_id
WHERE s.created_at >= NOW() - INTERVAL '30 days'
GROUP BY u.id, u.name, urs.source_label, urs.sort_order
ORDER BY u.name, total_inscricoes DESC;
```

#### Top 5 Origens Mais Efetivas
```sql
WITH ranked_sources AS (
  SELECT 
    u.name as unidade,
    urs.source_label as origem,
    COUNT(s.id) as total_inscricoes,
    ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY COUNT(s.id) DESC) as ranking
  FROM students s
  JOIN unit_registration_sources urs ON urs.id = s.registration_source_id
  JOIN units u ON u.id = urs.unit_id
  WHERE s.created_at >= NOW() - INTERVAL '90 days'
  GROUP BY u.id, u.name, urs.source_label
)
SELECT unidade, origem, total_inscricoes
FROM ranked_sources
WHERE ranking <= 5
ORDER BY unidade, ranking;
```

## Boas Práticas

### Para Administradores
1. **Use chaves descritivas**: `instagram`, `google_search`, `indicacao`
2. **Labels claros**: "Instagram", "Pesquisa no Google", "Indicação de amigo/familiar"
3. **Ordene por relevância**: Coloque as origens mais importantes primeiro
4. **Mantenha ativo**: Desative origens que não são mais relevantes
5. **Seja específico**: "WhatsApp Business" é melhor que apenas "WhatsApp"

### Para Desenvolvedores
1. **Validação**: Sempre valide chaves únicas por unidade
2. **Sanitização**: Use `sanitizePlainText` para inputs
3. **Performance**: Carregue origens apenas quando necessário
4. **UX**: Mostre loading states e mensagens de erro claras

## Troubleshooting

### Problemas Comuns

#### "Nenhuma origem configurada"
- Verifique se a unidade tem origens cadastradas
- Confirme se pelo menos uma origem está ativa

#### "Erro ao carregar opções"
- Verifique a conexão com o banco de dados
- Confirme se as políticas RLS estão configuradas corretamente

#### "Chave já existe"
- Use uma chave diferente para a mesma unidade
- Verifique se não está tentando editar com a mesma chave

### Logs e Debug
- Use o console do navegador para ver logs de carregamento
- Verifique o Network tab para requests falhando
- Confirme se o usuário tem permissões de administrador

## Segurança

### Políticas RLS
- **Anônimos**: Podem ver apenas origens ativas
- **Autenticados**: Podem ver todas as origens
- **Administradores**: Podem criar, editar e excluir origens

### Validação
- Chaves são validadas para evitar SQL injection
- Labels são sanitizados para prevenir XSS
- Ordem é validada para evitar valores inválidos

## Roadmap

### Funcionalidades Futuras
- [ ] Importação em massa de origens via CSV
- [ ] Relatórios visuais com gráficos
- [ ] Configuração de origens por período
- [ ] Integração com Google Analytics
- [ ] Notificações quando novas origens são adicionadas
- [ ] Histórico de alterações nas origens
