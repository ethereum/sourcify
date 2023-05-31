import express, { Response, Request, NextFunction } from "express";
import { deprecatedRoutesVerifyStateless } from "./controllers/verification/verify/stateless/verify.stateless.routes";
import { deprecatedRoutesVerifySession } from "./controllers/verification/verify/session/verify.session.routes";
import { deprecatedRoutesSessionState } from "./controllers/verification/session-state/session-state.routes";
import { deprecatedRoutesRepository } from "./controllers/repository/repository.routes";

export const deprecatedRoutes: { [index: string]: string } = {
  ...deprecatedRoutesVerifyStateless,
  ...deprecatedRoutesVerifySession,
  ...deprecatedRoutesSessionState,
  ...deprecatedRoutesRepository,
};

// Replace req.url and req.originalUrl allowing OpenApiValidator to handle deprecated routes
// otherwise creating an openapi declaration file for each deprecated route is necessary
export function initDeprecatedRoutes(app: express.Application) {
  Object.keys(deprecatedRoutes).forEach((deprecatedRoute: string) => {
    app.post(
      deprecatedRoute,
      (req: Request, res: Response, next: NextFunction) => {
        req.url = deprecatedRoutes[deprecatedRoute];
        req.originalUrl = deprecatedRoutes[deprecatedRoute];
        next();
      }
    );
  });
}
