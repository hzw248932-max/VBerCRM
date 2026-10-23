// Only a successful count of zero proves that first-user setup is needed.
export function resolveInitialization(data: unknown, error: unknown): boolean {
  if (error) throw new Error("无法连接 CRM，请检查网络和服务配置后重试。");
  const count =
    Array.isArray(data) && data.length === 1
      ? data[0]?.is_initialized
      : undefined;
  if (
    (typeof count !== "number" && typeof count !== "string") ||
    String(count).trim() === "" ||
    !Number.isSafeInteger(Number(count)) ||
    Number(count) < 0
  )
    throw new Error("无法确认 CRM 初始化状态，请重试。");
  return Number(count) > 0;
}
