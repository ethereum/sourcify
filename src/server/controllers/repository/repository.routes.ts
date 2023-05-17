import { Router, Response } from "express";
import repositoryService from "../../services/RepositoryService";
import {
  createEndpoint,
  createContractEndpoint,
  checkAllByChainAndAddressEndpoint,
  checkByChainAndAddressesEnpoint,
} from "./repository.handlers";
import { safeHandler } from "../controllers.common";

const REPOSITORY_CONTROLLER_PREFIX = "/files";

const router: Router = Router();

[
  {
    prefix: "/tree/any",
    method: createEndpoint(repositoryService.getTree, "any_match", true),
  },
  {
    prefix: "/any",
    method: createEndpoint(repositoryService.getContent, "any_match", true),
  },
  {
    prefix: "/tree",
    method: createEndpoint(repositoryService.getTree, "full_match"),
  },
  {
    prefix: "/contracts",
    method: createContractEndpoint(repositoryService.getContracts),
  },
  {
    prefix: "",
    method: createEndpoint(repositoryService.getContent, "full_match"),
  },
].forEach((pair) => {
  /* const validators = [param("chain").custom(isValidChain)];
  if (pair.prefix != "/contracts")
    validators.push(param("address").custom(isValidAddress)); */
  router
    .route(
      pair.prefix != "/contracts"
        ? REPOSITORY_CONTROLLER_PREFIX + pair.prefix + "/:chain/:address"
        : REPOSITORY_CONTROLLER_PREFIX + pair.prefix + "/:chain"
    )
    .get(safeHandler(pair.method));
});

// check(All)ByAddresses endpoints have different format then the ones above. check(All)ByAddresses take query params instead of path params.
router.route("/check-all-by-addresses").get(
  /* query("addresses")
    .exists()
    .bail()
    .custom(
      (addresses, { req }) => (req.addresses = validateAddresses(addresses))
    ),
  query("chainIds")
    .exists()
    .bail()
    .custom((chainIds, { req }) => (req.chainIds = validateChainIds(chainIds))), */
  safeHandler(checkAllByChainAndAddressEndpoint)
);
router
  .route("/checkAllByAddresses")
  .post((_, res: Response) => res.redirect(307, "/check-all-by-addresses"));

router.route("/check-by-addresses").get(
  /* query("addresses")
    .exists()
    .bail()
    .custom(
      (addresses, { req }) => (req.addresses = validateAddresses(addresses))
    ),
  query("chainIds")
    .exists()
    .bail()
    .custom((chainIds, { req }) => (req.chainIds = validateChainIds(chainIds))), */
  safeHandler(checkByChainAndAddressesEnpoint)
);
router
  .route("/checkByAddresses")
  .post((_, res: Response) => res.redirect(307, "/check-by-addresses"));

export default router;
