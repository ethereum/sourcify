import { SourcifyEventManager } from "../../common/SourcifyEventManager/SourcifyEventManager";

export default function notFoundError(express: any): void {
  const _send: Function = express.response.send;
  (express.response as any).send = function (...args: any) {
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(args);
    } catch (e) {
      parsedResponse = {};
    }
    SourcifyEventManager.trigger("Server.ApiReplied", {
      api: this.req.path,
      status: this.statusCode,
      parameters: this.req.body,
      response: parsedResponse,
    });
    return _send.bind(this)(...args);
  };
}
