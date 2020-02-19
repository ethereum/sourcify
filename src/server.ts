import express from 'express';
import serveIndex from 'serve-index';
import fileUpload from 'express-fileupload';
import cors from 'cors';
import Injector from './injector';

const app = express();
const injector = new Injector();
const repository = './repository/';
const port = process.env.SERVER_PORT;


app.use(express.static('ui/dist'))
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    abortOnLimit: true
}))

app.use(cors())

app.get('/', (req, res) => res.sendFile('ui/dist/index.html'))
app.get('/health', (req, res) => res.send('Alive and kicking!'))
app.use('/repository', express.static(repository), serveIndex(repository, {'icons': true}))

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
        const result = injector.inject(
            repository,
            req.body.chain,
            req.body.address,
            files
        ).then(result => {
            res.status(200).send({ result })
        }).catch(err => {
            console.log(`Error: ${err}`)
            res.send({ error: err })
        })
    } else {
        const err = new Error('Request missing expected property: "req.files.files"');
        console.log(err);
        res.send({ error: err });
    }
})

app.listen(port, () => console.log(`Injector listening on port ${port}!`))
