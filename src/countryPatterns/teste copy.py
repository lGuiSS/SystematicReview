"""
add_ccn3.py
Enriquece o countryPatterns_v1.json com o campo ccn3 (código numérico UN M.49).

Dependências:
    pip install pycountry

Uso:
    python add_ccn3.py
    python add_ccn3.py --input meu_arquivo.json --output saida.json

Saída:
    countryPatterns_v2.json  (mesmo arquivo + campo ccn3 em cada entrada)

Notas:
    - ccn3 é o código numérico ISO 3166-1 (= UN M.49 para países soberanos)
    - É o mesmo ID usado pelo topojson/world-atlas e pelas bibliotecas
      pycountry (numeric), country-converter (ISOnumeric), countrycode (iso3n)
    - Países sem correspondência em pycountry recebem ccn3: null e são listados
      ao final para revisão manual
"""

import json
import argparse
import pycountry

# ── Mapeamentos manuais para territórios/regiões não presentes no pycountry ──
# # Adicione aqui entradas que o script reportar como não encontradas
MANUAL_CCN3 = {
    "UNK": None,   # Kosovo — sem código ISO oficial
}


def get_ccn3(cca3: str) -> str | None:
    """Retorna o código numérico M.49 para um ISO alpha-3, ou None."""
    if cca3 in MANUAL_CCN3:
        return MANUAL_CCN3[cca3]
    country = pycountry.countries.get(alpha_3=cca3)
    if country and hasattr(country, "numeric"):
        # pycountry retorna string com zero-padding, ex: "076" para Brasil
        return country.numeric
    return None


def main():
    parser = argparse.ArgumentParser(description="Adiciona ccn3 ao countryPatterns JSON")
    parser.add_argument("--input",  default=fr"C:\Users\Guilherme\OneDrive\Backup\App RBS\sistema-revisao-bibliografica\src\countryPatterns\countryPatterns_v1.json")
    parser.add_argument("--output", default=fr"C:\Users\Guilherme\OneDrive\Backup\App RBS\sistema-revisao-bibliografica\src\countryPatterns\countryPatterns_v2.json")
    args = parser.parse_args()

    with open(args.input, encoding="utf-8") as f:
        data = json.load(f)

    not_found = []

    for entry in data:
        cca3 = entry.get("cca3", "")
        ccn3 = get_ccn3(cca3)
        entry["ccn3"] = ccn3  # insere após cca3 (Python 3.7+ preserva ordem)
        if ccn3 is None:
            not_found.append(f"  {cca3:6s}  {entry.get('name', '')}")

    # Reordena campos: name, officialName, nativeName, cca3, ccn3
    ordered = []
    for entry in data:
        ordered.append({
            "name":         entry.get("name"),
            "officialName": entry.get("officialName"),
            "nativeName":   entry.get("nativeName"),
            "cca3":         entry.get("cca3"),
            "ccn3":         entry.get("ccn3"),
        })

    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(ordered, f, ensure_ascii=False, indent=2)

    total = len(data)
    found = total - len(not_found)
    print(f"✓ {found}/{total} países com ccn3 ({len(not_found)} sem correspondência)")
    print(f"✓ Salvo em: {args.output}")

    if not_found:
        print(f"\n⚠  Sem ccn3 ({len(not_found)}) — revise MANUAL_CCN3 se necessário:")
        for line in not_found:
            print(line)


if __name__ == "__main__":
    main()