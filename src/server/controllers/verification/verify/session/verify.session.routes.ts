import { Router, Response } from "express";
import { verifyContractsInSessionEndpoint } from "./verify.session.handlers";
import { safeHandler } from "../../verification.common";

const router: Router = Router();

router
  .route("/session/verify-checked")
  .post(safeHandler(verifyContractsInSessionEndpoint));
router
  .route("/verify-validated")
  .post((_, res: Response) => res.redirect(307, "/session/verify-checked"));
router
  .route("/session/verify-validated")
  .post((_, res: Response) => res.redirect(307, "/session/verify-checked"));

export default router;
