// A forbidden operation is not an expired session. Recheck membership so a
// disabled user still loses access, while an active user keeps their session.
export async function checkPermissionError(
  error: { status?: number },
  isActiveMember: () => Promise<boolean>,
  baseCheckError: () => Promise<unknown>,
) {
  if (error.status === 403 && (await isActiveMember())) return;
  await baseCheckError();
}
