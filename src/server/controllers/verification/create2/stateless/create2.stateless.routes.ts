import { Router } from "express";
import { verifyCreate2Handler } from "./create2.stateless.handlers";
import { authenticatedRequest } from "../../verification.common";
import { safeHandler } from "../../../controllers.common";

const router: Router = Router();

router
  .route("/verify/create2")
  .post(authenticatedRequest, safeHandler(verifyCreate2Handler));

export default router;
