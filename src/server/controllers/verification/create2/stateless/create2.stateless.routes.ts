import { Router } from "express";
import { verifyCreate2Handler } from "./create2.stateless.handlers";
import { safeHandler, authenticatedRequest } from "../../common";

const router: Router = Router();

router
  .route("/verify/create2")
  .post(authenticatedRequest, safeHandler(verifyCreate2Handler));

export default router;
