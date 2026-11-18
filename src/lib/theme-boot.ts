// Server-safe (no React): the storage keys, the defaults, and the script that applies the saved choice before first paint.
export const DEFAULT_THEME = "a";
export const DEFAULT_MODE = "system";
export const THEME_KEY = "MyJooba-theme";
export const MODE_KEY = "MyJooba-mode";
export const SIDEBAR_KEY = "MyJooba-sidebar";

/** Runs before first paint (inlined in <head>) so there is never a flash of the wrong theme. */
export const THEME_BOOT_SCRIPT = `(function(){var r=document.documentElement,t="${DEFAULT_THEME}",m="${DEFAULT_MODE}";try{var b=localStorage.getItem("${MODE_KEY}");if(b==="light"||b==="dark"||b==="system")m=b}catch(e){}var d=m==="dark"||(m==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=t;r.dataset.mode=d?"dark":"light";var s="expanded";try{if(localStorage.getItem("${SIDEBAR_KEY}")==="collapsed")s="collapsed"}catch(e){}r.dataset.sidebar=s})();`;
