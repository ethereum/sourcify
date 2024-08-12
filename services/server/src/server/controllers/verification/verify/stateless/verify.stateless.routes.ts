import { Router } from "express";
import {
  legacyVerifyEndpoint,
  verifyDeprecated,
} from "./verify.stateless.handlers";
import { safeHandler } from "../../../controllers.common";
import config from "config";

const router: Router = Router();

router.route("/verify").post(safeHandler(legacyVerifyEndpoint));

if (config.get("verifyDeprecated")) {
  router.route("/verify-deprecated").post(safeHandler(verifyDeprecated));
} else {
  router.route("/verify-deprecated").all((req, res) => {
    res.status(400).send("Not found");
  });
}

export const deprecatedRoutesVerifyStateless = {
  "/": {
    method: "post",
    path: "/verify",
  },
};

export default router;
