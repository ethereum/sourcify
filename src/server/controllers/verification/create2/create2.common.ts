import { Request } from "express";
import { apiLimiter /* apiCheckPermission */ } from "../verification.common";

type Create2RequestBody = {
  deployerAddress: string;
  salt: string;
  abiEncodedConstructorArguments?: string;
  files: {
    [key: string]: string;
  };
  create2Address: string;
  clientToken?: string;
};

export interface Create2VerifyRequest extends Request {
  body: Create2RequestBody;
}

export interface SessionCreate2VerifyRequest extends Request {
  body: Create2RequestBody & {
    verificationId: string;
  };
}

export interface SessionCreate2VerifyRequest extends Request {
  body: Create2RequestBody & {
    verificationId: string;
  };
}

export const apiVerifyCreate2Limiter = apiLimiter(10 * 1000, 10);

/* 
export const hasVerifyCreate2Permission = apiCheckPermission(
  "verify:create2",
  "This user has no permission to create2 verification"
);
*/
