import { useState, useRef, useEffect, useCallback, createContext, useContext, cloneElement } from "react";

export const TooltipContext = createContext(null);

function FloatingTooltip({ visible, content, x, y, place }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      const t = setTimeout(() => setShow(true), 10);
      return () => clearTimeout(t);
    } else {
      setShow(false);
    }
  }, [visible]);

  if (!visible && !show) return null;

  const off = 14;
  const posStyle = {
    top:    { position: "fixed", left: x, top: y - off,   transform: "translateX(-50%)" },
    bottom: { position: "fixed", left: x, top: y + off,   transform: "translateX(-50%)" },
    left:   { position: "fixed", left: x - off, top: y,   transform: "translate(-100%, -50%)" },
    right:  { position: "fixed", left: x + off, top: y,   transform: "translateY(-50%)" },
  }[place] || {};

  const isRich = typeof content !== "string";

  return (
    <div
      style={{ ...posStyle, zIndex: 9999, pointerEvents: "none", opacity: show && visible ? 1 : 0, transition: "opacity 0.15s ease" }}
    >
      <div
        className={[
          "bg-[#1c1c26] text-[#eeeef4] border border-[#35354a] rounded-lg shadow-2xl",
          isRich
            ? "px-3.5 py-3 font-sans text-sm whitespace-normal max-w-[220px]"
            : "px-3 py-1.5 font-mono text-xs whitespace-nowrap",
        ].join(" ")}
      >
        {content}
      </div>
    </div>
  );
}

/**
 * Envolva sua aplicação com <TooltipProvider> para habilitar tooltips.
 */
export function TooltipProvider({ children }) {
  const [state, setState] = useState({ visible: false, content: null, x: 0, y: 0, place: "top" });
  const timer = useRef(null);

  const show = useCallback((content, x, y, place, delay = 0) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState({ visible: true, content, x, y, place }), delay);
  }, []);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    setState(s => ({ ...s, visible: false }));
  }, []);

  return (
    <TooltipContext.Provider value={{ show, hide }}>
      {children}
      <FloatingTooltip {...state} />
    </TooltipContext.Provider>
  );
}

/**
 * Envolva qualquer elemento com <Tip> para adicionar tooltip.
 *
 * Props:
 *   content  — string ou JSX
 *   place    — "top" | "bottom" | "left" | "right"  (padrão: "top")
 *   delay    — delay em ms antes de exibir           (padrão: 0)
 */
export function Tip({ children, content, place = "top", delay = 0 }) {
  const { show, hide } = useContext(TooltipContext);
  const ref = useRef(null);

  const getXY = () => {
    const r = ref.current.getBoundingClientRect();
    if (place === "top")    return [r.left + r.width / 2, r.top];
    if (place === "bottom") return [r.left + r.width / 2, r.bottom];
    if (place === "left")   return [r.left, r.top + r.height / 2];
    if (place === "right")  return [r.right, r.top + r.height / 2];
  };

  return cloneElement(children, {
    ref,
    onMouseEnter(e) {
      const [x, y] = getXY();
      show(content, x, y, place, delay);
      children.props.onMouseEnter?.(e);
    },
    onMouseLeave(e) {
      hide();
      children.props.onMouseLeave?.(e);
    },
  });
}
