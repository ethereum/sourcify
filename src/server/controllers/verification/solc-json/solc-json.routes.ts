import solcJsonStatelessRoutes from "./stateless/solc-json.stateless.routes";
import solcJsonSessionRoutes from "./session/solc-json.session.routes";

import { Router } from "express";

const router = Router();

router.use("/", solcJsonStatelessRoutes);
router.use("/", solcJsonSessionRoutes);

export default router;
