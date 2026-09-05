/** Grace period before an object URL is revoked, so the browser can start reading it. */
const DOWNLOAD_REVOKE_DELAY_MS = 1000;

export async function downloadBytes(data: Uint8Array, filename = 'document.pdf'): Promise<void> {
  const blob = new Blob([data.slice().buffer as ArrayBuffer], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_REVOKE_DELAY_MS);
}

export async function printBytes(data: Uint8Array): Promise<void> {
  const blob = new Blob([data as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.left = '-9999px';
  iframe.style.top = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.src = url;
  document.body.appendChild(iframe);
  try {
    await new Promise<void>((resolve) => {
      let settled = false;
      const done = () => {
        if (!settled) {
          settled = true;
          resolve();
        }
      };
      iframe.onload = done;
      setTimeout(done, 2000);
    });
    const win = iframe.contentWindow as Window | null;
    win?.focus?.();
    win?.print();
  } finally {
    // Keep iframe alive while native print dialog is open, then clean up.
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
      URL.revokeObjectURL(url);
    }, 1500);
  }
}
