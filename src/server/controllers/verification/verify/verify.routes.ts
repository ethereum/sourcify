import verifyStatelessRoutes from "./stateless/verify.stateless.routes";
import verifySessionRoutes from "./session/verify.session.routes";

import { Router } from "express";

const router = Router();

router.use("/", verifyStatelessRoutes);
router.use("/", verifySessionRoutes);

export default router;
