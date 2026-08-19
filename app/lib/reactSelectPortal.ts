/**
 * Todos los `react-select` del proyecto usan `classNamePrefix="react-select"`.
 * Cuando además se les pasa `menuPortalTarget`, react-select agrega
 * automáticamente la clase `react-select__menu-portal` al contenedor
 * portalado del menú (ver `MenuPortal` en react-select). La usamos como
 * selector estable para distinguir "el usuario hizo clic dentro del menú
 * portalado de un select" de un clic realmente afuera del Dialog.
 *
 * Por qué hace falta: los `Dialog` (Radix) portalan su contenido, pero un
 * `react-select` con `menuPortalTarget={document.body}` portala su menú a
 * un nodo hermano del Dialog, fuera del árbol DOM de `DialogContent`. Radix
 * detecta eso como un "clic afuera" y cierra el diálogo antes de que
 * react-select registre la selección — rompiendo los diálogos anidados
 * (p. ej. crear gerente/cliente/país dentro de crear marca).
 */
export const REACT_SELECT_MENU_PORTAL_CLASS = "react-select__menu-portal";

export function isReactSelectPortalTarget(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    target.closest(`.${REACT_SELECT_MENU_PORTAL_CLASS}`) !== null
  );
}
