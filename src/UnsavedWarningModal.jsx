import { useState, useEffect, useRef, useCallback } from "react";
import { Clock, X, Download } from "lucide-react";

const CHECK_INTERVAL_MS = 30 * 1000;

function formatTimeSince(date) {
  if (!date) return null;
  const diffMin = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diffMin < 1) return "menos de 1 minuto";
  if (diffMin === 1) return "1 minuto";
  return `${diffMin} minutos`;
}

export function UnsavedWarningModal({ lastSaved, hasUnsavedChanges = false, fileOpenedAt = null, warnAfterMin=10,  onSave, onDismiss }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const dismissedAtRef = useRef(null);

  const warnAfterMs = warnAfterMin * 60 * 1000;


  const close = useCallback((action) => {
    setExiting(true);
    setTimeout(() => {
      setExiting(false);
      setVisible(false);
      if (action === "dismiss") {
        dismissedAtRef.current = Date.now();
        onDismiss?.();
      }
    }, 250);
  }, [onDismiss]);

  const handleSave = useCallback(() => {
    close("save");
    onSave?.();
  }, [close, onSave]);

  useEffect(() => {
    if (!hasUnsavedChanges) {
      dismissedAtRef.current = null;
    }
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const check = () => {
      if (!hasUnsavedChanges || !lastSaved) { setVisible(false); return; }

      // Não exibe se o arquivo foi aberto há menos de 10 minutos
      if (fileOpenedAt && Date.now() - fileOpenedAt < warnAfterMs) { setVisible(false); return; }

      const elapsed = Date.now() - new Date(lastSaved).getTime();
      const dismissedRecently = dismissedAtRef.current &&
        Date.now() - dismissedAtRef.current < warnAfterMs;

      if (elapsed >= warnAfterMs && !dismissedRecently) setVisible(true);
      else setVisible(false);
    };
    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasUnsavedChanges, lastSaved, fileOpenedAt]);

  if (!visible) return null;

  return (
    <>
      <style>{`
        @keyframes uwm-in  { from { opacity:0; transform:translateY(10px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
        @keyframes uwm-out { from { opacity:1; transform:translateY(0) scale(1); } to { opacity:0; transform:translateY(10px) scale(0.97); } }
        .uwm-enter { animation: uwm-in  0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
        .uwm-exit  { animation: uwm-out 0.25s cubic-bezier(0.55,0,0.45,1) forwards; }
      `}</style>

      <div
        className={`fixed bottom-6 right-6 z-50 w-80 rounded-xl shadow-lg border
          bg-white dark:bg-gray-800
          border-amber-300 dark:border-amber-600
          ${exiting ? "uwm-exit" : "uwm-enter"}`}
        role="alertdialog"
        aria-labelledby="uwm-title"
        aria-describedby="uwm-desc"
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p id="uwm-title" className="text-sm font-semibold text-gray-800 dark:text-white leading-snug">
              Alterações não salvas
            </p>
            <p id="uwm-desc" className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              Último salvamento há{" "}
              <span className="font-medium text-amber-600 dark:text-amber-400">
                {formatTimeSince(lastSaved)}
              </span>
              . Salve para não perder o progresso.
            </p>
          </div>

          <button
            onClick={() => close("dismiss")}
            aria-label="Fechar aviso"
            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-gray-700 mx-4" />

        {/* Actions */}
        <div className="flex gap-2 p-3">
          <button
            onClick={() => close("dismiss")}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg
              bg-gray-100 hover:bg-gray-200 text-gray-700
              dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300
              transition-colors duration-150"
          >
            Lembrar depois
          </button>
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5
              bg-indigo-600 hover:bg-indigo-700 text-white
              dark:bg-indigo-500 dark:hover:bg-indigo-600
              transition-colors duration-150"
          >
            <Download className="h-3.5 w-3.5" />
            Salvar agora
          </button>
        </div>
      </div>
    </>
  );
}