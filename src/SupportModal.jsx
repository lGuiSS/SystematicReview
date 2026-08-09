import { useState } from "react";
import { X, Heart, Copy, Check } from "lucide-react";
import QRCode from "react-qr-code";
// npm install react-qr-code

/**
 * ------------------------------------------------------------------
 * Configuração da chave Pix
 * ------------------------------------------------------------------
 * Recomendado: use uma chave "aleatória" (tipo EVP), não CPF/e-mail/
 * telefone. Ela não expõe nenhum dado pessoal e pode ser revogada e
 * trocada no app do seu banco sem precisar alterar nada aqui além
 * desta constante.
 */
const PIX_KEY = "000000-000000-000000-000000-000000"; // sua chave aleatória (EVP)
const MERCHANT_NAME = "Projeto";   // até 25 caracteres, sem acentos, maiúsculo
const MERCHANT_CITY = "Cidade";            // até 15 caracteres, sem acentos, maiúsculo
const DESCRIPTION = "Apoio ao projeto";    // opcional, aparece no app do pagador
const AMOUNT = 5;
/**
 * ------------------------------------------------------------------
 * Geração do payload Pix (BR Code / EMV), 100% local
 * ------------------------------------------------------------------
 * Monta o "copia e cola" a partir da chave acima e calcula o CRC16
 * exigido pelo padrão do Bacen. Nada disso sai do navegador do
 * usuário nem depende de serviço externo.
 */
function tlv(id, value) {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function crc16(payload) {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) : (crc << 1);
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function buildPixPayload({ key, name, city, description, amount }) {
  const merchantAccountInfo =
    tlv("00", "br.gov.bcb.pix") + tlv("01", key) +
    (description ? tlv("02", description) : "");

  const payloadWithoutCrc =
    tlv("00", "01") +                          // Payload Format Indicator
    tlv("26", merchantAccountInfo) +           // Merchant Account Info (Pix)
    tlv("52", "0000") +                        // Merchant Category Code
    tlv("53", "986") +                         // Currency: BRL
    (amount ? tlv("54", amount.toFixed(2)) : "") + // Transaction Amount (opcional)
    tlv("58", "BR") +                          // Country
    tlv("59", name.slice(0, 25)) +             // Merchant Name
    tlv("60", city.slice(0, 15)) +             // Merchant City
    tlv("62", tlv("05", "***")) +              // Additional Data (txid = ***, avulso)
    "6304";                                    // CRC id + tamanho fixo
  return payloadWithoutCrc + crc16(payloadWithoutCrc);
}

export function SupportModal({ onConfirm, onClose }) {
  const [copied, setCopied] = useState(false);
  
  const pixPayload = buildPixPayload({
    key: PIX_KEY,
    name: MERCHANT_NAME,
    city: MERCHANT_CITY,
    description: DESCRIPTION,
    amount: AMOUNT
  });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(pixPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard indisponível — usuário ainda pode selecionar o texto manualmente
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50">
      <div className="w-80 sm:w-[26rem] md:w-[30rem] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2 sm:gap-3">
            <Heart className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
            <p className="text-sm sm:text-base font-semibold text-gray-800 dark:text-white">
              Apoie o projeto
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
          <p className="text-xs sm:text-sm text-gray-800 dark:text-gray-400">
            Este projeto é desenvolvido nas horas livres e sem fins lucrativos. 
            Caso ele tem te ajudado, considere fazer uma doação. 
            Qualquer valor faz a diferença e ajuda a manter as melhorias em andamento.
            {/* Atualizações continuam graças a quem usa e acredita nele.  */}
          </p>

          {/* QR Code */}
          <div className="flex justify-center bg-white p-3 rounded-lg border border-gray-200 dark:border-gray-600">
            <QRCode
              value={pixPayload}
              size={160}
              fgColor="#1f2937"
              bgColor="#ffffff"
            />
          </div>

          {/* Copia e cola */}
          <div>
            <label className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mb-1.5 sm:mb-2 block">
              Ou use o Pix copia e cola:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={pixPayload}
                onFocus={(e) => e.target.select()}
                className="flex-1 px-3 py-1.5 text-xs sm:text-sm rounded-lg border truncate
                  bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300
                  border-gray-200 dark:border-gray-600 focus:outline-none"
              />
              <button
                onClick={handleCopy}
                className="p-1.5 rounded-lg border border-gray-200 dark:border-gray-600
                  bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600
                  text-gray-600 dark:text-gray-300 transition-colors"
                title="Copiar chave"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 sm:gap-3 px-4 sm:px-6 pb-4 sm:pb-6">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg
              bg-gray-100 hover:bg-gray-200 text-gray-700
              dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300
              transition-colors duration-150"
          >
            Agora não
          </button>
          <button
            onClick={() => onConfirm?.()}
            className="flex-1 px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg
              bg-indigo-600 hover:bg-indigo-700 text-white
              dark:bg-indigo-500 dark:hover:bg-indigo-600
              transition-colors duration-150"
          >
            Já apoiei ❤️
          </button>
        </div>
      </div>
    </div>
  );
}
