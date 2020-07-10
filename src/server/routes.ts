import { Router } from 'express';
import { FileService } from '../server/services/FileService';
import { VerificationService } from '../server/services/VerificationService'; 
import FileController from './controllers/FileController';
import VerificationController from './controllers/VerificationController';
import { logger } from '../server/server';

const router: Router = Router();

const fileService = new FileService(logger);
const verificationService = new VerificationService(fileService, logger);

const fileController = new FileController(fileService, logger);
const verificationController = new VerificationController(verificationService, fileService, logger);

router.use('/files', fileController.registerRoutes());
router.use('/', verificationController.registerRoutes());

export default router;
