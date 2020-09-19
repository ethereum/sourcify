import { Router } from 'express';

export interface IController {
    registerRoutes(): Router;
}

export interface IResponseError {
    code: number;
    message: string;
    errors?: any[];
}

export const multihashes: any = require('multihashes');
