import { Response, Router } from "express";
import { legacyVerifyEndpoint } from "./verify.stateless.handlers";
import { safeHandler } from "../../../controllers.common";

const router: Router = Router();

router.route("/verify").post(safeHandler(legacyVerifyEndpoint));
router.route("/").post((_, res: Response) => res.redirect(307, "/verify"));

export default router;
