import express from 'express';
import serveIndex from 'serve-index';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import Injector from './injector';

const app = express();

let localChainUrl;
if (process.env.TESTING){
  localChainUrl = process.env.LOCALCHAIN_URL;
}

const injector = new Injector({
  localChainUrl: localChainUrl
});

const repository = './repository/';
const port = process.env.SERVER_PORT;


app.use(express.static('ui/dist'))
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 },
  abortOnLimit: true
}))

app.use(cors())

/* tslint:disable:no-unused-variable */
app.get('/', (req, res) => res.sendFile('ui/dist/index.html'))
app.get('/health', (req, res) => res.send('Alive and kicking!'))
app.use('/repository', express.static(repository), serveIndex(repository, {'icons': true}))
/* tslint:enable:no-unused-variable */

app.post('/', (req, res) => {
  const files = [];

  if (req.files && req.files.files) {

    for (const x in req.files.files) {

      const data = Array.isArray(req.files.files)
        ? req.files.files[parseInt(x)].data
        : null;

      if (data) {
        try {
        // Note: metadata files are overly stringified;
        // this `JSON.parse` still returns a string
        files.push(JSON.parse(data.toString()))
        } catch (err) {
        files.push(data.toString())
        }
      } else {
        console.log(`File ${x} invalid!`)
      }
    }
    injector.inject(
      repository,
      req.body.chain,
      req.body.address,
      req.body.isENS,
      files
    ).then(result => {
      res.status(200).send({ result })
    }).catch(err => {
      console.log(`Error: ${err}`)
      res.send({ error: err.message })
    })
  } else {
    const err = new Error('Request missing expected property: "req.files.files"');
    console.log(err);
    res.send({ error: err.message });
  }
})

app.listen(port, () => console.log(`Injector listening on port ${port}!`))
