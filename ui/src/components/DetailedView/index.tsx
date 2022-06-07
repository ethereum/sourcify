import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { HiCheck, HiOutlineExclamation, HiX } from "react-icons/hi";
import { SendableContract } from "../../types";

type DetailedViewProps = {
  isShown: boolean;
  closeModal: () => void;
  checkedContract: SendableContract;
};
const DetailedView = ({
  isShown,
  closeModal,
  checkedContract,
}: DetailedViewProps) => {
  // const { files, address, storageTimestamp, name, compiledPath } =
  const { files, name, compiledPath } = checkedContract;
  const foundCount = files.found.length;
  const missingCount = Object.keys(files.missing).length;
  const invalidCount = Object.keys(files.invalid).length;
  const totalFilesCount = foundCount + missingCount + invalidCount;
  return (
    <Transition.Root show={isShown} as={Fragment}>
      <Dialog
        as="div"
        className="fixed z-10 inset-0 md:mx-24"
        // initialFocus={focusButtonRef}
        onClose={closeModal}
      >
        <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Dialog.Overlay className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
          </Transition.Child>

          {/* This element is to trick the browser into centering the modal contents. */}
          <span
            className="hidden sm:inline-block sm:align-middle sm:h-screen"
            aria-hidden="true"
          >
            &#8203;
          </span>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <div className="overflow-y-auto max-h-screen inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
              <div className="bg-white p-10">
                <h2 className="text-xl">
                  <b>Contract Name: </b>
                  {name}
                </h2>
                <h2 className="text-xl">
                  <b>Compiled Path: </b>
                  {compiledPath}
                </h2>
                <h2 className="text-xl font-bold mt-6 underline">
                  Sources ({totalFilesCount})
                </h2>

                {/* Missing Files */}
                {missingCount > 0 && (
                  <div className="mt-2 ml-4 mb-4">
                    <h3 className="font-bold text-lg">
                      Missing ({missingCount}/{totalFilesCount})
                    </h3>
                    <p>
                      Unable to find or retrieve the required source files below
                    </p>
                    <ul>
                      {Object.keys(files.missing).map((filePath, i) => (
                        <li className="mt-4" key={`${filePath}-${i}`}>
                          <HiX
                            className="inline mr-2 text-red-700"
                            size="1.25em"
                          />
                          <span className="align-middle">{filePath}</span>
                          <div className="ml-8">
                            <h4 className="font-bold">
                              Expected keccak256 hash:
                            </h4>
                            <p>{files.missing[filePath].keccak256}</p>
                            <h4 className="font-bold">File URLs:</h4>
                            {files.missing[filePath].urls.map((url, i) => (
                              <>
                                <p key={`${url}-${i}`}>{url}</p>
                              </>
                            ))}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Invalid Files */}
                {invalidCount > 0 && (
                  <div className="mt-2 ml-4">
                    <h3 className="font-bold text-lg">
                      Invalid ({invalidCount}/{totalFilesCount})
                    </h3>
                    <ul>
                      {Object.keys(files.invalid).map((filePath, i) => (
                        <li key={`${filePath}-${i}`}>
                          <HiOutlineExclamation
                            className="inline mr-2 text-yellow-600"
                            size="1.25em"
                          />
                          <span className="align-middle">{filePath}</span>
                          <div className="ml-8">
                            <p>{files.invalid[filePath].msg}</p>
                            <h4 className="font-bold">
                              Expected keccak256 hash:
                            </h4>
                            <p>{files.invalid[filePath].expectedHash}</p>
                            <h4 className="font-bold">
                              Calculated source content hash in the metadata:
                            </h4>
                            <p>{files.invalid[filePath].calculatedHash}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Found files */}
                {files.found.length > 0 && (
                  <div className="mt-2 ml-4">
                    <h3 className="font-bold text-lg">
                      Found ({files.found.length}/{totalFilesCount})
                    </h3>
                    <ul>
                      {files.found.map((file, i) => (
                        <li className="" key={`${file}-${i}`}>
                          <HiCheck
                            className="inline mr-2 text-green-700"
                            size="1.25em"
                          />
                          <span className="align-middle">{file}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default DetailedView;
