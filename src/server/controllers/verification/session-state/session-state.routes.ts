import { Router, Response } from "express";
import {
  getSessionDataEndpoint,
  addInputFilesEndpoint,
  restartSessionEndpoint,
  addInputContractEndpoint,
} from "./session-state.handlers";
import { safeHandler } from "../common";

const router: Router = Router();

router.route("/session/data").get(safeHandler(getSessionDataEndpoint));
router
  .route("/session-data")
  .post((_, res: Response) => res.redirect(307, "/session/data"));

router.route("/session/input-files").post(safeHandler(addInputFilesEndpoint));
router
  .route("/input-files")
  .post((_, res: Response) => res.redirect(307, "/session/input-files"));

router.route("/session/clear").post(safeHandler(restartSessionEndpoint));
router
  .route("/restart-session")
  .post((_, res: Response) => res.redirect(307, "/session/clear"));

router
  .route("/session/input-contract")
  .post(safeHandler(addInputContractEndpoint));

export default router;
