import { useDropzone } from "react-dropzone";
import { useEffect, useState } from "react";
import LoadingOverlay from "../../components/LoadingOverlay";
import { AiFillFileAdd } from "react-icons/ai";
import { DropzoneFile } from "../../types";
import debug from "debug";
const log = debug("BrowserVerifier");
log.enabled = !process.env.NODE_ENV || process.env.NODE_ENV !== "production";

const SOLC_BIN_URL = "https://binaries.soliditylang.org/bin";
let CompilerWorker = new Worker(
  new URL("./browserCompilerWorker", import.meta.url)
);

CompilerWorker.onmessage = (e) => {
  log("Message received from worker");
  log(e.data);
};

const BrowserVerifier: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [addedFiles, setAddedFiles] = useState<any[]>([]); // TODO: Change to File[]
  const [compilerReleases, setCompilerReleases] = useState<{
    [key: string]: string;
  }>({});
  const [selectedCompiler, setSelectedCompiler] = useState<string>("");

  useEffect(() => {
    // includes nightlies
    fetch(`${SOLC_BIN_URL}/list.json`)
      .then((res) => res.json())
      .then((res) => {
        setCompilerReleases(res.releases);
      });
  }, []);

  const loadCompiler = async (compilerFileName: string) => {
    const compilerUrl = `${SOLC_BIN_URL}/${compilerFileName}`;
    setIsLoading(true);
    log(`Loading compiler from ${compilerUrl}`);
    CompilerWorker.postMessage({ type: "loadCompiler", url: compilerUrl });
    setIsLoading(false);
  };

  const handleCompilerSelect = async (e: any) => {
    CompilerWorker.terminate();
    CompilerWorker = new Worker(
      new URL("./browserCompilerWorker", import.meta.url)
    );
    setSelectedCompiler(e.target.value);
    if (e.target.value) {
      log(`Compiler selected: ${e.target.value}`);
      loadCompiler(e.target.value);
    }
  };
  const handleFilesAdded = async (files: DropzoneFile[]) => {
    log(`Added files: ${files.map((f) => f.name).join(", ")}`);
    files.forEach(async (file) => {
      const text = await file.text();
      log(text);
    });
  };

  const handleCompileFile = async (file: DropzoneFile) => {
    const text = await file.text();
    CompilerWorker.postMessage({ type: "compile", text });
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (files: DropzoneFile[]) => {
      await handleFilesAdded(files);
      setIsLoading(true);
      setAddedFiles(files);
      setIsLoading(false);
    },
  });

  const displayFiles = addedFiles.map((file) => {
    return (
      <li className="mb-1" key={file}>
        <span>{file.name}</span>
        <button
          className="bg-ceruleanBlue-500 text-white py-1 px-2 rounded ml-2 hover:bg-ceruleanBlue-700"
          onClick={() => handleCompileFile(file)}
        >
          Compile
        </button>
      </li>
    );
  });

  return (
    <div className="flex flex-col items-center w-full">
      <div className="pt-1 bg-ceruleanBlue-500 flex flex-grow basis-0 rounded-xl mx-2 mb-4 md:mb-0">
        <div className="flex flex-col basis-0 flex-grow rounded-lg px-8 transition-all ease-in-out duration-300 bg-white overflow-hidden shadow-md">
          <div className="mt-8 flex flex-col justify-center items-center text-center">
            <h2 className="font-bold text-xl block">File Add Zone</h2>
            <p>
              Add the Solidity source files and metadata of all contracts you
              want to verify.
            </p>
          </div>
          {/* Dropdown to choose the compiler */}
          <div>
            <label
              htmlFor="compilerSelect"
              className="block text-sm font-medium text-gray-700"
            >
              Select Compiler Version
            </label>
            <select
              id="compilerSelect"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
              value={selectedCompiler}
              onChange={handleCompilerSelect}
            >
              <option value="">Select a Compiler Version</option>
              {Object.entries(compilerReleases).map(([version, url]) => (
                <option key={url} value={url}>
                  {version}
                </option>
              ))}
            </select>
          </div>
          <div>
            <h2>Files</h2>
            <div>
              {displayFiles.length && (
                <div>
                  <h2 className="font-bold text-lg">
                    Added Files{" "}
                    <span className="font-normal">({displayFiles.length})</span>
                  </h2>
                  <ul className="flex flex-col break-all list-outside ml-4 list-disc">
                    {displayFiles}
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div
            {...getRootProps()}
            className="flex flex-col flex-grow cursor-pointer"
          >
            <div className="flex flex-col flex-grow border-dashed border-2 rounded-lg hover:bg-ceruleanBlue-100 border-ceruleanBlue-500 p-4 relative">
              <input {...getInputProps()} type="file" />
              {displayFiles.length ? (
                <div>
                  <h2 className="font-bold text-lg">
                    Added Files{" "}
                    <span className="font-normal">({displayFiles.length})</span>
                  </h2>
                  <ul className="flex flex-col break-all list-outside ml-4 list-disc">
                    {displayFiles}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-col flex-grow justify-center items-center text-center">
                  <AiFillFileAdd size="2em" className="text-ceruleanBlue-500" />
                  <div className="mt-2">
                    Drag and drop here
                    <div style={{ lineHeight: "0.8em" }}> or </div>
                    <span className="text-ceruleanBlue-500">browse</span>
                  </div>
                </div>
              )}
              {/* Loading Overlay */}
              {isLoading && <LoadingOverlay message="Checking contracts" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BrowserVerifier;
