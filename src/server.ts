import express from 'express';
import serveIndex from 'serve-index';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import { log, findInputFiles } from './utils';
import Injector from './injector';
import path from 'path';
import {
  InputData,
  fetchAllFileContents,
  fetchAllFileUrls,
  FileObject,
  getChainId,
  verify,
} from "./utils";
import {
  errorMiddleware,
  NotFound
} from "./errorHandler";


const app = express();

import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(__dirname, "..", "environments/.env") });

let localChainUrl;

if (process.env.TESTING) {
  localChainUrl = process.env.LOCALCHAIN_URL;
}

const injector = new Injector({
  localChainUrl: localChainUrl,
  log: log,
  infuraPID: process.env.INFURA_ID || "changeinfuraid"
});

const repository = process.env.MOCK_REPOSITORY || './repository';
const port = process.env.SERVER_PORT;

app.use(express.static('ui/dist'))

// TODO: 52MB is the max file size - is this right?
app.use(fileUpload({
  limits: {fileSize: 50 * 1024 * 1024},
  abortOnLimit: true
}))

app.use(cors())

/* tslint:disable:no-unused-variable */
app.get('/', (req, res) => res.sendFile('ui/dist/index.html'))
app.get('/health', (req, res) => res.status(200).send('Alive and kicking!'))
app.use('/repository', express.static(repository), serveIndex(repository, {'icons': true}))

app.get('/tree/:chain/:address', (req, res, next) => {
  try {
    const chain:string = req.params.chain;
    const address: string = req.params.address;
    const chainId = getChainId(chain);
    const files = fetchAllFileUrls(chainId, address);
    if(!files.length) throw new NotFound("Files have not been found!");
    res.status(200).send(JSON.stringify(files))
  } catch(err){
    next(err);
  }
})

app.get('/files/:chain/:address', (req, res, next) => {
  try{
    const chain:string = req.params.chain;
    const address: string = req.params.address;
    const chainId = getChainId(chain);
    const files: Array<FileObject> = fetchAllFileContents(chainId, address);
    if(files.length === 0) throw new NotFound("Files have not been found!");
    res.status(200).send(files);
  } catch(err) {
    next(err);
  }
})

/* tslint:enable:no-unused-variable */
app.post('/', (req, res, next) => {
  const inputData: InputData = {
    repository: repository,
    addresses: [req.body.address],
    files: [],
    chain: getChainId(req.body.chain)
  }

  try {
    const files = findInputFiles(req.files);
    if(files !== undefined) inputData.files = files;
  } catch(err){
    // Just ignore error if no files have been found
  }

  try{
    Promise.all(verify(inputData, injector)).then((result) => {
      res.status(200).send({
        result
      })
    }).catch(err => {
      next(err)
    });
  } catch (err) {
    return next(err);
  }
})

app.use(errorMiddleware);

app.listen(port, () => log.info({loc: '[LISTEN]'}, `Injector listening on port ${port}!`))

export default app;
