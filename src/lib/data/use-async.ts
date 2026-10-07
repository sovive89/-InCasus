import { useCallback, useEffect, useState } from "react";

export type AsyncState<T> =
  { status: "loading" } | { status: "error"; message: string } | { status: "ready"; data: T };

/** Carrega dados no navegador (precisa do login) e permite recarregar depois de salvar. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ status: "loading" });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);
  const reload = useCallback(() => {
    run()
      .then((data) => setState({ status: "ready", data }))
      .catch(() => setState({ status: "error", message: "Não foi possível carregar agora." }));
  }, [run]);
  useEffect(() => {
    setState({ status: "loading" });
    reload();
  }, [reload]);
  return { state, reload };
}
