import { Router } from "express";
import {
  sessionVerifyCreate2,
  sessionPrecompileContract,
} from "./create2.session.handlers";
import { authenticatedRequest } from "../../verification.common";
import { safeHandler } from "../../../controllers.common";

const router: Router = Router();

router
  .route("/session/verify/create2")
  .post(authenticatedRequest, safeHandler(sessionVerifyCreate2));

router
  .route(["/session/verify/create2/compile"])
  .post(safeHandler(sessionPrecompileContract));

export default router;
