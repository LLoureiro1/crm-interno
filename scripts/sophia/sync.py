import os
import json
import urllib.request

REQUEST_TIMEOUT = 30

SOPHIA_BASE = os.getenv("SOPHIA_API_BASE_URL")


def get_alunos(token, pagina=0, tamanho=100):
    url = f"{SOPHIA_BASE}/Alunos?pagina={pagina}&tamanho={tamanho}"

    req = urllib.request.Request(url)
    req.add_header("Authorization", f"Bearer {token}")
    req.add_header("Content-Type", "application/json")

    with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT) as resp:
        data = json.loads(resp.read().decode("utf-8"))

    return data


def extrair_nome_codigo(alunos_json):
    resultado = []

    for aluno in alunos_json:
        nome = aluno.get("nome")
        codigo_externo = aluno.get("codigoExterno")

        resultado.append({
            "nome": nome,
            "codigoExterno": codigo_externo
        })

    return resultado