import { Router } from "express";
import { findLatestChainTest } from "./testartifacts.handlers";

const router: Router = Router();

router.route(["/"]).get(findLatestChainTest);

export default router;
