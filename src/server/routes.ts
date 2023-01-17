import { Router } from "express";
import config from "../config";
import VerificationService from "./services/VerificationService";
import VerificationController from "./controllers/VerificationController";
import TestArtifactsController from "./controllers/TestArtifactsController";
import RepositoryService from "./services/RepositoryService";
import RepositoryController from "./controllers/RepositoryController";
import { supportedChainsMap } from "../sourcify-chains";
const router: Router = Router();

const verificationService = new VerificationService(supportedChainsMap);

const testArtifactsController = new TestArtifactsController();
const repositoryService = new RepositoryService(config.repository.path);
const repositoryController = new RepositoryController(repositoryService);
const verificationController: VerificationController =
  new VerificationController(verificationService, repositoryService);

router.use("/chain-tests", testArtifactsController.registerRoutes());
router.use("/", repositoryController.registerRoutes()); // Define /files prefix inside repositoryController
router.use("/", verificationController.registerRoutes());

export default router;
