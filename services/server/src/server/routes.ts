import { Router } from "express";
import testArtifactsRoutes from "./controllers/testartifacts/testartifacts.routes";
import repositoryRoutes from "./controllers/repository/repository.routes";
import sessionStateRoutes from "./controllers/verification/session-state/session-state.routes";
import verifyRoutes from "./controllers/verification/verify/verify.routes";
import solcJsonRoutes from "./controllers/verification/solc-json/solc-json.routes";
import create2Routes from "./controllers/verification/create2/create2.routes";
import etherscanRoutes from "./controllers/verification/etherscan/etherscan.routes";

const router: Router = Router();

router.use("/chain-tests", testArtifactsRoutes);

router.use("/", repositoryRoutes);

router.use("/", sessionStateRoutes);
router.use("/", verifyRoutes);
router.use("/", solcJsonRoutes);
router.use("/", create2Routes);
router.use("/", etherscanRoutes);

export default router;
