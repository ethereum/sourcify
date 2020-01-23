import React, { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import Select from 'react-select'

const options = [
  { value: 'mainnet', label: 'Ethereum Mainnet' },
  { value: 'ropsten', label: 'Ropsten' },
  { value: 'rinkeby', label: 'Rinkeby' },
  { value: 'kovan', label: 'Kovan' },
  { value: 'goerli', label: 'Görli' }
]

export default function App() {
  const { acceptedFiles, getRootProps, getInputProps } = useDropzone()
  const [chain, updateChain] = useState(options[0])
  const [address, updateAddress] = useState('')
  const [success, updateSuccess] = useState(false)
  const [error, updateError] = useState(null)

  function handleSubmit() {
    updateError(null)
    updateSuccess(false)

    const formData = new FormData()
    acceptedFiles.forEach(file => {
      formData.append('files', file)
    })
    formData.append('chain', chain.value)
    if (address) formData.append('address', address)

    fetch('/', {
      method: 'POST',
      body: formData
    })
      .then(res => res.json())
      .then(response => {
        console.log('∆∆∆ response', response)
        // TODO: handle path and matching files

        if (response.error) {
          updateError(response.error)
        } else {
          updateSuccess(true)
        }
      })
      .catch(err => {
        console.log('∆∆∆ err', err)
        updateError('Something went wrong!')
      })
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
              options={options}
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

            {/* TODO: style focus border */}
            {/* TODO: error state if empty and chain isn't mainnet */}
            <input
              type="text"
              name="address"
              placeholder="Contract Address (optional for Mainnet)"
              value={address}
              onChange={e => updateAddress(e.target.value)}
            />

            {/* TODO: style text */}
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

            {error && <div className="error">{error}</div>}
            {success && (
              <div className="success">Contract successfully verified!</div>
            )}
          </div>
        </div>
        <div className="app-fieldset_footer">
          {/* TODO: disabled state */}
          <input
            // disabled={!!acceptedFiles.length}
            type="submit"
            onClick={handleSubmit}
          />
        </div>
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
