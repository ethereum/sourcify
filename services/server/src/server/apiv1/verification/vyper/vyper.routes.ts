import verifyStatelessRoutes from "./stateless/vyper.stateless.routes";

import { Router } from "express";

const router = Router();

router.use("/", verifyStatelessRoutes);

export default router;
