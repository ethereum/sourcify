import { Router } from "express";
import { findLatestChainTest } from "./testartifacts.handlers";
import { safeHandler } from "../../common";

const router: Router = Router();

router.route(["/"]).get(safeHandler(findLatestChainTest));

export default router;
