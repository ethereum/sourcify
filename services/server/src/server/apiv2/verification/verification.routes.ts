import {
  validateAddress,
  validateChainId,
  validateContractIdentifier,
} from "../middlewares";
import { verifyFromJsonInputEndpoint } from "./verification.handlers";
import { Router } from "express";

const router = Router();

router
  .route("/verify/:chainId/:address")
  .post(
    validateChainId,
    validateAddress,
    validateContractIdentifier,
    verifyFromJsonInputEndpoint,
  );

export default router;
