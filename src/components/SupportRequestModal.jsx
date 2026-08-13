import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from 'react-i18next';
import { Heart, X } from "lucide-react";

export function SupportRequestModal({
  message = null,
  openSupportLabel = null,
  autoCloseMs = 10000,
  onOpenSupport,
  onDismiss,
  onClose,
}) {
  const { t } = useTranslation();
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const remainingRef = useRef(autoCloseMs);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);

  const close = useCallback((action) => {
    setExiting(true);
    setTimeout(() => {
      if (action === "dismiss") onDismiss?.();
      onClose?.();
    }, 250);
  }, [onClose, onDismiss]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (startTimeRef.current != null) {
      remainingRef.current -= Date.now() - startTimeRef.current;
      startTimeRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    stopTimer();
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(close, Math.max(remainingRef.current, 0));
  }, [close, stopTimer]);

  useEffect(() => {
    startTimer();
    return () => stopTimer();
  }, [startTimer, stopTimer]);

  const handleMouseEnter = () => {
    setPaused(true);
    stopTimer();
  };

  const handleMouseLeave = () => {
    setPaused(false);
    startTimer();
  };

  return (
    <>
      <style>{`
        @keyframes srm-in       { from { opacity:0; transform:translateX(10px) scale(0.97); } to { opacity:1; transform:translateX(0) scale(1); } }
        @keyframes srm-out      { from { opacity:1; transform:translateX(0) scale(1); } to { opacity:0; transform:translateX(10px) scale(0.97); } }
        @keyframes srm-progress { from { width: 100%; } to { width: 0%; } }
        .srm-enter { animation: srm-in  0.25s cubic-bezier(0.22,1,0.36,1) forwards; }
        .srm-exit  { animation: srm-out 0.25s cubic-bezier(0.55,0,0.45,1) forwards; }
      `}</style>

      <div
        className={`fixed top-6 right-6 z-50 w-80 rounded-xl shadow-lg border overflow-hidden
          bg-white dark:bg-gray-800
          border-indigo-300 dark:border-indigo-600
          ${exiting ? "srm-exit" : "srm-enter"}`}
        role="alertdialog"
        aria-labelledby="srm-title"
        aria-describedby="srm-desc"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header */}
        <div className="flex items-start gap-3 p-4 pb-3">
          <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
            <Heart className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p id="srm-title" className="text-sm font-semibold text-gray-800 dark:text-white leading-snug">
              {t('modals.supportRequest.title')}
            </p>
            <p id="srm-desc" className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
              {message ?? t('modals.supportRequest.message')}
            </p>
          </div>

          <button
            onClick={() => close("dismiss")}
            aria-label={t('modals.closeNotice')}
            className="flex-shrink-0 p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:text-gray-300 dark:hover:bg-gray-700 transition-colors duration-150"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-100 dark:border-gray-700 mx-4" />

        {/* Actions */}
        <div className="p-3">
          <button
            onClick={onOpenSupport}
            className="w-full px-3 py-1.5 text-xs font-medium rounded-lg flex items-center justify-center gap-1.5
              bg-indigo-600 hover:bg-indigo-700 text-white
              dark:bg-indigo-500 dark:hover:bg-indigo-600
              transition-colors duration-150"
          >
            <Heart className="h-3.5 w-3.5" />
            {openSupportLabel ?? t('modals.supportRequest.openSupportLabel')}
          </button>
        </div>

        {/* Timeout bar */}
        <div className="h-1 bg-gray-100 dark:bg-gray-700">
          <div
            className="h-full bg-indigo-500 dark:bg-indigo-400"
            style={{
              animation: `srm-progress ${autoCloseMs}ms linear forwards`,
              animationPlayState: paused ? 'paused' : 'running',
            }}
          />
        </div>
      </div>
    </>
  );
}
