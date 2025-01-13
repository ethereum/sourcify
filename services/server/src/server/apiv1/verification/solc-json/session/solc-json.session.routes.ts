import { Router } from "express";
import { addInputSolcJsonEndpoint } from "./solc-json.session.handlers";
import { safeHandler } from "../../../controllers.common";

const router: Router = Router();

router
  .route("/session/input-solc-json")
  .post(safeHandler(addInputSolcJsonEndpoint));

export default router;
