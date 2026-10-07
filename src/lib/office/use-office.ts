import { useEffect, useState } from "react";
import { getMyOffice } from "./office.functions";

/** Id do escritório do advogado logado (null enquanto carrega). */
export function useOffice(): string | null {
  const [officeId, setOfficeId] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    getMyOffice()
      .then((r) => active && r.ok && setOfficeId(r.officeId))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return officeId;
}
