import { safeHandler } from "../../common";
import { Router } from "express";
import { getJobEndpoint } from "./jobs.handler";

const router = Router();

router.route("/verify/:verificationId").get(safeHandler(getJobEndpoint));

export default router;
