import { Router } from "express";
import lookupRoutes from "./lookup/lookup.routes";

const router: Router = Router();

router.use("/", lookupRoutes);

export default router;
