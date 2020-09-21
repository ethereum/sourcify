import { Router } from 'express';
import { FileService } from '../server/services/FileService';
import { VerificationService } from '../server/services/VerificationService';
import { ValidationService, IValidationService } from '../../services/validation/build/index';
import FileController from './controllers/FileController';
import VerificationController from './controllers/VerificationController';
import { logger } from '../server/server';

const router: Router = Router();

const fileService = new FileService(logger);
const validationService: ValidationService = new ValidationService(logger);
const verificationService = new VerificationService(fileService, logger);

const fileController = new FileController(fileService, logger);
const verificationController: VerificationController = new VerificationController(verificationService, validationService, logger);

router.use('/files/', fileController.registerRoutes());
router.use('/', verificationController.registerRoutes());

export default router;
