import { Router } from "express"; // static is a reserved word
import testArtifactsRoutes from "./testartifacts/testartifacts.routes";
import repositoryRoutes from "./repository/repository.routes";
import sessionStateRoutes from "./verification/session-state/session-state.routes";
import verifyRoutes from "./verification/verify/verify.routes";
import solcJsonRoutes from "./verification/solc-json/solc-json.routes";
import etherscanRoutes from "./verification/etherscan/etherscan.routes";
import vyperRoutes from "./verification/vyper/vyper.routes";

const router: Router = Router();

router.use("/chain-tests", testArtifactsRoutes);

router.use("/", repositoryRoutes);
router.use("/", sessionStateRoutes);
router.use("/", verifyRoutes);
router.use("/", solcJsonRoutes);
router.use("/", etherscanRoutes);
router.use("/", vyperRoutes);

export default router;
