import { Router } from "express";

import {
  createEndpoint,
  createContractEndpoint,
  checkAllByChainAndAddressEndpoint,
  checkByChainAndAddressesEnpoint,
  getFileEndpoint,
  createPaginatedContractEndpoint,
  CheckAllByChainAndAddressEndpointRequest,
} from "./repository.handlers";
import { validateAddress } from "../controllers.common";
import { safeHandler } from "../../common";

const REPOSITORY_CONTROLLER_PREFIX = "/files";

const router: Router = Router();

[
  {
    prefix: "/tree/any",
    method: createEndpoint(
      (services, chain, address, match) =>
        services.storage.performServiceOperation("getTree", [
          chain,
          address,
          match,
        ]),
      "any_match",
      true,
    ),
  },
  {
    prefix: "/any",
    method: createEndpoint(
      (services, chain, address, match) =>
        services.storage.performServiceOperation("getContent", [
          chain,
          address,
          match,
        ]),
      "any_match",
      true,
    ),
  },
  {
    prefix: "/tree",
    method: createEndpoint(
      (services, chain, address, match) =>
        services.storage.performServiceOperation("getTree", [
          chain,
          address,
          match,
        ]),
      "full_match",
    ),
  },
  {
    prefix: "/contracts",
    method: createContractEndpoint((services, chain) =>
      services.storage.performServiceOperation("getContracts", [chain]),
    ),
  },
  {
    prefix: "/contracts/full",
    method: createPaginatedContractEndpoint(
      (services, chain, match, page, limit, descending) =>
        services.storage.performServiceOperation("getPaginatedContracts", [
          chain,
          match,
          page,
          limit,
          descending,
        ]),
      "full_match",
    ),
  },
  {
    prefix: "/contracts/partial",
    method: createPaginatedContractEndpoint(
      (services, chain, match, page, limit, descending) =>
        services.storage.performServiceOperation("getPaginatedContracts", [
          chain,
          match,
          page,
          limit,
          descending,
        ]),
      "partial_match",
    ),
  },
  {
    prefix: "/contracts/any",
    method: createPaginatedContractEndpoint(
      (services, chain, match, page, limit, descending) =>
        services.storage.performServiceOperation("getPaginatedContracts", [
          chain,
          match,
          page,
          limit,
          descending,
        ]),
      "any_match",
    ),
  },
  {
    prefix: "",
    method: createEndpoint(
      (services, chain, address, match) =>
        services.storage.performServiceOperation("getContent", [
          chain,
          address,
          match,
        ]),
      "full_match",
    ),
  },
].forEach((pair) => {
  router
    .route(
      !pair.prefix.startsWith("/contracts")
        ? REPOSITORY_CONTROLLER_PREFIX + pair.prefix + "/:chain/:address"
        : REPOSITORY_CONTROLLER_PREFIX + pair.prefix + "/:chain",
    )
    .get(validateAddress, safeHandler(pair.method));
});

// check(All)ByAddresses endpoints have different format then the ones above. check(All)ByAddresses take query params instead of path params.
router
  .route("/check-all-by-addresses")
  .get(
    safeHandler<CheckAllByChainAndAddressEndpointRequest>(
      checkAllByChainAndAddressEndpoint,
    ),
  );

/**
 * The following two routes are the replacement for the removed static file route that exposed RepositoryV1
 * The function getFileEndpoint get the sources from compiled_contracts_sources
 * We need both of these routes because compiled_contracts_sources doesn't contain the metadata file
 */

// This route covers constructor-args.txt, creator-tx-hash.txt, library-map.json, immutable-references.json files
router
  .route("/repository/contracts/:match/:chain/:address/*")
  .get(validateAddress, safeHandler(getFileEndpoint));

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
