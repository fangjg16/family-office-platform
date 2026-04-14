/** 检测当前环境是否可创建 WebGL（Cursor 内置预览、远程桌面等常为 Disabled / Sandboxed） */
export function isWebGLAvailable(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      canvas.getContext("webgl") ||
      canvas.getContext("webgl2") ||
      canvas.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}
