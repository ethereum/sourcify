import { useState, useEffect, FormEventHandler, ChangeEventHandler } from 'react'
import Input from "../../components/Input";
import Toast from "../../components/Toast";

type FieldProp = {
  loading: boolean,
  handleRequest: (address: string) => void
}

const Field = ({ loading, handleRequest }: FieldProp) => {
  const [address, setAddress] = useState<any>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const isAddress = /^0x[0-9a-fA-F]{40}$/.test(address)
    const fetchMatches = async () => {
      if (isAddress) {
        await handleRequest(address)
      } 
    }
    fetchMatches()
  }, [address, handleRequest])
  
  const handleSubmit: FormEventHandler<HTMLFormElement> = async (e) => {
    e.preventDefault();
    const isAddress = /^0x[0-9a-fA-F]{40}$/.test(address)
    if (!isAddress) {
      setError('Wrong address format! 🚨')
      return
    }
    await handleRequest(address)
  }

  const handleChange: ChangeEventHandler<HTMLInputElement> = (e) => {
    setAddress(e.currentTarget.value)
  }

  return (
    <div className="flex flex-col basis-0 pt-7 flex-grow rounded-lg px-8 transition-all ease-in-out duration-300 bg-white overflow-hidden shadow-md">
      <div className="mt-8 flex flex-col text-left">
        <form onSubmit={handleSubmit}>
          <label htmlFor="contract-address" className="font-bold mb-8 text-xl block">Smart contract Address</label>
          <Input id="contract-address" value={address} onChange={handleChange} />
          {!!error && <Toast
              message={error}
              isShown={!!error}
              dismiss={() => setError("")}
            /> } <br/>
          <small className="text-ceruleanBlue-800">Tap enter &#9166; if search doesn't happen automatically</small>
        </form>
      </div>
      {loading && (
        <div className='flex justify-center'>
          <svg className='animate-spin h-10 w-10 mt-8' width="94" height="94" viewBox="0 0 94 94" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M78.7718 44.9321C78.2078 33.4641 71.2518 22.7481 60.9118 17.8601C49.6318 12.7841 35.9078 14.8521 26.5078 22.7481C17.4838 30.2681 13.3478 42.4881 15.9798 53.9561C18.4238 65.2361 27.2598 74.4481 38.3518 77.4561C51.6998 81.2161 63.9198 74.8241 71.4398 63.9201C64.6718 72.9441 54.3318 78.9601 42.8638 76.8921C31.3958 74.8241 21.9958 66.1761 19.3638 54.8961C16.5438 42.8641 22.1838 30.2681 32.8998 24.0641C43.9918 17.6721 59.5958 20.1161 66.9278 31.0201C68.8078 33.6521 70.1238 36.8481 70.6878 40.0441C71.2518 42.6761 71.0638 45.4961 71.4398 48.1281C71.8158 50.5721 73.8838 53.7681 76.7038 52.0761C79.1478 50.5721 78.9598 47.3761 78.7718 44.9321C78.7718 44.1801 78.9598 46.2481 78.7718 44.9321V44.9321Z" fill="#142D6B"/>
          </svg> 
        </div>       
      )}
    </div>
  )
}

export default Field
