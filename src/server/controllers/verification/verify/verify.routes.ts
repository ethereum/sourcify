import verifyStatelessRoutes from "./stateless/verify.stateless.routes";
// import solcJsonSessionRoutes from "./session/verify.session.routes";

import { Router } from "express";

const router = Router();

router.use("/", verifyStatelessRoutes);
// router.use("/", solcJsonSessionRoutes);

export default router;
