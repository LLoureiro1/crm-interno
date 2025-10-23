# Sistema de Rastreamento de Registro - Teste

## Implementação Concluída

O sistema de rastreamento de códigos de registro foi implementado com sucesso. Aqui está um resumo das funcionalidades:

### Funcionalidades Implementadas

1. **Coluna tracking_code na tabela students**
   - Adicionada via migração SQL
   - Tipo: TEXT (permite valores nulos)
   - Indexada para performance

2. **Hook useTrackingCode**
   - Captura códigos de URL parameters (`tracking` ou `utm_source`)
   - Armazena no localStorage com expiração de 30 dias
   - Sanitiza códigos para segurança
   - Fornece funções para gerenciar o tracking

3. **Integração no App.tsx**
   - TrackingProvider inicializa o sistema automaticamente
   - Captura códigos assim que a aplicação carrega

4. **Integração no RegistrationForm.tsx**
   - Inclui tracking_code automaticamente nos registros
   - Usa o código ativo do localStorage

### Como Testar

#### 1. URLs de Teste
Acesse a aplicação com estes parâmetros:

```
http://localhost:5173/?tracking=FACEBOOK_ADS_2024
http://localhost:5173/?utm_source=GOOGLE_ADS
http://localhost:5173/registration?tracking=INSTAGRAM_PROMO
```

#### 2. Verificação no localStorage
Abra o DevTools (F12) e execute no console:
```javascript
// Verificar código ativo
localStorage.getItem('registration_tracking_data')

// Limpar código (para testar novos)
localStorage.removeItem('registration_tracking_data')
```

#### 3. Teste de Registro
1. Acesse com um código de tracking na URL
2. Vá para a página de registro
3. Preencha e submeta o formulário
4. Verifique no banco se o tracking_code foi salvo

#### 4. Verificação no Banco de Dados
```sql
-- Ver registros com tracking_code
SELECT student_name, email, tracking_code, created_at 
FROM students 
WHERE tracking_code IS NOT NULL 
ORDER BY created_at DESC;
```

### Comportamento Esperado

- **Persistência**: Código permanece por 30 dias mesmo fechando o navegador
- **Prioridade**: `tracking` parameter tem prioridade sobre `utm_source`
- **Sanitização**: Apenas caracteres alfanuméricos, hífens e underscores
- **Limite**: Máximo 50 caracteres
- **Automático**: Não requer ação do usuário, funciona transparentemente

### Casos de Uso

1. **Campanhas de Marketing**: `?tracking=FACEBOOK_SUMMER_2024`
2. **Google Ads**: `?utm_source=GOOGLE_ADS_VESTIBULAR`
3. **Influenciadores**: `?tracking=INFLUENCER_JOAO`
4. **Email Marketing**: `?tracking=EMAIL_NEWSLETTER_JAN`

O sistema está pronto para uso em produção!