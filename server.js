const express = require('express')
//const bodyParser = require('body-parser');
//const request = require('request');
const serveIndex = require('serve-index')
const fileUpload = require('express-fileupload')
const app = express()
const port = 8545

const injector = require('./injector.js')

const repository = './repository/'

app.use(express.static('ui/dist'))
app.use(fileUpload({
    limits: { fileSize: 50 * 1024 * 1024 },
    abortOnLimit: true
}))

app.get('/', (req, res) => res.sendFile('ui/dist/index.html'))
app.get('/health', (req, res) => res.send('Alive and kicking!'))
app.use('/repository', express.static(repository), serveIndex(repository, {'icons': true}))

app.post('/', (req, res) => {
    let files = []
    for (var x in req.files.files) {
        const data = req.files.files[x].data
        if (data) {
          try {
              // Note: metadata files are overly stringified;
              // this `JSON.parse` still returns a string
              files.push(JSON.parse(data.toString()))
          } catch (err) {
              files.push(data.toString())
          }
        } else {
            console.log("File " + x + " invalid!")
        }
    }
    let result = injector.inject(
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
})

app.listen(port, () => console.log(`Injector listening on port ${port}!`))
