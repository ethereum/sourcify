import { Router } from "express";
import repositoryService from "./services/RepositoryService";
import TestArtifactsController from "./controllers/TestArtifactsController";
import RepositoryController from "./controllers/RepositoryController";
import sessionStateRoutes from "./controllers/verification/session-state/session-state.routes";
import verifyRoutes from "./controllers/verification/verify/verify.routes";
import solcJsonRoutes from "./controllers/verification/solc-json/solc-json.routes";
import create2Routes from "./controllers/verification/create2/create2.routes";
import etherscanRoutes from "./controllers/verification/etherscan/etherscan.routes";

const router: Router = Router();

const testArtifactsController = new TestArtifactsController();

const repositoryController = new RepositoryController(repositoryService);

router.use("/chain-tests", testArtifactsController.registerRoutes());
router.use("/", repositoryController.registerRoutes()); // Define /files prefix inside repositoryController

router.use("/", sessionStateRoutes);
router.use("/", verifyRoutes);
router.use("/", solcJsonRoutes);
router.use("/", create2Routes);
router.use("/", etherscanRoutes);

export default router;
