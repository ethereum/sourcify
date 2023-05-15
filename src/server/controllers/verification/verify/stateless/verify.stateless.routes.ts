import { Router } from "express";
import { legacyVerifyEndpoint } from "./verify.stateless.handlers";
import { safeHandler } from "../../common";

const router: Router = Router();

router.route("/verify").post(safeHandler(legacyVerifyEndpoint));
router.route("/").post(safeHandler(legacyVerifyEndpoint));

export default router;
