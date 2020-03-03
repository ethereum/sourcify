import React, { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Select from 'react-select'

export default function App() {
    const chainOptions = [
        { value: 'mainnet', label: 'Ethereum Mainnet' },
        { value: 'ropsten', label: 'Ropsten' },
        { value: 'rinkeby', label: 'Rinkeby' },
        { value: 'kovan', label: 'Kovan' },
        { value: 'goerli', label: 'Görli' }
    ]

    if (process.env.NODE_ENV === 'testing'){
      chainOptions.push({
        value: 'localhost',
        label: 'localhost:8545'
      })
    }

    const { acceptedFiles, getRootProps, getInputProps } = useDropzone()
    const [chain, updateChain] = useState(chainOptions[0])
    const [address, updateAddress] = useState('')
    const [loading, updateLoading] = useState(false)
    const [error, updateError] = useState(null)
    const url = process.env.SERVER_URL
    const log = console.log
    log(`Server URL: ${url}`)

  const [result, updateResult] = useState([])

  function handleSubmit() {
    updateError(null)
    updateResult([])
    updateLoading(true)

    const formData = new FormData()
    acceptedFiles.forEach(file => {
      formData.append('files', file)
    })
    formData.append('chain', chain.value)
    if (address) formData.append('address', address)
    try{
      fetch(`${url}`, {
        method: 'POST',
        body: formData
      })
        .then(res => res.json())
        .then(response => {
          updateLoading(false)
          if (response.error) {
            updateError(response.error)
          } else {
            updateResult(response.result)
          }
        }).catch(err => {
          updateLoading(false)
          updateError('Something went wrong!')
        })
      }
      catch(err) {
        console.log('Error: ', err)
        updateLoading(false)
        updateError('Something went wrong!')
      }

  }

  const acceptedFilesItems = acceptedFiles.map(file => (
    <li key={file.path}>
      {file.path} - {file.size} bytes
    </li>
  ))

  return (
    <div className="app">
      <h2>Decentralized Metadata and Source Code Repository</h2>
      <p>
        Upload metadata and source files of your contract to make it available.
        <br />
        Note that the metadata file has to be exactly the same as at deploy
        time.
        <br />
        Browse repository <a href="/repository">here</a> or via{' '}
        <a href="https://gateway.ipfs.io/ipns/QmNmBr4tiXtwTrHKjyppUyAhW1FQZMJTdnUrksA9hapS4u">
          ipfs/ipns gateway
        </a>
        .
      </p>

      <fieldset className="app-fieldset">
        <div className="app-fieldset_body">
          <div className="app-fieldset_left">
            <Select
              className="select"
              placeholder="Chain"
              value={chain}
              onChange={option => updateChain(option)}
              name="chain"
              options={chainOptions}
              theme={theme => ({
                ...theme,
                borderRadius: 0,
                colors: {
                  ...theme.colors,
                  primary: '#5a83ac',
                  neutral50: '#9d9d9d'
                }
              })}
            />

            <input
              type="text"
              name="address"
              placeholder="Contract Address (required)"
              value={address}
              onChange={e => updateAddress(e.target.value)}
            />

            <div {...getRootProps({ className: 'app-dropzone' })}>
              <input {...getInputProps()} />
              {acceptedFiles.length ? (
                <span>
                  <b>Files to upload:</b>
                  {acceptedFilesItems}
                </span>
              ) : (
                <span>
                  drag and drop
                  <br />- or -<br />
                  click to select files
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="app-fieldset_footer">
          <input
            disabled={
              acceptedFiles.length === 0 || !address
            }
            type="submit"
            onClick={handleSubmit}
          />
        </div>

        {loading && <div className="loading">Loading...</div>}
        {error && <div className="error">{error}</div>}
        {!!result.length && (
          <div className="success">
            Contract successfully verified!
            <br />
            <br />
            View the assets in the{' '}
            <a href={`/repository/contract/${chain.value}/${result[0]}`}>
              file explorer
            </a>
            .
            {result.length > 1 && (
              <>
                <br />
                <br />
                <div>
                  Found {result.length} addresses of this contract:{' '}
                  {result.join(', ')}
                </div>
              </>
            )}
          </div>
        )}
      </fieldset>
      <p>
        source code:{' '}
        <a href="https://github.com/ethereum/source-verify/">
          https://github.com/ethereum/source-verify/
        </a>
      </p>
    </div>
  )
}
