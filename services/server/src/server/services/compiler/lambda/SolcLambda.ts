import {
  LambdaClient,
  InvokeWithResponseStreamCommand,
  InvokeWithResponseStreamCommandInput,
} from "@aws-sdk/client-lambda";
import {
  SolidityOutput,
  ISolidityCompiler,
  JsonInput,
} from "@ethereum-sourcify/lib-sourcify";
import logger from "../../../../common/logger";

export class SolcLambda implements ISolidityCompiler {
  private lambdaClient: LambdaClient;
  private lambdaCompilerFunctionName: string;

  constructor(
    awsRegion: string,
    awsAccessKeyId: string,
    awsSecretAccessKey: string,
    lambdaCompilerFunctionName: string = "compile",
  ) {
    this.lambdaCompilerFunctionName = lambdaCompilerFunctionName;
    // Initialize Lambda client with environment variables for credentials
    this.lambdaClient = new LambdaClient({
      region: awsRegion,
      credentials: {
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey,
      },
    });
  }

  public async compile(
    version: string,
    solcJsonInput: JsonInput,
    forceEmscripten: boolean = false,
  ): Promise<SolidityOutput> {
    const param = JSON.stringify({ version, solcJsonInput, forceEmscripten });
    logger.silly("Invoking Lambda function", { param });
    logger.debug("Compiling with Lambda", { version });
    const response = await this.invokeLambdaFunction(param);
    logger.debug("Compiled with Lambda", { version });
    logger.silly("Lambda function response", { response });
    return response;
  }

  private async invokeLambdaFunction(payload: string): Promise<SolidityOutput> {
    const params: InvokeWithResponseStreamCommandInput = {
      FunctionName: this.lambdaCompilerFunctionName,
      Payload: payload,
    };

    const command = new InvokeWithResponseStreamCommand(params);
    const response = await this.lambdaClient.send(command);

    if (!response.EventStream) {
      throw new Error(
        "Error: No response stream received from Lambda function",
      );
    }

    let streamResult = "";
    for await (const event of response.EventStream) {
      if (event.InvokeComplete?.ErrorCode) {
        logger.error("Error invoking Lambda function", {
          errorCode: event.InvokeComplete.ErrorCode,
          errorDetails: event.InvokeComplete.ErrorDetails,
          logResult: event.InvokeComplete.LogResult,
          lambdaRequestId: response.$metadata.requestId,
        });
        throw new Error(
          `AWS Lambda error: ${event.InvokeComplete.ErrorCode} - ${event.InvokeComplete.ErrorDetails} - lamdbaRequestId: ${response.$metadata.requestId}`,
        );
      } else if (event.PayloadChunk?.Payload) {
        streamResult += Buffer.from(event.PayloadChunk.Payload).toString(
          "utf8",
        );
      }
    }
    logger.silly("Received stream response", { streamResult });

    let output;
    try {
      output = JSON.parse(streamResult);
    } catch (e) {
      logger.error("Error parsing Lambda function result", {
        error: e,
        lambdaRequestId: response.$metadata.requestId,
      });
      throw new Error(
        `AWS Lambda error: ${e} - lamdbaRequestId: ${response.$metadata.requestId}`,
      );
    }

    if (output.error) {
      logger.error("Error received from Lambda function", {
        error: output.error,
        lambdaRequestId: response.$metadata.requestId,
      });
      const errorMessage = `AWS Lambda error: ${output.error} - lamdbaRequestId: ${response.$metadata.requestId}`;
      if (output.error === "Stream response limit exceeded") {
        throw new LambdaResponseLimitExceeded(errorMessage);
      } else {
        throw new Error(errorMessage);
      }
    }

    return output;
  }
}

export class LambdaResponseLimitExceeded extends Error {
  name = "LambdaResponseLimitExceeded";
}
