import { Router } from "express";
import {
  getSessionDataEndpoint,
  addInputFilesEndpoint,
  restartSessionEndpoint,
  addInputContractEndpoint,
} from "./session-state.handlers";
import { safeHandler } from "../../controllers.common";

const router: Router = Router();

router.route("/session/data").get(safeHandler(getSessionDataEndpoint));
router.route("/session/input-files").post(safeHandler(addInputFilesEndpoint));
router.route("/session/clear").post(safeHandler(restartSessionEndpoint));
router
  .route("/session/input-contract")
  .post(safeHandler(addInputContractEndpoint));

export const deprecatedRoutesSessionState = {
  "/session-data": {
    method: "get",
    path: "/session/data",
  },
  "/input-files": {
    method: "post",
    path: "/session/input-files",
  },
  "/restart-session": {
    method: "post",
    path: "/session/clear",
  },
};

export default router;
