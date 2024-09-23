import { Router } from "express";
import {
  legacyVerifyEndpoint,
  verifyDeprecated,
} from "./verify.stateless.handlers";
import { checkPerfectMatch, safeHandler } from "../../../controllers.common";

const router: Router = Router();

router
  .route("/verify")
  .post(checkPerfectMatch, safeHandler(legacyVerifyEndpoint));

if (config.get("verifyDeprecated")) {
  router
    .route("/verify-deprecated")
    .post(checkPerfectMatch, safeHandler(verifyDeprecated));
} else {
  router.route("/verify-deprecated").all((req, res) => {
    res.status(400).send("Not found");
  }
});

export const deprecatedRoutesVerifyStateless = {
  "/": {
    method: "post",
    path: "/verify",
  },
};

export default router;
