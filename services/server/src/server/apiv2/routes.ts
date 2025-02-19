import { Router } from "express";
import lookupRoutes from "./lookup/lookup.routes";
import jobsRoutes from "./jobs/jobs.routes";

const router: Router = Router();

router.use("/", lookupRoutes);
router.use("/", jobsRoutes);

export default router;
