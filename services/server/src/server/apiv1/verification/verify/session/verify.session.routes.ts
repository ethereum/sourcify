import { Router } from "express";
import { verifyContractsInSessionEndpoint } from "./verify.session.handlers";

const router: Router = Router();

router.route("/session/verify-checked").post(verifyContractsInSessionEndpoint);

export const deprecatedRoutesVerifySession = {
  "/session/verify-validated": {
    method: "post",
    path: "/session/verify-checked",
  },
  "/verify-validated": {
    method: "post",
    path: "/session/verify-checked",
  },
};

export default router;
