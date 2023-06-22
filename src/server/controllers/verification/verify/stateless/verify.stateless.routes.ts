import { Router } from "express";
import { legacyVerifyEndpoint } from "./verify.stateless.handlers";
import { safeHandler } from "../../../controllers.common";

const router: Router = Router();

router.route("/verify").post(safeHandler(legacyVerifyEndpoint));

export const deprecatedRoutesVerifyStateless = {
  "/": {
    method: "post",
    path: "/verify",
  },
};

export default router;
