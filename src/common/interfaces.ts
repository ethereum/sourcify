import { Router } from 'express';

export interface IController {
    registerRoutes(): Router;
}
