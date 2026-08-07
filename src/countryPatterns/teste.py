import json

def converter_paises(input_file, output_file):
    try:
        # Carregar os dados de countries_id.json
        with open(input_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        resultado = []

        for item in data:
            # Extrair o nome comum e o nome oficial
            name = item.get('name', {}).get('common', '')
            official_name = item.get('name', {}).get('official', '')
            
            # Extrair o primeiro nativeName disponível (comportamento padrão do r1)
            native_names = item.get('name', {}).get('nativeName', {})
            native_name = ""
            if native_names:
                # Pega o 'common' do primeiro idioma da lista de nomes nativos
                first_lang = list(native_names.values())[0]
                native_name = first_lang.get('common', '')

            # Montar o novo objeto no formato countryPatterns_r1 + cca3
            novo_formato = {
                "name": name,
                "officialName": official_name,
                "nativeName": native_name,
                "cca3": item.get('cca3', '')
            }
            resultado.append(novo_formato)

        # Salvar o novo arquivo JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(resultado, f, ensure_ascii=False, indent=2)
            
        print(f"Sucesso! Arquivo '{output_file}' gerado com {len(resultado)} países.")

    except Exception as e:
        print(f"Erro ao processar os arquivos: {e}")

# Execução
converter_paises(fr'C:\Users\Guilherme\OneDrive\Backup\App RBS\sistema-revisao-bibliografica\src\Nova pasta\countries_id.json', fr'C:\Users\Guilherme\OneDrive\Backup\App RBS\sistema-revisao-bibliografica\src\Nova pasta\countryPatterns_v2.json')