import { Router } from "express";
import {
  sessionVerifyCreate2,
  sessionPrecompileContract,
} from "./create2.session.handlers";
import { authenticatedRequest } from "../../verification.common";
import { safeHandler } from "../../../controllers.common";
import { auth } from "express-oauth2-jwt-bearer";
import rateLimit from "express-rate-limit";

const apiLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 10, // Limit each IP to 10 requests per `window` (here, per 10 seconds)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers,
  message: {
    error: "Too many requests, please try again later.",
  },
  keyGenerator: (req) => req.auth?.payload.sub as string,
});

const jwtCheck = auth({
  audience: "https://sourcify.dev",
  issuerBaseURL: "https://dev-htkreq1l71u1hn5l.us.auth0.com/",
  tokenSigningAlg: "RS256",
});

const router: Router = Router();

router
  .route("/session/verify/create2")
  .post(
    jwtCheck,
    authenticatedRequest,
    apiLimiter,
    safeHandler(sessionVerifyCreate2)
  );

router
  .route(["/session/verify/create2/compile"])
  .post(safeHandler(sessionPrecompileContract));

export default router;
