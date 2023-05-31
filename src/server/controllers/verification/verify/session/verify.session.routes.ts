import { Router, Response } from "express";
import { verifyContractsInSessionEndpoint } from "./verify.session.handlers";
import { safeHandler } from "../../../controllers.common";

const router: Router = Router();

router
  .route("/session/verify-checked")
  .post(safeHandler(verifyContractsInSessionEndpoint));

export default router;
