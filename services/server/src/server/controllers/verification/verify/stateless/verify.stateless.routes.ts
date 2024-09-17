import { Router } from "express";
import {
  legacyVerifyEndpoint,
  verifyDeprecated,
} from "./verify.stateless.handlers";
import { safeHandler } from "../../../controllers.common";

const router: Router = Router();

router.route("/verify").post(safeHandler(legacyVerifyEndpoint));

router.route("/verify-deprecated").post((req, res, next) => {
  const verifyDeprecatedEnabled = req.app.get('verifyDeprecated') as boolean;
  if (verifyDeprecatedEnabled) {
    safeHandler(verifyDeprecated)(req, res, next);
  } else {
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
