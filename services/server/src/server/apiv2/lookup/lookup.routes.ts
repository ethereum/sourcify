import { safeHandler } from "../../common";
import { validateChainId } from "../middlewares";
import { listContractsEndpoint } from "./lookup.handlers";

import { Router } from "express";

const router = Router();

router
  .route("/contracts/:chainId")
  .get(validateChainId, safeHandler(listContractsEndpoint));

export default router;
