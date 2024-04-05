import {
  LambdaClient,
  InvokeCommand,
  InvokeCommandInput,
} from "@aws-sdk/client-lambda";
import {
  CompilerOutput,
  ISolidityCompiler,
  JsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import config from "config";
import logger from "../../../../common/logger";

export class SolcLambda implements ISolidityCompiler {
  private lambdaClient: LambdaClient;

  constructor() {
    if (
      process.env.AWS_REGION === undefined ||
      process.env.AWS_ACCESS_KEY_ID === undefined ||
      process.env.AWS_SECRET_ACCESS_KEY === undefined
    ) {
      throw new Error(
        "AWS credentials not set. Please set them to run the compiler on AWS Lambda."
      );
    }
    // Initialize Lambda client with environment variables for credentials
    this.lambdaClient = new LambdaClient({
      region: process.env.AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  public async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten: boolean = false
  ): Promise<CompilerOutput> {
    const param = JSON.stringify({ version, solcJsonInput, forceEmscripten });
    logger.silly("Invoking Lambda function", { param });
    logger.debug("Compiling with Lambda", { version });
    const response = await this.invokeLambdaFunction(param);
    logger.debug("Compiled with Lambda", { version });
    const responseObj = this.parseCompilerOutput(response);
    logger.silly("Lambda function response", { responseObj });
    return responseObj;
  }

  private async invokeLambdaFunction(payload: string): Promise<any> {
    const params: InvokeCommandInput = {
      FunctionName: config.get("lambdaCompiler.functionName") || "compile",
      Payload: payload,
    };

    const command = new InvokeCommand(params);
    const response = await this.lambdaClient.send(command);

    if (!response.Payload) {
      throw new Error(
        "Error: No response payload received from Lambda function"
      );
    }

    if (response.FunctionError) {
      const errorObj: { errorMessage: string; errorType: string } = JSON.parse(
        Buffer.from(response.Payload).toString("utf8")
      );
      logger.error("Error invoking Lambda function", {
        errorObj,
        lambdaRequestId: response.$metadata.requestId,
        functionError: response.FunctionError,
      });
      throw new Error(
        `AWS Lambda error: ${errorObj.errorType} - ${errorObj.errorMessage} - lamdbaRequestId: ${response.$metadata.requestId}`
      );
    }

    return response;
  }

  private parseCompilerOutput(response: any): CompilerOutput {
    const res = JSON.parse(Buffer.from(response.Payload).toString("utf8"));
    return res.body as CompilerOutput;
  }
}
