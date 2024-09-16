import { Router } from "express";
import { verifySolcJsonEndpoint } from "./solc-json.stateless.handlers";
import { checkPerfectMatch, safeHandler } from "../../../controllers.common";

const router: Router = Router();

router
  .route("/verify/solc-json")
  .post(checkPerfectMatch, safeHandler(verifySolcJsonEndpoint));

export default router;
