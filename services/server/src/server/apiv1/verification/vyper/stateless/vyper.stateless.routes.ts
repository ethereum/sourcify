import { Router } from "express";
import { verifyVyper } from "./vyper.stateless.handlers";
import { checkPerfectMatch } from "../../../controllers.common";
import { safeHandler } from "../../../../common";

const router: Router = Router();

router.route("/verify/vyper").post(checkPerfectMatch, safeHandler(verifyVyper));

export default router;
