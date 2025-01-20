import { Router } from "express";
import { verifyFromEtherscan } from "./etherscan.stateless.handlers";
import { checkPerfectMatch } from "../../../controllers.common";
import { safeHandler } from "../../../../common";
const router: Router = Router();

router
  .route("/verify/etherscan")
  .post(checkPerfectMatch, safeHandler(verifyFromEtherscan));

export default router;
