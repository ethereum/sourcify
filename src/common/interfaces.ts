import { Router } from "express";

export interface IController {
  registerRoutes(): Router;
}
export interface IResponseError {
  code: number;
  message: string;
  log: boolean;
  errors?: any[];
}
