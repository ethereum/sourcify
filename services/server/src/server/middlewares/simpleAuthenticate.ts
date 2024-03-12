import { Request, Response, NextFunction } from "express";
import logger from "../../common/logger";

if (!process.env.SETLOGGING_TOKEN) {
  logger.warn(
    "No SETLOGGING_TOKEN environment variable set. Will not authenticate requests."
  );
}

// set header as "Authorization": "Basic <Token>"
function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers["authorization"];
  // This is a placeholder token. In a real application, use a more secure method for managing and validating tokens.
  const token = authHeader && authHeader.split(" ")[1];

  if (token !== process.env.SETLOGGING_TOKEN) {
    return res.status(401).json({ error: "Provided token is invalid" });
  }

  next();
}

export default authenticate;
