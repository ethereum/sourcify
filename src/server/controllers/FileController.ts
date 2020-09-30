import { NextFunction, Request, Response, Router } from 'express';
import BaseController from './BaseController';
import { IController } from '../../common/interfaces';
import { IFileService } from '../services/FileService';
import * as HttpStatus from 'http-status-codes';
import { NotFoundError, ValidationError } from '../../common/errors';
import { param, validationResult } from 'express-validator/check';
import { isValidAddress, isValidChain } from '../../common/validators/validators';
import * as bunyan from 'bunyan';
import { Logger } from '../../utils/logger/Logger';

export default class FileController extends BaseController implements IController {
    router: Router;
    fileService: IFileService;
    logger: bunyan;

    constructor(fileService: IFileService, logger?: bunyan) {
        super();
        this.router = Router();
        this.fileService = fileService;
        this.logger = Logger("FileController");
        if (logger !== undefined) {
            this.logger = logger;
        }
    }

    getTreeByChainAndAddress = async (req: Request, res: Response, next: NextFunction) => {
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty()) {
            return next(new ValidationError(validationErrors.array()))
        }
        let tree;
        try {
            tree = await this.fileService.getTreeByChainAndAddress(req.params.chain, req.params.address);
            if (!tree.length) next(new NotFoundError("Files have not been found!"));
        } catch (err) {
            next(new NotFoundError(err.message));
            return;
        }
        return res.status(HttpStatus.OK).json(tree)
    }

    getByChainAndAddress = async (req: Request, res: Response, next: NextFunction) => {
        const validationErrors = validationResult(req);
        if (!validationErrors.isEmpty()) {
            return next(new ValidationError(validationErrors.array()))
        }
        let files;
        try {
            files = await this.fileService.getByChainAndAddress(req.params.chain, req.params.address);
            if (files.length === 0) return next(new NotFoundError("Files have not been found!"));

        } catch (err) {
            return next(new NotFoundError(err.message));
        }
        return res.status(HttpStatus.OK).json(files);
    }

    registerRoutes = (): Router => {
        this.router.route('/tree/:chain/:address')
            .get([
                param('chain').custom(chain => isValidChain(chain, this.fileService)),
                param('address').custom(address => isValidAddress(address))
            ], this.safeHandler(this.getTreeByChainAndAddress));
        this.router.route('/:chain/:address')
            .get([
                param('chain').custom(chain => isValidChain(chain, this.fileService)), 
                param('address').custom(address => isValidAddress(address))
            ], this.safeHandler(this.getByChainAndAddress));
        return this.router;
    }
}
