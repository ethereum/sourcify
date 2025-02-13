import { Router } from "express";
import { verifySolcJsonEndpoint } from "./solc-json.stateless.handlers";
import { checkPerfectMatch } from "../../../controllers.common";
import { safeHandler } from "../../../../common";

const router: Router = Router();

router
  .route("/verify/solc-json")
  .post(checkPerfectMatch, safeHandler(verifySolcJsonEndpoint));

export default router;
