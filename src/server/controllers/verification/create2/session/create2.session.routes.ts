import { Router } from "express";
import {
  sessionVerifyCreate2,
  sessionPrecompileContract,
} from "./create2.session.handlers";
import { safeHandler } from "../../../controllers.common";
import { isAuth0EnabledUser, jwtCheck } from "../../verification.common";
import {
  // hasVerifyCreate2Permission,
  apiVerifyCreate2Limiter,
} from "../create2.common";

const router: Router = Router();

router.route("/session/verify/create2").post(
  jwtCheck,
  // hasVerifyCreate2Permission,
  isAuth0EnabledUser,
  apiVerifyCreate2Limiter,
  safeHandler(sessionVerifyCreate2)
);

router
  .route(["/session/verify/create2/compile"])
  .post(safeHandler(sessionPrecompileContract));

export default router;
