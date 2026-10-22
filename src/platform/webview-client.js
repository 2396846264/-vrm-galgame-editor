// Transport only: notifications and business actions belong to the caller.
export function createWebViewClient({
  webview = globalThis.window?.chrome?.webview,
  missingMessage = '请打开 Windows 程序使用编辑器',
  receive = () => false,
} = {}) {
  const pending = new Map();
  let counter = 0;
  let disposed = false;

  function message(event) {
    const data = event.data;
    if (receive(data) === true) return;
    const task = pending.get(data?.id);
    if (!task) return;
    pending.delete(data.id);
    data.ok ? task.resolve(data.data) : task.reject(new Error(data.error));
  }

  function request(action, payload = {}) {
    return new Promise((resolve, reject) => {
      if (!webview || disposed) return reject(new Error(missingMessage));
      const id = String(++counter);
      pending.set(id, { resolve, reject });
      try {
        webview.postMessage({ id, action, payload });
      } catch (error) {
        pending.delete(id);
        reject(error);
      }
    });
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    webview?.removeEventListener('message', message);
    globalThis.window?.removeEventListener('pagehide', dispose);
    for (const task of pending.values()) task.reject(new Error(missingMessage));
    pending.clear();
  }

  webview?.addEventListener('message', message);
  globalThis.window?.addEventListener('pagehide', dispose, { once: true });
  return { request, dispose };
}
