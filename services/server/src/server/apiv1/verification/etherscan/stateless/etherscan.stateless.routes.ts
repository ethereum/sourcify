import { Router } from "express";
import { verifyFromEtherscan } from "./etherscan.stateless.handlers";
import { checkPerfectMatch } from "../../../controllers.common";
const router: Router = Router();

router.route("/verify/etherscan").post(checkPerfectMatch, verifyFromEtherscan);

export default router;
