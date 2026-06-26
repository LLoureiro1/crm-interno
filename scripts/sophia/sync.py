"""
Sincronização de alunos SophiA.

Variáveis de ambiente:
  SOPHIA_API_BASE_URL  — ex: https://portal.sophia.com.br/SophiAWebAPI/9827/api/v1
  SOPHIA_PERIODO_ID    — ID do período letivo no SophiA (padrão: 11 = 2026)
"""

import os
import json
import urllib.request

REQUEST_TIMEOUT = 30

SOPHIA_BASE = os.getenv("SOPHIA_API_BASE_URL")
SOPHIA_PERIODO_ID = os.getenv("SOPHIA_PERIODO_ID", "11")
PAGE_SIZE = 200
MAX_PAGES = 200


def get_alunos(token, pagina=0, tamanho=PAGE_SIZE):
    url = f"{SOPHIA_BASE}/Alunos?Periodos={SOPHIA_PERIODO_ID}&pagina={pagina}&tamanho={tamanho}"

    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    return data


def _extract_rows(alunos_json):
    if isinstance(alunos_json, list):
        return alunos_json
    if isinstance(alunos_json, dict):
        for key in ("items", "data", "alunos", "Alunos", "resultado"):
            value = alunos_json.get(key)
            if isinstance(value, list):
                return value
    return []


def extrair_nome_codigo(alunos_json):
    resultado = []

    for aluno in _extract_rows(alunos_json):
        nome = aluno.get("nome") or aluno.get("Nome")
        codigo_externo = aluno.get("codigoExterno") or aluno.get("CodigoExterno")
        if nome is None or codigo_externo is None:
            continue
        resultado.append({
            "nome": nome,
            "codigoExterno": str(codigo_externo).strip(),
        })

    return resultado


def fetch_all_alunos(token):
    """Baixa a lista completa do período letivo (nome + codigoExterno)."""
    collected = []

    for pagina in range(MAX_PAGES):
        payload = get_alunos(token, pagina=pagina, tamanho=PAGE_SIZE)
        rows = _extract_rows(payload)
        collected.extend(extrair_nome_codigo(rows))

        if len(rows) < PAGE_SIZE:
            break

    return collected
