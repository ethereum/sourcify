import {
  validateAddress,
  validateChainId,
  validateContractIdentifier,
  validateMetadata,
  checkIfAlreadyVerified,
  checkIfJobIsAlreadyRunning,
  validateStandardJsonInput,
} from "../middlewares";
import {
  verifyFromJsonInputEndpoint,
  verifyFromMetadataEndpoint,
} from "./verification.handlers";
import { Router } from "express";

const router = Router();

router
  .route("/verify/:chainId/:address")
  .post(
    validateChainId,
    validateAddress,
    validateStandardJsonInput,
    validateContractIdentifier,
    checkIfAlreadyVerified,
    checkIfJobIsAlreadyRunning,
    verifyFromJsonInputEndpoint,
  );

router
  .route("/verify/metadata/:chainId/:address")
  .post(
    validateChainId,
    validateAddress,
    validateMetadata,
    checkIfAlreadyVerified,
    checkIfJobIsAlreadyRunning,
    verifyFromMetadataEndpoint,
  );

export default router;
