declare global {
  interface Window {
    cv?: unknown;
    __docToolkitOpenCVPromise?: Promise<unknown | null>;
  }
}

export async function loadOpenCV() {
  if (typeof window === "undefined") return null;
  if (window.cv) return window.cv;

  if (!window.__docToolkitOpenCVPromise) {
    window.__docToolkitOpenCVPromise = new Promise((resolve) => {
      const existingScript = document.querySelector<HTMLScriptElement>('script[src="/opencv.js"]');

      const resolveWhenReady = () => {
        const startedAt = Date.now();
        const tick = () => {
          if (window.cv) {
            resolve(window.cv);
            return;
          }
          if (Date.now() - startedAt > 6000) {
            resolve(null);
            return;
          }
          window.setTimeout(tick, 80);
        };
        tick();
      };

      if (existingScript) {
        existingScript.addEventListener("load", resolveWhenReady, { once: true });
        existingScript.addEventListener("error", () => resolve(null), { once: true });
        resolveWhenReady();
        return;
      }

      const script = document.createElement("script");
      script.src = "/opencv.js";
      script.async = true;
      script.onload = resolveWhenReady;
      script.onerror = () => resolve(null);
      document.body.appendChild(script);
    });
  }

  return window.__docToolkitOpenCVPromise;
}
