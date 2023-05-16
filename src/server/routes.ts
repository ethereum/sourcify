import { Router } from "express";
import verificationService from "./services/VerificationService";
import repositoryService from "./services/RepositoryService";
import VerificationController from "./controllers/VerificationController";
import TestArtifactsController from "./controllers/TestArtifactsController";
import RepositoryController from "./controllers/RepositoryController";
import verifyRoutes from "./controllers/verification/verify/verify.routes";
import solcJsonRoutes from "./controllers/verification/solc-json/solc-json.routes";
import sessionStateRoutes from "./controllers/verification/session-state/session-state.routes";

const router: Router = Router();

const testArtifactsController = new TestArtifactsController();

const repositoryController = new RepositoryController(repositoryService);
const verificationController: VerificationController =
  new VerificationController(verificationService, repositoryService);

router.use("/chain-tests", testArtifactsController.registerRoutes());
router.use("/", repositoryController.registerRoutes()); // Define /files prefix inside repositoryController
router.use("/", verificationController.registerRoutes());

router.use("/", sessionStateRoutes);
router.use("/", verifyRoutes);
router.use("/", solcJsonRoutes);

export default router;
