import { Router } from "express";
import { verifyCreate2Handler } from "./create2.stateless.handlers";
import { safeHandler } from "../../../controllers.common";
import { isAuth0EnabledUser, jwtCheck } from "../../verification.common";
import {
  // hasVerifyCreate2Permission,
  apiVerifyCreate2Limiter,
} from "../create2.common";

const router: Router = Router();

router.route("/verify/create2").post(
  jwtCheck,
  // hasVerifyCreate2Permission,
  isAuth0EnabledUser,
  apiVerifyCreate2Limiter,
  safeHandler(verifyCreate2Handler)
);

export default router;
