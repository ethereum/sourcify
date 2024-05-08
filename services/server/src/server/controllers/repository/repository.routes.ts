import { Router } from "express";
import { services } from "../../services/services";

import {
  createEndpoint,
  createContractEndpoint,
  checkAllByChainAndAddressEndpoint,
  checkByChainAndAddressesEnpoint,
  getFileEndpoint,
  getMetadataEndpoint,
} from "./repository.handlers";
import { safeHandler } from "../controllers.common";

const REPOSITORY_CONTROLLER_PREFIX = "/files";

const router: Router = Router();

[
  {
    prefix: "/tree/any",
    method: createEndpoint(services.storage.getTree, "any_match", true),
  },
  {
    prefix: "/any",
    method: createEndpoint(services.storage.getContent, "any_match", true),
  },
  {
    prefix: "/tree",
    method: createEndpoint(services.storage.getTree, "full_match"),
  },
  {
    prefix: "/contracts",
    method: createContractEndpoint(services.storage.getContracts),
  },
  {
    prefix: "",
    method: createEndpoint(services.storage.getContent, "full_match"),
  },
].forEach((pair) => {
  router
    .route(
      pair.prefix != "/contracts"
        ? REPOSITORY_CONTROLLER_PREFIX + pair.prefix + "/:chain/:address"
        : REPOSITORY_CONTROLLER_PREFIX + pair.prefix + "/:chain"
    )
    .get(safeHandler(pair.method));
});

// check(All)ByAddresses endpoints have different format then the ones above. check(All)ByAddresses take query params instead of path params.
router
  .route("/check-all-by-addresses")
  .get(safeHandler(checkAllByChainAndAddressEndpoint));

router
  .route("/repository/contracts/:match/:chain/:address/metadata.json")
  .get(safeHandler(getMetadataEndpoint));

router
  .route("/repository/contracts/:match/:chain/:address/sources/*")
  .get(safeHandler(getFileEndpoint));

router
  .route("/check-by-addresses")
  .get(safeHandler(checkByChainAndAddressesEnpoint));

export const deprecatedRoutesRepository = {
  "/checkAllByAddresses": {
    method: "get",
    path: "/check-all-by-addresses",
  },
  "/checkByAddresses": {
    method: "get",
    path: "/check-by-addresses",
  },
};

export default router;
