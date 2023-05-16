import { Response, Router } from "express";
import { verifySolcJsonEndpoint } from "./solc-json.stateless.handlers";
import { safeHandler } from "../../common";

const router: Router = Router();

router.route("/verify/solc-json").post(safeHandler(verifySolcJsonEndpoint));

export default router;
