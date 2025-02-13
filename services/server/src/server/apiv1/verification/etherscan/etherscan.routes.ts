import etherscanStatelessRoutes from "./stateless/etherscan.stateless.routes";
import etherscanSessionRoutes from "./session/etherscan.session.routes";

import { Router } from "express";

const router = Router();

router.use("/", etherscanStatelessRoutes);
router.use("/", etherscanSessionRoutes);

export default router;
