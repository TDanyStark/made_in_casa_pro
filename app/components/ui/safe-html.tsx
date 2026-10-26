"use client";

import { useSyncExternalStore } from "react";
import DOMPurify from "dompurify";

// Etiquetas que produce el editor tiptap y que se pueden mostrar sin riesgo.
const ALLOWED_TAGS = [
  "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "ul", "ol", "li",
  "b", "strong", "i", "em", "u", "s",
  "a", "code", "pre", "blockquote", "br", "hr",
];
const ALLOWED_ATTR = ["href"];
// http(s), mailto, anclas (#...) y rutas relativas al sitio (/...). Se excluyen
// "//" y "/\" porque el navegador los trata como URL de otro dominio.
// DOMPurify quita los espacios/controles antes de probar la expresión.
const ALLOWED_URI_REGEXP = /^(?:https?:|mailto:|#|\/(?![/\\]))/i;

let hookInstalled = false;

function ensureLinkHook() {
  if (hookInstalled) return;
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
  hookInstalled = true;
}

/**
 * Sanitiza HTML de usuario (notas tiptap) con una allowlist estricta.
 * Sin DOM disponible (servidor) devuelve "" para no emitir HTML sin sanitizar.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html || !DOMPurify.isSupported) return "";
  ensureLinkHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP,
  });
}

const noopSubscribe = () => () => {};

interface SafeHtmlProps {
  html: string | null | undefined;
  className?: string;
}

/** Renderiza HTML de usuario sanitizado. Usar siempre en lugar de dangerouslySetInnerHTML. */
export function SafeHtml({ html, className }: SafeHtmlProps) {
  // En SSR/hidratación se renderiza vacío y el contenido se sanitiza en el cliente.
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: isClient ? sanitizeHtml(html) : "" }}
    />
  );
}
