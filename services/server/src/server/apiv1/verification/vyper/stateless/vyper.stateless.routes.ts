import { Router } from "express";
import { verifyVyper } from "./vyper.stateless.handlers";
import { checkPerfectMatch } from "../../../controllers.common";

const router: Router = Router();

router.route("/verify/vyper").post(checkPerfectMatch, verifyVyper);

export default router;
