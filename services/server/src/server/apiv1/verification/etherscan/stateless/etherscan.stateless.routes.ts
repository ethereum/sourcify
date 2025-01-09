import { Router } from "express";
import { verifyFromEtherscan } from "./etherscan.stateless.handlers";
import { checkPerfectMatch, safeHandler } from "../../../controllers.common";

const router: Router = Router();

router
  .route("/verify/etherscan")
  .post(checkPerfectMatch, safeHandler(verifyFromEtherscan));

export default router;
