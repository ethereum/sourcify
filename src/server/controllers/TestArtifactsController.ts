import { Request, Response, Router } from 'express';
import BaseController from './BaseController';
import fetch from 'node-fetch';
import { IController } from '../../common/interfaces';
import { StatusCodes } from 'http-status-codes';

// Returns the test artifacts and URLs of the latest test-chains-regularly workflow in CircleCI.
// Moved server side due to CORS.
export default class TestArtifactsController extends BaseController implements IController {
  router: Router;
  
  constructor() {
      super();
      this.router = Router();
  }
  
    /**
   * Function to find the latest run of the test-chains-regularly workflow. Fetches the identifiers of the run. Also fetches the artifact .json of the run. Returns the artifact and the identifiers.
   *
   * See API docs: https://circleci.com/docs/api/v2
   *
   * @returns the testReport artifact, jobNumber, workflowId, and the pipelineNumber of the last run of the workflow.
   */
  findLatestChainTest = async (req: Request, res: Response) => {
    const CIRCLE_PROJECT_ID = process.env.CIRCLE_PROJECT_ID || 183183290;
    const WORKFLOWS_URL = `https://circleci.com/api/v2/insights/gh/ethereum/sourcify/workflows/test-chains-regularly`;
    // Fetch last runs of the chain test workflow: https://circleci.com/docs/api/v2/#operation/getProjectWorkflowRuns
    const workflowResponse = await (await fetch(WORKFLOWS_URL)).json();
    if (workflowResponse.items.length === 0) {
      res.status(StatusCodes.BAD_REQUEST).json({error: "No workflows returned from " + WORKFLOWS_URL})
    }
    const workflowId = workflowResponse.items[0].id;
    
    const LAST_WORKFLOW_URL = `https://circleci.com/api/v2/workflow/${workflowId}`;
    const JOB_URL = `https://circleci.com/api/v2/workflow/${workflowId}/job`;

    // Run requests in parallel.
    const [lastWorkflowResponse, jobResponse] = await Promise.all([
      // Fetch the last workflow object to get the pipeline number
      (await fetch(LAST_WORKFLOW_URL)).json(),
      // Fetch the job of the last workflow for the job number
      (await fetch(JOB_URL)).json()
    ])
    const pipelineNumber = lastWorkflowResponse.pipeline_number;
    const jobNumber = jobResponse.items[0].job_number;

    // Fetch the test report .json artifact
    const ARTIFACT_URL = `https://${jobNumber}-${CIRCLE_PROJECT_ID}-gh.circle-artifacts.com/0/chain-tests-report/report.json`;
    const artifactResponse = await (await fetch(ARTIFACT_URL)).json();

    res.json({
      testReport: artifactResponse,
      workflowId,
      pipelineNumber,
      jobNumber,
      CIRCLE_PROJECT_ID
    });
  };

  registerRoutes = (): Router => {
    this.router.route(['/'])
      .get(
        this.safeHandler(this.findLatestChainTest)
      );
    return this.router;
}
}