import { useState } from "react";
import { X, Bell } from "lucide-react";

const PRESET_OPTIONS = [5, 10, 15, 30];

export function ReminderSettingsModal({ currentMinutes = 10, onConfirm, onClose }) {
  const isPreset = PRESET_OPTIONS.includes(currentMinutes);
  const [selected, setSelected] = useState(isPreset ? currentMinutes : null);
  const [custom, setCustom] = useState(isPreset ? "" : String(currentMinutes));

  const effectiveValue = custom ? Number(custom) : selected;
  const isValid = effectiveValue >= 1 && effectiveValue <= 60;

  const handlePreset = (min) => {
    setSelected(min);
    setCustom("");
  };

  const handleCustomChange = (e) => {
    const val = e.target.value.replace(/\D/g, "");
    setCustom(val);
    setSelected(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50">
      <div className="w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            <p className="text-sm font-semibold text-gray-800 dark:text-white">
              Lembrete de salvamento
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
        <div className="p-4 space-y-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Avisar após quanto tempo sem salvar:
          </p>

          {/* Presets */}
          <div className="grid grid-cols-4 gap-2">
            {PRESET_OPTIONS.map((min) => (
              <button
                key={min}
                onClick={() => handlePreset(min)}
                className={`py-2 rounded-lg text-xs font-medium border transition-colors duration-150
                  ${selected === min
                    ? "bg-indigo-600 dark:bg-indigo-500 text-white border-indigo-600 dark:border-indigo-500"
                    : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
              >
                {min} min
              </button>
            ))}
          </div>

          {/* Custom input */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">
              Ou defina um valor personalizado:
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={60}
                value={custom}
                onChange={handleCustomChange}
                placeholder="ex: 20"
                className={`flex-1 px-3 py-1.5 text-xs rounded-lg border transition-colors
                  bg-white dark:bg-gray-700 text-gray-800 dark:text-white
                  placeholder-gray-400 dark:placeholder-gray-500
                  focus:outline-none focus:ring-2 focus:ring-indigo-500
                  ${custom && !isValid
                    ? "border-red-400 dark:border-red-500"
                    : "border-gray-200 dark:border-gray-600"
                  }`}
              />
              <span className="text-xs text-gray-500 dark:text-gray-400">min</span>
            </div>
            {custom && !isValid && (
              <p className="text-xs text-red-500 dark:text-red-400 mt-1">
                Digite um valor entre 1 e 60 minutos.
              </p>
            )}
          </div>

          {/* Preview */}
          {isValid && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg px-3 py-2">
              Você será avisado após <strong>{effectiveValue} minuto{effectiveValue > 1 ? "s" : ""}</strong> sem salvar.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg
              bg-gray-100 hover:bg-gray-200 text-gray-700
              dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-300
              transition-colors duration-150"
          >
            Cancelar
          </button>
          <button
            disabled={!isValid}
            onClick={() => isValid && onConfirm(effectiveValue)}
            className="flex-1 px-3 py-1.5 text-xs font-medium rounded-lg
              bg-indigo-600 hover:bg-indigo-700 text-white
              dark:bg-indigo-500 dark:hover:bg-indigo-600
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-colors duration-150"
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}
