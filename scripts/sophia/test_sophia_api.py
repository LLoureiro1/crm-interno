"""
Teste local da API SophiA (mesmo fluxo da Edge Function sophia-api).

Defina no ambiente:
  SOPHIA_API_BASE_URL  — ex: https://portal.sophia.com.br/SophiAWebAPI/9827/api/v1
  SOPHIA_API_USUARIO
  SOPHIA_API_SENHA

Uso (PowerShell):
  $env:SOPHIA_API_BASE_URL="https://..."
  $env:SOPHIA_API_USUARIO="..."
  $env:SOPHIA_API_SENHA="..."
  python scripts/sophia/test_sophia_api.py
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
)


def require_env(name: str) -> str:
    v = os.environ.get(name, "").strip()
    if not v:
        print(f"Variável de ambiente obrigatória ausente: {name}", file=sys.stderr)
        sys.exit(1)
    return v


def main() -> None:
    base = require_env("SOPHIA_API_BASE_URL").rstrip("/")
    usuario = require_env("SOPHIA_API_USUARIO")
    senha = require_env("SOPHIA_API_SENHA")

    auth_url = f"{base}/Autenticacao"
    cursos_url = f"{base}/Cursos"

    print("--- API SophiA — listagem de cursos (teste local) ---")

    data = json.dumps({"usuario": usuario, "senha": senha}).encode("utf-8")
    req = urllib.request.Request(auth_url, data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", USER_AGENT)

    try:
        with urllib.request.urlopen(req) as response:
            token = response.read().decode("utf-8").strip().strip('"')

        req_cursos = urllib.request.Request(cursos_url, method="GET")
        req_cursos.add_header("token", token)
        req_cursos.add_header("Content-Type", "application/json")
        req_cursos.add_header("User-Agent", USER_AGENT)

        with urllib.request.urlopen(req_cursos) as res_cursos:
            raw = res_cursos.read().decode("utf-8")
            cursos = json.loads(raw)

        if cursos and isinstance(cursos, list):
            print(f"Total de registros: {len(cursos)}")
            print("Primeiro item:")
            print(json.dumps(cursos[0], indent=2, ensure_ascii=False))
        else:
            print(f"Retorno: {cursos!r}")

    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode('utf-8', errors='replace')}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Erro: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
