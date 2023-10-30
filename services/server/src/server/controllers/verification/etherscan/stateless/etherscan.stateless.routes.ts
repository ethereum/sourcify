import { Router } from "express";
import { verifyFromEtherscan } from "./etherscan.stateless.handlers";
import { safeHandler } from "../../../controllers.common";

const router: Router = Router();

router.route("/verify/etherscan").post(safeHandler(verifyFromEtherscan));

export default router;
