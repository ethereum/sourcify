import {
  validateAddress,
  validateChainId,
  validateContractIdentifier,
  checkIfAlreadyVerified,
  checkIfJobIsAlreadyRunning,
  validateStandardJsonInput,
} from "../middlewares";
import { verifyFromJsonInputEndpoint } from "./verification.handlers";
import { Router } from "express";

const router = Router();

// router
//   .route("/verify/:chainId/:address")
//   .post(
//     validateChainId,
//     validateAddress,
//     validateStandardJsonInput,
//     validateContractIdentifier,
//     checkIfAlreadyVerified,
//     checkIfJobIsAlreadyRunning,
//     verifyFromJsonInputEndpoint,
//   );

export default router;
