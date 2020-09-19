import { Router } from 'express';
import { FileService } from 'sourcify-core/build/index';
import { VerificationService } from 'sourcify-verification/build/services/VerificationService'; 
import FileController from './controllers/FileController';
import VerificationController from './controllers/VerificationController';
import { logger } from '../server/server';
import { ValidationService } from 'sourcify-validation/build/services/ValidationService';

const router: Router = Router();

const fileService = new FileService(logger);
const validationService = new ValidationService(fileService, logger);
const verificationService = new VerificationService(fileService, logger);

const fileController = new FileController(fileService, logger);
const verificationController = new VerificationController(verificationService, validationService, fileService, logger);

router.use('/files', fileController.registerRoutes());
router.use('/', verificationController.registerRoutes());

export default router;
