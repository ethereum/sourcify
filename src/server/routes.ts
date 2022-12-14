import { Router } from "express";
import config from "../config";
import { FileService } from "@ethereum-sourcify/core";
import { VerificationService } from "@ethereum-sourcify/verification";
import { ValidationService } from "@ethereum-sourcify/validation";
import FileController from "./controllers/FileController";
import VerificationController from "./controllers/VerificationController";
import TestArtifactsController from "./controllers/TestArtifactsController";

const router: Router = Router();

const fileService = new FileService(config.repository.path);
const validationService: ValidationService = new ValidationService();
const verificationService = new VerificationService(fileService);

const testArtifactsController = new TestArtifactsController();
const fileController = new FileController(fileService);
const verificationController: VerificationController =
  new VerificationController(verificationService, validationService);

router.use("/chain-tests", testArtifactsController.registerRoutes());
router.use("/files/", fileController.registerRoutes());
router.use("/", verificationController.registerRoutes());

export default router;
