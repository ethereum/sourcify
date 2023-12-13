import bytes from "bytes";
import { useCallback, useContext, useEffect, useState } from "react";
import Header from "../../components/Header";
import Toast from "../../components/Toast";
import {
  ADD_FILES_URL,
  RESTART_SESSION_URL,
  SESSION_DATA_URL,
  VERIFY_VALIDATED_URL,
} from "../../constants";
import { Context } from "../../Context";
import {
  DropzoneFile,
  IGenericError,
  // IResponseError,
  SendableContract,
  SessionResponse,
  VerificationInput,
} from "../../types";
import CheckedContractsView from "./CheckedContractsView";
import FileUpload from "./FileUpload";

const UI_MAX_FILE_SIZE = 30 * 1024 * 1024;

const Verifier: React.FC = () => {
  const [addedFiles, setAddedFiles] = useState<string[]>([]);
  const [unusedFiles, setUnusedFiles] = useState<string[]>([]);
  const [checkedContracts, setCheckedContracts] = useState<SendableContract[]>(
    []
  );
  const { errorMessage, setErrorMessage } = useContext(Context);

  const fetchAndUpdate = useCallback(
    async (URL: string, fetchOptions?: RequestInit) => {
      try {
        const rawRes: Response = await fetch(URL, {
          credentials: "include",
          method: fetchOptions?.method || "GET", // default GET
          // mode: "cors",
          ...fetchOptions,
        });

        if (!rawRes.ok) {
          const err: IGenericError = await rawRes.json();
          throw new Error(err.error);
        }
        const res: SessionResponse = await rawRes.json();
        setUnusedFiles([...res.unused]);
        setCheckedContracts([...res.contracts]);
        setAddedFiles([...res.files]);
        setErrorMessage("");
        return res;
      } catch (e: any) {
        console.log(e);
        const ErrorMessage = ({ message }: { message: string }) => (
          <div>
            {
              // Show if there's an error message from server. Otherwise possibly CORS.
              message ? (
                message
              ) : (
                <>
                  <div>Possibly a CORS error, check the browser console.</div>
                  <div>
                    Are you on a different domain than sourcify.dev or
                    sourcify.eth? API v2 is not available except the official
                    UI. See{" "}
                    <a
                      className="font-bold"
                      href="https://docs.sourcify.dev/docs/api/#verification-api-v2---session-based"
                    >
                      docs
                    </a>{" "}
                    for details{" "}
                  </div>
                </>
              )
            }
          </div>
        );
        setErrorMessage(<ErrorMessage message={e?.message as string} />);
      }
    },
    [setErrorMessage]
  );
  // const handleFiles = async (files: DropzoneFile[]) => {
  //   const formData = new FormData();
  //   files.forEach((file) => formData.append("files", file));
  //   await fetchAndUpdate(ADD_FILES_URL, {
  //     method: "POST",
  //     body: formData,
  //   });
  // };
  const handleFiles = async (files: DropzoneFile[]) => {
    // const handleeFiles = async (files: DropzoneFile[]) => {
    const jsonBody: any = { files: {} };
    for (const file of files) {
      if (file.size > UI_MAX_FILE_SIZE) {
        const humanReadableSize = bytes(file.size);
        return setErrorMessage(
          `Added file ${
            file.name
          } is ${humanReadableSize} which is more than the maximum single file size of ${bytes(
            UI_MAX_FILE_SIZE
          )}`
        );
      }
      let filePath = file.path;
      // remove absolute path
      if (file.path.startsWith("/")) filePath = file.path.substring(1);
      // If a zip, send a seperate request, since there's already no file path
      if (
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed"
      ) {
        const formData = new FormData();
        formData.append("files", file);
        await fetchAndUpdate(ADD_FILES_URL, {
          method: "POST",
          body: formData,
        });
      } else {
        jsonBody.files[filePath] = await file.text();
      }
    }
    if (Object.keys(jsonBody.files).length > 0) {
      await fetchAndUpdate(ADD_FILES_URL, {
        method: "POST",
        body: JSON.stringify(jsonBody),
        headers: { "Content-Type": "application/json" },
      });
    }
  };

  const restartSession = async () => {
    await fetch(RESTART_SESSION_URL, {
      credentials: "include",
      method: "POST",
    });
    setUnusedFiles([]);
    setCheckedContracts([]);
    setAddedFiles([]);
    return;
  };

  /**
   * Function to submit a validated contract to verification with chainId and address.
   *
   * @param sendable -
   */
  const verifyCheckedContract = async (sendable: VerificationInput) => {
    console.log("Verifying checkedContract " + sendable.verificationId);
    return fetchAndUpdate(VERIFY_VALIDATED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contracts: [sendable],
      }),
    });
  };

  useEffect(() => {
    fetchAndUpdate(SESSION_DATA_URL);
  }, [fetchAndUpdate]);

  return (
    <div className="flex flex-col flex-1 pb-8 px-8 md:px-12 lg:px-24 bg-gray-100">
      <Header />
      <Toast
        message={errorMessage}
        isShown={!!errorMessage}
        dismiss={() => setErrorMessage("")}
      />
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold">Verifier</h1>
        <p className="mt-2">
          Verify smart contracts by recompiling with the Solidity source code
          and metadata.
        </p>
        {
          // Show legacy.sourcify.dev URL on production
          process.env.REACT_APP_TAG === "stable" && (
            <p className="text-xs mt-2 text-gray-500">
              Old verifier UI avaiable at{" "}
              <a
                href="https://legacy.sourcify.dev"
                className="hover:underline text-ceruleanBlue-300 hover:text-ceruleanBlue-400"
              >
                legacy.sourcify.dev
              </a>
            </p>
          )
        }
      </div>
      <div className="flex flex-col md:flex-row flex-grow mt-6">
        <FileUpload
          handleFilesAdded={handleFiles}
          addedFiles={addedFiles}
          metadataMissing={
            unusedFiles.length > 0 && checkedContracts.length === 0
          }
          restartSession={restartSession}
          fetchAndUpdate={fetchAndUpdate}
        />
        <CheckedContractsView
          checkedContracts={checkedContracts}
          isHidden={checkedContracts.length < 1}
          verifyCheckedContract={verifyCheckedContract}
        />
      </div>
      <div className="text-xs italic mx-2 mt-1 text-gray-400">
        Once a contract is verified it can't be removed from the Sourcify
        repository.
      </div>
    </div>
  );
};

export default Verifier;
