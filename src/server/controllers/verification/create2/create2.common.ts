import { Request } from "express";

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
