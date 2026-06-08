# Score de engajamento — evolução para ML

Este documento descreve como evoluir o score heurístico (`heuristic_v1`) para um modelo supervisionado treinado com outcomes reais do CRM.

## Dados coletados automaticamente

A tabela `engagement_feature_snapshots` registra:

- **Periódico (semanal):** alunos ainda ativos no funil
- **Terminal:** quando o status vira `matriculado` ou `desistente`, com `outcome_label`

Exportar dataset rotulado:

```sql
SELECT * FROM public.export_engagement_training_dataset(
  NULL,                    -- unit_id (NULL = todas)
  '2025-01-01'::timestamptz,
  now()
);
```

Labels: `matriculado = 1`, `desistente = 0`.

## Pipeline de retreino (manual / CI mensal)

1. Exportar CSV via Supabase SQL Editor ou script Python (`supabase-py`)
2. Treinar regressão logística ou LightGBM com features numéricas do JSON `features`
3. Validar AUC e precisão@20 (top 20 leads por unidade)
4. Inserir coeficientes em `engagement_model_versions` e marcar `is_active`
5. Atualizar função de score para usar versão ativa (fase futura)

## Guardrails

- Não publicar modelo se amostra terminal &lt; 100 por unidade
- Manter score heurístico em paralelo durante 1–2 ciclos
- Comparar ranking heurístico vs preditivo antes de trocar `engagement_score_source` para `'model'`

## Recalibração intermediária (sem ML)

Com snapshots acumulados, analisar taxa de matrícula por fator:

```sql
SELECT
  (features->>'auto_agendamento')::int AS auto_pts,
  outcome_label,
  COUNT(*) AS n
FROM engagement_feature_snapshots
WHERE outcome_label IS NOT NULL
GROUP BY 1, 2
ORDER BY 1, 2;
```

Ajustar pesos em `compute_student_engagement_score` somente após validação estatística.
