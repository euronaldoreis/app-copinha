import { cache } from "react";
import { getDb } from "@/db";
import { loadAll } from "./services";

/**
 * Todos os dados do banco, lidos uma vez por requisição. O volume é pequeno
 * (algumas dezenas de edições), então as telas calculam tudo a partir daqui.
 */
export const getData = cache(() => loadAll(getDb()));
