import { Router } from "express";
import { sessionVerifyFromEtherscan } from "./etherscan.session.handlers";

const router: Router = Router();

router.route(["/session/verify/etherscan"]).post(sessionVerifyFromEtherscan);

export default router;
