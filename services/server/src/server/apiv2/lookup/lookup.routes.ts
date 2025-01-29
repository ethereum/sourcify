import { safeHandler } from "../../common";
import {
  validateAddress,
  validateChainId,
  validateFieldsAndOmit,
} from "../middlewares";
import { getContractEndpoint, listContractsEndpoint } from "./lookup.handlers";

import { Router } from "express";

const router = Router();

router
  .route("/contracts/:chainId")
  .get(validateChainId, safeHandler(listContractsEndpoint));

router
  .route("/contract/:chainId/:address")
  .get(
    validateChainId,
    validateAddress,
    validateFieldsAndOmit,
    safeHandler(getContractEndpoint),
  );

export default router;
