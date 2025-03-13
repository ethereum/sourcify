import { Router } from "express";
import { verifySolcJsonEndpoint } from "./solc-json.stateless.handlers";
import { checkPerfectMatch } from "../../../controllers.common";

const router: Router = Router();

router
  .route("/verify/solc-json")
  .post(checkPerfectMatch, verifySolcJsonEndpoint);

export default router;
