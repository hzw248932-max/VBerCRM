import { Link } from "react-router";
import { Translate, useAuthProvider, useRedirect, useTranslate } from "ra-core";
import type { AuthRedirectResult } from "ra-core";
import { useEffect, useRef, useState } from "react";
import { CircleAlert, LockIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/admin/loading";

/**
 * A standalone page to be used as a redirection target for external authentication services (e.g. OAuth)
 *
 * It displays a loading indicator while processing the authentication response,
 * then redirects to the admin app or shows an error message if authentication fails.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/security/ Security documentation}
 *
 * @example
 * import { Admin } from "@/components/admin";
 * import MyAuthCallbackPage from './MyAuthCallbackPage';
 * const App = () => (
 *     <Admin authCallbackPage={MyAuthCallbackPage} authProvider={authProvider}>
 *         ...
 *     </Admin>
 * );
 */
export const AuthCallback = () => {
  const authProvider = useAuthProvider();
  const redirect = useRedirect();
  const [error, setError] = useState<Error | null>(null);
  // Auth callbacks are one-time operations, not offline-cacheable queries.
  // In particular, restored mobile query data must never choose this redirect.
  const pending = useRef<Promise<AuthRedirectResult | void> | null>(null);
  useEffect(() => {
    let active = true;
    if (!pending.current) {
      pending.current = Promise.resolve().then(() => {
        if (!authProvider?.handleCallback) {
          throw new Error("ra.message.auth_error");
        }
        return authProvider.handleCallback({});
      });
    }
    pending.current.then(
      (result) => {
        if (active && result?.redirectTo !== false) {
          redirect(result?.redirectTo ?? "/");
        }
      },
      (cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause : new Error("ra.message.auth_error"),
          );
      },
    );
    return () => {
      active = false;
    };
  }, [authProvider, redirect]);
  if (error) {
    return (
      <AuthError
        message={(error as Error) ? (error as Error).message : undefined}
      />
    );
  }
  return <Loading />;
};

export interface AuthErrorProps {
  className?: string;
  title?: string;
  message?: string;
}

/**
 * Authentication error page displayed when authentication fails.
 *
 * @see {@link https://marmelab.com/shadcn-admin-kit/docs/security/ Security documentation}
 *
 * @example
 * import { Admin } from "@/components/admin";
 * import MyAuthErrorPage from './MyAuthErrorPage';
 * const App = () => (
 *   <Admin authenticationError={MyAuthErrorPage} authProvider={authProvider}>
 *     ...
 *   </Admin>
 * );
 */
export const AuthError = (props: AuthErrorProps) => {
  const {
    className,
    title = "ra.page.error",
    message = "ra.message.auth_error",
    ...rest
  } = props;

  const translate = useTranslate();
  return (
    <div
      className={cn(
        "flex flex-col justify-center items-center h-full",
        className,
      )}
      {...rest}
    >
      <h1 className="flex items-center text-3xl my-5 gap-3" role="alert">
        <CircleAlert className="w-2em h-2em" />
        <Translate i18nKey={title} />
      </h1>
      <p className="my-5">{translate(message, { _: message })}</p>
      <Button asChild>
        <Link to="/login">
          <LockIcon /> {translate("ra.auth.sign_in", { _: "Sign in" })}
        </Link>
      </Button>
    </div>
  );
};
