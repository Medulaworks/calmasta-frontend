// Server-safe (no React): the storage keys, the defaults, and the script that applies the saved choice before first paint.
export const DEFAULT_THEME = "a";
export const DEFAULT_MODE = "system";
export const THEME_KEY = "mojooba-theme";
export const MODE_KEY = "mojooba-mode";
export const SIDEBAR_KEY = "mojooba-sidebar";

/** Runs before first paint (inlined in <head>) so there is never a flash of the wrong theme. */
export const THEME_BOOT_SCRIPT = `(function(){var r=document.documentElement,t="${DEFAULT_THEME}",m="${DEFAULT_MODE}";try{var a=localStorage.getItem("${THEME_KEY}"),b=localStorage.getItem("${MODE_KEY}");if(/^[abdef]$/.test(a))t=a;if(b==="light"||b==="dark"||b==="system")m=b}catch(e){}var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=t;r.dataset.mode=d?"dark":"light";var s="expanded";try{if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")s="collapsed"}catch(e){}r.dataset.sidebar=s})();`;
