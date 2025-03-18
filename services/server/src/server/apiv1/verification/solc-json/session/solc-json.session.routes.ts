import { Router } from "express";
import { addInputSolcJsonEndpoint } from "./solc-json.session.handlers";

const router: Router = Router();

router.route("/session/input-solc-json").post(addInputSolcJsonEndpoint);

export default router;
