"use client";

import { useEffect, useState } from "react";

/**
 * Focus mode: marks the document so the shell hides its sidebar.
 *
 * The attribute goes on `<html>` rather than state lifted into the shell,
 * because the sidebar lives in the root layout — above every route — and
 * threading a flag up through it would couple the shell to whichever page
 * happens to want more room. `globals.css` reacts to the attribute; the page
 * only has to set it.
 *
 * Shared by the lesson reader and the note page, which both want exactly this.
 */
export function useFocusMode() {
  const [focus, setFocus] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (focus) root.setAttribute("data-focus", "");
    else root.removeAttribute("data-focus");
    return () => root.removeAttribute("data-focus");
  }, [focus]);

  return { focus, toggle: () => setFocus((v) => !v) };
}
