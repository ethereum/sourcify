import express from 'express';
import serveIndex from 'serve-index';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import Injector from './injector';
import Logger from 'bunyan';
import util from 'util';

const app = express();

let localChainUrl;
let silent;
if (process.env.TESTING){
  localChainUrl = process.env.LOCALCHAIN_URL;
  silent = true;
}

const injector = new Injector({
  localChainUrl: localChainUrl,
  silent: silent
});

const log = Logger.createLogger({
  name: "Server",
  streams: [{
    stream: process.stdout,
    level: silent ? 'fatal' : 30
  }]
});

const repository = './repository/';
const port = process.env.SERVER_PORT;


app.use(express.static('ui/dist'))

// TODO: 52MB is the max file size - is this right?
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  abortOnLimit: true
}))

app.use(cors())

/* tslint:disable:no-unused-variable */
app.get('/', (req, res) => res.sendFile('ui/dist/index.html'))
app.get('/health', (req, res) => res.status(200).send('Alive and kicking!'))
app.use('/repository', express.static(repository), serveIndex(repository, {'icons': true}))
/* tslint:enable:no-unused-variable */

app.post('/', (req, res) => {
  const files = [];
  const inputs = [];

  if (req.files && req.files.files) {

    // Case: <UploadedFile[]>
    if (Array.isArray(req.files.files)){

      for (const x in req.files.files) {
        if (req.files.files[parseInt(x)].data){
          inputs.push(req.files.files[parseInt(x)].data);
        }
      }

    // Case: <UploadedFile>
    } else if (req.files.files["data"]) {
      inputs.push(req.files.files["data"]);

    // Case: default
    } else {
      const msg = `Invalid file(s) detected: ${util.inspect(req.files.files)}`;
      log.info({loc:'[POST:INVALID_FILE]'}, msg);
    }

    if (!inputs.length){
      const msg = 'Unable to extract any files. Your request may be misformatted ' +
                  'or missing some contents.';

      const err = new Error(msg);
      log.info({ loc:'[POST:NO_FILES]', err: err })
      res.status(400).send({ error: err.message })
      return;
    }

    for (const data of inputs){
      try {
        const val = JSON.parse(data.toString());
        const type = Object.prototype.toString.call(val);

        (type === '[object Object]')
          ? files.push(JSON.stringify(val))  // JSON formatted metadata
          : files.push(val);                 // Stringified metadata

      } catch (err) {
        files.push(data.toString())          // Solidity files
      }
    }
    injector.inject(
      repository,
      req.body.chain,
      [req.body.address],
      files
    ).then(result => {
      res.status(200).send({ result })
    }).catch(err => {
      log.info({ loc:'[POST:INJECT_ERROR]', err: err })
      res.status(400).send({ error: err.message })
    })
  } else {
    const msg = 'Request missing expected property: "req.files.files"';
    const err = new Error(msg);
    log.info({ loc:'[POST:REQUEST_MISFORMAT]', err: err })
    res.status(400).send({ error: err.message });
  }
})

app.listen(port, () => log.info({loc:'[LISTEN]'}, `Injector listening on port ${port}!`))

export default app;
