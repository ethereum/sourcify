import { Router } from "express";
import lookupRoutes from "./lookup/lookup.routes";
import jobsRoutes from "./jobs/jobs.routes";
import verificationRoutes from "./verification/verification.routes";

const router: Router = Router();

router.use("/", lookupRoutes);
router.use("/", jobsRoutes);
router.use("/", verificationRoutes);

export default router;
