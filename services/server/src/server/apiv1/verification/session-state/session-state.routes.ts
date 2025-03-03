import { Router } from "express";
import {
  getSessionDataEndpoint,
  addInputFilesEndpoint,
  restartSessionEndpoint,
  addInputContractEndpoint,
} from "./session-state.handlers";

const router: Router = Router();

router.route("/session/data").get(getSessionDataEndpoint);
router.route("/session/input-files").post(addInputFilesEndpoint);
router.route("/session/clear").post(restartSessionEndpoint);
router.route("/session/input-contract").post(addInputContractEndpoint);

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
