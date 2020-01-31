import * as React from 'react'
import { render } from 'react-dom'
import App from './App'
import './index.css'

render(<App />, document.getElementById('root'))

if (module.hot) {
  module.hot.accept()
}
