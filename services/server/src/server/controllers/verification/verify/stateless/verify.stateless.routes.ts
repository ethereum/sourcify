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

router.route("/verify-deprecated").post(
  // Middleware to check if verifyDeprecated is enabled
  (req, res, next) => {
    const verifyDeprecatedEnabled = req.app.get("verifyDeprecated") as boolean;
    if (verifyDeprecatedEnabled) {
      next();
    } else {
      res.status(400).send("Not found");
    }
  },
  checkPerfectMatch,
  safeHandler(verifyDeprecated),
);

export const deprecatedRoutesVerifyStateless = {
  "/": {
    method: "post",
    path: "/verify",
  },
};

export default router;
