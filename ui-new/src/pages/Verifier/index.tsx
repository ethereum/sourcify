import Header from "../../components/Header";

const Verifier = () => {
  return (
    <div className="flex flex-col flex-1">
      <Header />
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold">Verifier</h1>
        <p className="mt-2">
          Recompile contracts and check if the compiled bytecode matches with
          the on-chain bytecode
        </p>
      </div>
      <div className="flex flex-col flex-grow bg-red-400 mt-2 md:mt-4">
        <div className="flex-grow bg-blue-100 my-8 mx-4 md:mx-16"></div>
      </div>
    </div>
  );
};

export default Verifier;
