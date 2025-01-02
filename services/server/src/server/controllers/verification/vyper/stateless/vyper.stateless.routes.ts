import { Router } from "express";
import { verifyVyper } from "./vyper.stateless.handlers";
import { checkPerfectMatch, safeHandler } from "../../../controllers.common";

const router: Router = Router();

router.route("/verify/vyper").post(checkPerfectMatch, safeHandler(verifyVyper));

export default router;
