import { Router } from 'express';
import config from '../config';
import { FileService } from 'sourcify-core';
import { VerificationService } from 'sourcify-verification';
import { ValidationService } from 'sourcify-validation';
import FileController from './controllers/FileController';
import VerificationController from './controllers/VerificationController';
import { logger } from '../server/server';

const router: Router = Router();

const fileService = new FileService(config.repository.path, logger);
const validationService: ValidationService = new ValidationService();
const verificationService = new VerificationService(fileService, logger);

const fileController = new FileController(fileService, logger);
const verificationController: VerificationController = new VerificationController(verificationService, validationService, logger);

router.use('/files/', fileController.registerRoutes());
router.use('/', verificationController.registerRoutes());

export default router;
